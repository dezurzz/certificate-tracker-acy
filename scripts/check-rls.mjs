#!/usr/bin/env node
/**
 * Verifies that data tables are NOT accessible with only the public anon key.
 * Safe: reads only the `id` of at most 1 row and never prints it; "writes" use a filter
 * that matches nothing (nil UUID), so no data can change even if the request is allowed.
 *
 *   npm run rls:check          (reads .env.local)
 * Exit code 1 if anything is still open.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing (run via `npm run rls:check`).');
  process.exit(2);
}

const TABLES = ['companies', 'contacts', 'training_programs', 'leads', 'lead_activities', 'trainings', 'participants', 'certificates', 'certificate_history'];
const NIL = '00000000-0000-0000-0000-000000000000';
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const denied = status => status === 401 || status === 403;

let open = 0;
for (const table of TABLES) {
  const base = `${url}/rest/v1/${table}`;
  const get = await fetch(`${base}?select=id&limit=1`, { headers });
  let rows = 0;
  if (get.ok) rows = (await get.json().catch(() => [])).length;
  const del = await fetch(`${base}?id=eq.${NIL}`, { method: 'DELETE', headers });
  const patch = await fetch(`${base}?id=eq.${NIL}`, { method: 'PATCH', headers, body: JSON.stringify({ id: NIL }) });

  const readOpen = get.ok && rows > 0;       // empty table + RLS looks the same as no rows: treated as closed
  const readGranted = get.ok;                  // 200 means the role may query (RLS may still hide rows)
  const writeOpen = !denied(del.status) && del.ok || !denied(patch.status) && patch.ok;
  const bad = readOpen || writeOpen;
  if (bad) open++;
  console.log(
    `${bad ? 'OPEN  ' : readGranted ? 'ok*   ' : 'closed'} ${table.padEnd(20)} read:${get.status}${readOpen ? ' (rows visible!)' : ''}  delete:${del.status}  update:${patch.status}`
  );
}
console.log(
  open
    ? `\n${open} table(s) are still reachable without signing in. Run supabase_rls_hardening.sql.`
    : '\nNo data is reachable with the anon key. (ok* = request allowed by privileges but RLS shows no rows)'
);
process.exit(open ? 1 : 0);
