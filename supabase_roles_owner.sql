-- ==============================================================================
-- BKI ACADEMY - ROLES, STAGE 4: record who created each row ("created_by")
-- ==============================================================================
-- Run once in the Supabase SQL Editor. Idempotent (safe to re-run).
--
-- WHY: staff may delete only the rows they created. The app has no reliable owner
-- today (leads.pic_staff_name and trainings.pic are free-text names), so this adds a
-- real owner column to the three tables where "delete your own" applies:
--   leads, trainings, certificates
--
-- WHAT IT DOES
--   1. public.app_role()  : the caller's role, read from the JWT's app_metadata.role
--                           (admin | staff | executive | viewer; anything else = viewer).
--   2. created_by uuid    : references auth.users(id), DEFAULT auth.uid(), so every new
--                           row made from the app is stamped with the signed-in user.
--                           If that user is deleted later the column becomes NULL.
--   3. A trigger that stops anyone except an admin from changing created_by afterwards
--      (nobody can hand over or steal ownership by editing a row).
--
-- WHAT IT DOES NOT DO
--   * It changes NO access rules (that is supabase_rls_roles.sql, stage 5).
--   * Existing rows get created_by = NULL ("no owner"). Once stage 5 is applied, rows
--     without an owner can be deleted by admins only. See the optional claim step at
--     the bottom if you want to assign old rows to people.
--   * The running app keeps working unchanged: it never sends created_by itself.
--
-- ROLLBACK: supabase_roles_rollback.sql (section B, commented out on purpose).
-- ==============================================================================

BEGIN;

-- 1. The caller's role --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT CASE coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
        WHEN 'admin'     THEN 'admin'
        WHEN 'staff'     THEN 'staff'
        WHEN 'executive' THEN 'executive'
        ELSE 'viewer'
    END
$$;

REVOKE ALL ON FUNCTION public.app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_role() TO authenticated;

-- 2. Only admins may change an existing owner ------------------------------------
-- (auth.uid() is NULL for the SQL Editor and the service key, which may do anything.)
CREATE OR REPLACE FUNCTION public.protect_created_by()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by
       AND auth.uid() IS NOT NULL
       AND (SELECT public.app_role()) <> 'admin' THEN
        NEW.created_by := OLD.created_by;
    END IF;
    RETURN NEW;
END
$$;

-- 3. The owner column on each table ------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['leads', 'trainings', 'certificates'] LOOP
        IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
            RAISE NOTICE 'skip % (table does not exist)', t;
            CONTINUE;
        END IF;

        -- Add the column WITHOUT a default first so existing rows are guaranteed NULL,
        -- then set the default for rows created from now on.
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL', t);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_by SET DEFAULT auth.uid()', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (created_by)', 'idx_' || t || '_created_by', t);

        EXECUTE format('DROP TRIGGER IF EXISTS protect_created_by ON public.%I', t);
        EXECUTE format(
            'CREATE TRIGGER protect_created_by BEFORE UPDATE ON public.%I
             FOR EACH ROW WHEN (OLD.created_by IS DISTINCT FROM NEW.created_by)
             EXECUTE FUNCTION public.protect_created_by()', t);

        RAISE NOTICE 'owner column ready on %', t;
    END LOOP;
END $$;

COMMIT;

-- Check: the column exists on all three tables and old rows have no owner yet
SELECT 'leads' AS tbl, count(*) AS total, count(created_by) AS with_owner FROM public.leads
UNION ALL SELECT 'trainings', count(*), count(created_by) FROM public.trainings
UNION ALL SELECT 'certificates', count(*), count(created_by) FROM public.certificates;

-- ==============================================================================
-- OPTIONAL (not run by default): give OLD rows an owner
-- ==============================================================================
-- After stage 5, only admins can delete rows that have no owner. If you want a staff
-- member to be able to delete the old rows they handled, assign them yourself. The
-- free-text PIC name is only a hint, so review the matches first (SELECT before UPDATE).
--
-- Example: batches whose PIC is "Shiddiq" belong to shiddiq@bki.academy
--   SELECT id, program_name, batch_code, pic FROM public.trainings
--    WHERE created_by IS NULL AND pic ILIKE 'shiddiq%';
--
--   UPDATE public.trainings
--      SET created_by = (SELECT id FROM auth.users WHERE email = 'shiddiq@bki.academy')
--    WHERE created_by IS NULL AND pic ILIKE 'shiddiq%';
--
-- Same idea for leads (pic_staff_name). Certificates have no PIC column of their own; to
-- give them the owner of their batch:
--   UPDATE public.certificates c
--      SET created_by = t.created_by
--     FROM public.trainings t
--    WHERE c.training_id = t.id AND c.created_by IS NULL AND t.created_by IS NOT NULL;
-- (The protect_created_by trigger allows these because the SQL Editor has no signed-in user.)
