-- ==============================================================================
-- BKI ACADEMY - ROLES, STAGE 5: row level security per role
-- ==============================================================================
-- Run in the Supabase SQL Editor AFTER:
--   * supabase_roles_owner.sql (stage 4) has been run, and
--   * every account has app_metadata.role set (admin | staff | executive | viewer).
-- The script refuses to run otherwise. Idempotent: safe to re-run.
--
-- The role comes from the signed-in user's JWT (app_metadata.role, writable only with
-- the service key). An account with no/unknown role is treated as "viewer".
--
--   table                                    read   insert/update      delete
--   ---------------------------------------  -----  -----------------  ---------------------------
--   leads, trainings, certificates           all    admin, staff       admin; staff only own rows
--                                                                       (a batch: only if ALL its certificates are theirs too)
--   companies, contacts, training_programs,
--     participants                           all    admin, staff       admin
--   lead_activities                          all    admin, staff (ins) admin; staff for own leads
--   certificate_history (audit trail)        all    admin, staff (ins) nobody (append-only)
--   app_settings (SLA, ...)                  all    admin              nobody
--
--   "own rows" = created_by = the caller (rows created before stage 4 have no owner,
--   so only admins can delete them). executive and viewer can only read.
--   INSERTs on leads/trainings/certificates must be stamped with the caller's own id.
--
-- AFTER RUNNING: tokens issued before a role was set keep the old role until they are
-- refreshed (up to ~1 hour). Ask everybody to sign out and in again.
--
-- If a page suddenly refuses to save or shows no data, run supabase_rls_roles_rollback.sql
-- (section A) to return to "every signed-in user can do everything", then tell the developer.
-- ==============================================================================

BEGIN;

-- 0. Safety checks: do not lock the team out -----------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE raw_app_meta_data ->> 'role' = 'admin') THEN
        RAISE EXCEPTION 'Aborted: no account has app_metadata.role = admin. Set at least one admin first, otherwise nobody could manage data.';
    END IF;

    IF to_regprocedure('public.app_role()') IS NULL THEN
        RAISE EXCEPTION 'Aborted: public.app_role() is missing. Run supabase_roles_owner.sql (stage 4) first.';
    END IF;

    IF (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'created_by'
           AND table_name IN ('leads', 'trainings', 'certificates')) <> 3 THEN
        RAISE EXCEPTION 'Aborted: created_by is missing on leads/trainings/certificates. Run supabase_roles_owner.sql (stage 4) first.';
    END IF;
END $$;

-- 1. Start clean: drop every existing policy on the managed tables ---------------
DO $$
DECLARE
    t TEXT;
    pol RECORD;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'companies', 'contacts', 'training_programs', 'leads', 'lead_activities',
        'trainings', 'participants', 'certificates', 'certificate_history', 'app_settings'
    ] LOOP
        IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
            RAISE NOTICE 'skip % (table does not exist)', t;
            CONTINUE;
        END IF;
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
        END LOOP;
    END LOOP;
END $$;

-- 2. Reading: every signed-in user, every role ----------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'companies', 'contacts', 'training_programs', 'leads', 'lead_activities',
        'trainings', 'participants', 'certificates', 'certificate_history', 'app_settings'
    ] LOOP
        IF to_regclass('public.' || quote_ident(t)) IS NULL THEN CONTINUE; END IF;
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_select_all', t);
    END LOOP;
END $$;

-- 3. leads, trainings, certificates: staff write, delete = admin or own rows ------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['leads', 'trainings', 'certificates'] LOOP
        IF to_regclass('public.' || quote_ident(t)) IS NULL THEN CONTINUE; END IF;

        EXECUTE format($f$
            CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
            WITH CHECK ((SELECT public.app_role()) IN ('admin', 'staff') AND created_by = (SELECT auth.uid()))$f$,
            t || '_insert_staff', t);

        EXECUTE format($f$
            CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
            USING ((SELECT public.app_role()) IN ('admin', 'staff'))
            WITH CHECK ((SELECT public.app_role()) IN ('admin', 'staff'))$f$,
            t || '_update_staff', t);
    END LOOP;
