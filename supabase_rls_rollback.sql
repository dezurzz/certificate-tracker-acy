-- ==============================================================================
-- BKI ACADEMY - RLS ROLLBACK (EMERGENCY ONLY)
-- ==============================================================================
-- Restores the OLD wide-open access (anyone with the anon key can read, change
-- and delete these tables, without signing in). Use only if a page broke after
-- supabase_rls_hardening.sql, and tell the developer so the real cause is fixed.
-- ==============================================================================

DO $$
DECLARE
    t TEXT;
    pol RECORD;
    tables TEXT[] := ARRAY[
        'companies', 'contacts', 'training_programs', 'leads', 'lead_activities',
        'trainings', 'participants', 'certificates', 'certificate_history'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF to_regclass('public.' || quote_ident(t)) IS NULL THEN CONTINUE; END IF;

        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
        END LOOP;

        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
                       'Allow all access to ' || t, t);
    END LOOP;
END $$;
