-- ==============================================================================
-- BKI ACADEMY - ROLES ROLLBACK
-- ==============================================================================
-- SECTION A  (run this if saving/reading broke after supabase_rls_roles.sql)
--   Puts the policies back to the state after supabase_rls_hardening.sql:
--   every SIGNED-IN user can read and write; signed-out visitors get nothing;
--   certificate_history stays append-only; app_settings is writable by signed-in users.
--   Safe: it does not touch data or the created_by column.
--
-- SECTION B  (optional, commented out)
--   Removes the created_by owner column and helper functions from stage 4.
--   DESTRUCTIVE: the ownership information is lost. Only do this if you abandon the
--   "staff delete own rows" rule. Run section A first.
-- ==============================================================================

-- ---------------------------------- SECTION A ---------------------------------
BEGIN;

DO $$
DECLARE
    t TEXT;
    pol RECORD;
    append_only TEXT[] := ARRAY['certificate_history'];
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'companies', 'contacts', 'training_programs', 'leads', 'lead_activities',
        'trainings', 'participants', 'certificates', 'certificate_history', 'app_settings'
    ] LOOP
        IF to_regclass('public.' || quote_ident(t)) IS NULL THEN CONTINUE; END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
        END LOOP;

        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
                       t || '_select_authenticated', t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
                       t || '_insert_authenticated', t);

        IF NOT (t = ANY (append_only)) THEN
            EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
                           t || '_update_authenticated', t);
            -- app_settings has never had a delete policy
            IF t <> 'app_settings' THEN
                EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)',
                               t || '_delete_authenticated', t);
            END IF;
        END IF;
    END LOOP;
END $$;

COMMIT;

SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;

-- ---------------------------------- SECTION B ---------------------------------
-- BEGIN;
-- DO $$
-- DECLARE t TEXT;
-- BEGIN
--     FOREACH t IN ARRAY ARRAY['leads', 'trainings', 'certificates'] LOOP
--         IF to_regclass('public.' || quote_ident(t)) IS NULL THEN CONTINUE; END IF;
--         EXECUTE format('DROP TRIGGER IF EXISTS protect_created_by ON public.%I', t);
--         EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS created_by', t);
--     END LOOP;
-- END $$;
-- DROP FUNCTION IF EXISTS public.protect_created_by();
-- DROP FUNCTION IF EXISTS public.app_role();
-- COMMIT;
