-- ==============================================================================
-- BKI ACADEMY - RLS AUDIT (READ-ONLY)
-- ==============================================================================
-- Only SELECT statements: changes nothing. Run each block in the Supabase SQL
-- Editor and send the results back before running supabase_rls_hardening.sql.
-- ==============================================================================

-- 1) Which tables exist in schema public and is RLS on?
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 2) Every policy on those tables (who may do what)
SELECT tablename, policyname, cmd, roles, permissive, qual AS using_expr, with_check AS check_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3) What the public "anon" role is allowed to do on each table (privileges)
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS anon_privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
GROUP BY table_name
ORDER BY table_name;

-- 4) Same for the signed-in role "authenticated"
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS authenticated_privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'authenticated'
GROUP BY table_name
ORDER BY table_name;

-- 5) Existing accounts (to see who can already sign in). Emails only, no secrets.
SELECT email, created_at, last_sign_in_at, email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users
ORDER BY created_at;
