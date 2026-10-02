-- ==============================================================================
-- BKI ACADEMY - RLS HARDENING: data tables only for signed-in users
-- ==============================================================================
-- Run once in the Supabase SQL Editor AFTER reviewing supabase_rls_audit.sql.
-- Idempotent: safe to re-run. Tables that do not exist are skipped.
--
-- For each data table it:
--   1. enables Row Level Security,
--   2. drops EVERY existing policy (names of older ones are unknown),
--   3. revokes all privileges from the public "anon" role, and TRUNCATE/REFERENCES/
--      TRIGGER from "authenticated" (RLS does not cover those),
--   4. grants the normal privileges to "authenticated" and creates one policy
--      per operation (SELECT / INSERT / UPDATE / DELETE) for signed-in users.
--      certificate_history (audit trail) is append-only: SELECT + INSERT only.
--
-- Result: a request with only the anon key (not signed in) gets no data and
-- cannot write. The service_role key (server only) keeps bypassing RLS.
-- app_settings keeps its policies (already authenticated-only); only its privileges are tightened.
--
-- IMPORTANT: this only blocks people who are not signed in. While public
-- sign-up is enabled in Authentication settings, anyone can create an account
-- and become "authenticated", so also turn OFF "Allow new users to sign up"
-- (accounts are then created by an admin from the app).
--
-- If a page suddenly shows no data, run supabase_rls_rollback.sql, then tell me.
-- ==============================================================================

DO $$
DECLARE
    t TEXT;
    pol RECORD;
    tables TEXT[] := ARRAY[
        'companies', 'contacts', 'training_programs', 'leads', 'lead_activities',
        'trainings', 'participants', 'certificates', 'certificate_history'
    ];
    -- Audit trail: rows can be added and read, never edited or deleted (the app only inserts)
    append_only TEXT[] := ARRAY['certificate_history'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
            RAISE NOTICE 'skip % (table does not exist)', t;
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
        END LOOP;

        -- Privileges: nothing for anon; authenticated only gets what the app needs
        -- (TRUNCATE / REFERENCES / TRIGGER are not covered by RLS, so they are removed too)
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);

        IF t = ANY (append_only) THEN
            EXECUTE format('GRANT SELECT, INSERT ON public.%I TO authenticated', t);
        ELSE
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
        END IF;

        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
                       t || '_select_authenticated', t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
                       t || '_insert_authenticated', t);

        IF NOT (t = ANY (append_only)) THEN
            EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
                           t || '_update_authenticated', t);
            EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)',
                           t || '_delete_authenticated', t);
        END IF;

        RAISE NOTICE 'hardened % %', t, CASE WHEN t = ANY (append_only) THEN '(append-only)' ELSE '' END;
    END LOOP;

    -- app_settings keeps its existing policies; only tighten privileges
    IF to_regclass('public.app_settings') IS NOT NULL THEN
        REVOKE ALL ON public.app_settings FROM anon;
        REVOKE ALL ON public.app_settings FROM authenticated;
        GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
    END IF;
END $$;

-- Tables created from now on in schema public are NOT open to anon by default
-- (Supabase would otherwise grant them everything). Add explicit grants/policies per new table.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- Check the result: every table shows 4 policies for role {authenticated}
-- (certificate_history shows 2: SELECT and INSERT)
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