END $$;

CREATE POLICY leads_delete_admin_or_owner ON public.leads FOR DELETE TO authenticated
    USING (
        (SELECT public.app_role()) = 'admin'
        OR ((SELECT public.app_role()) = 'staff' AND created_by = (SELECT auth.uid()))
    );

CREATE POLICY certificates_delete_admin_or_owner ON public.certificates FOR DELETE TO authenticated
    USING (
        (SELECT public.app_role()) = 'admin'
        OR ((SELECT public.app_role()) = 'staff' AND created_by = (SELECT auth.uid()))
    );

-- Deleting a batch also deletes its certificates (ON DELETE CASCADE, and cascades are not
-- subject to RLS). So staff may delete a batch only if they own it AND every certificate in
-- it is theirs too; otherwise they could erase other people's certificates through the batch.
CREATE POLICY trainings_delete_admin_or_owner ON public.trainings FOR DELETE TO authenticated
    USING (
        (SELECT public.app_role()) = 'admin'
        OR (
            (SELECT public.app_role()) = 'staff'
            AND created_by = (SELECT auth.uid())
            AND NOT EXISTS (
                SELECT 1 FROM public.certificates c
                 WHERE c.training_id = trainings.id
                   AND c.created_by IS DISTINCT FROM (SELECT auth.uid())
            )
        )
    );

-- 4. Shared master data: staff write, only admins delete ---------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['companies', 'contacts', 'training_programs', 'participants'] LOOP
        IF to_regclass('public.' || quote_ident(t)) IS NULL THEN CONTINUE; END IF;

        EXECUTE format($f$
            CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
            WITH CHECK ((SELECT public.app_role()) IN ('admin', 'staff'))$f$,
            t || '_insert_staff', t);

        EXECUTE format($f$
            CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
            USING ((SELECT public.app_role()) IN ('admin', 'staff'))
            WITH CHECK ((SELECT public.app_role()) IN ('admin', 'staff'))$f$,
            t || '_update_staff', t);

        EXECUTE format($f$
            CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
            USING ((SELECT public.app_role()) = 'admin')$f$,
            t || '_delete_admin', t);
    END LOOP;
END $$;

-- 5. lead_activities: staff add entries; deleting follows the parent lead --------------
-- (the app deletes a lead's activities right before the lead itself)
CREATE POLICY lead_activities_insert_staff ON public.lead_activities FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.app_role()) IN ('admin', 'staff'));

CREATE POLICY lead_activities_update_admin ON public.lead_activities FOR UPDATE TO authenticated
    USING ((SELECT public.app_role()) = 'admin')
    WITH CHECK ((SELECT public.app_role()) = 'admin');

CREATE POLICY lead_activities_delete_admin_or_lead_owner ON public.lead_activities FOR DELETE TO authenticated
    USING (
        (SELECT public.app_role()) = 'admin'
        OR (
            (SELECT public.app_role()) = 'staff'
            AND EXISTS (
                SELECT 1 FROM public.leads l
                 WHERE l.id = lead_activities.lead_id AND l.created_by = (SELECT auth.uid())
            )
        )
    );

-- 6. certificate_history: append-only audit trail (no UPDATE, no DELETE policy) --------
CREATE POLICY certificate_history_insert_staff ON public.certificate_history FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.app_role()) IN ('admin', 'staff'));

-- 7. app_settings (SLA threshold, ...): only admins change them -------------------------
CREATE POLICY app_settings_insert_admin ON public.app_settings FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.app_role()) = 'admin');

CREATE POLICY app_settings_update_admin ON public.app_settings FOR UPDATE TO authenticated
    USING ((SELECT public.app_role()) = 'admin')
    WITH CHECK ((SELECT public.app_role()) = 'admin');

COMMIT;

-- Check the result: policies per table (certificate_history: 2, app_settings: 3, others: 4 or 5)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
