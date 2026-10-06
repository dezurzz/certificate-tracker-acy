-- ==============================================================================
-- BKI ACADEMY - ROLES AUDIT (read-only: SELECT only, changes nothing)
-- ==============================================================================
-- Run before and after stages 4 and 5 and paste the results to the developer.
-- Supabase shows only the LAST result set, so run the numbered queries one at a time
-- (select one query, then Run). If you run the whole file, only the last query's result is shown.
-- ==============================================================================

-- 1. Accounts and their roles (every account should have app_role set)
select email, raw_app_meta_data ->> 'role' as app_role, last_sign_in_at
from auth.users
order by created_at;

-- 2. Is the owner column (stage 4) in place? Works before and after stage 4.
select t.table_name,
       exists (select 1 from information_schema.columns c
                where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'created_by') as has_created_by
from (values ('leads'), ('trainings'), ('certificates')) as t(table_name);

-- 2b. ONLY AFTER stage 4 (supabase_roles_owner.sql): how many existing rows have an owner?
--     Left commented out because it errors with "column created_by does not exist" before stage 4.
-- select 'leads' as tbl, count(*) as total, count(created_by) as with_owner from public.leads
-- union all select 'trainings', count(*), count(created_by) from public.trainings
-- union all select 'certificates', count(*), count(created_by) from public.certificates;

-- 3. Policies per table: what each role may do
select tablename, cmd, policyname, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 4. Is RLS enabled on every data table? (rowsecurity must be true everywhere)
select c.relname as tbl, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 5. Helper functions and triggers from stage 4
select p.proname, pg_get_functiondef(p.oid) is not null as exists_
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('app_role', 'protect_created_by');

select event_object_table as tbl, trigger_name
from information_schema.triggers
where trigger_schema = 'public' and trigger_name = 'protect_created_by';

-- 6. What happens to child rows when a parent is deleted? (delete_rule: CASCADE / NO ACTION / RESTRICT / SET NULL)
--    Matters for "staff delete own rows": deleting a batch that still has certificates created by
--    someone else only works when certificates -> trainings is CASCADE; with NO ACTION/RESTRICT the
--    delete is refused with a foreign-key error. Send this result to the developer before stage 5.
select tc.table_name as child_table, kcu.column_name as child_column,
       ccu.table_name as parent_table, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
join information_schema.constraint_column_usage ccu on ccu.constraint_name = rc.unique_constraint_name
where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
order by tc.table_name, kcu.column_name;
