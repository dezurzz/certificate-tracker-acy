// End-to-end check of the per-role row level security (supabase_rls_roles.sql).
// Creates temporary accounts (admin, two staff, executive, viewer) with the service key, signs in as
// each over the real REST API and tries the allowed AND forbidden operations of every rule, then
// removes everything it created (also when a check fails).
// Run: npm run roles:check      (needs NEXT_PUBLIC_SUPABASE_URL, ..._ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local)

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const RUN = Math.random().toString(36).slice(2, 8);
const PASSWORD = 'Rls-Check-' + RUN + '!9';
const TAG = 'RLS TEST ' + RUN;

async function api(path, { method = 'GET', key = SERVICE, token, body, prefer } = {}) {
  const res = await fetch(URL + path, {
    method,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + (token || key),
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json };
}

const rest = (table, o = {}) =>
  api(`/rest/v1/${table}${o.query ? '?' + o.query : ''}`, { ...o, prefer: o.prefer ?? 'return=representation', key: o.token ? ANON : SERVICE });

// ---- accounts
const users = {};
async function makeUser(name, role) {
  const email = `rls.${name}.${RUN}@example.com`;
  const r = await api('/auth/v1/admin/users', { method: 'POST', body: { email, password: PASSWORD, email_confirm: true, app_metadata: { role } } });
  if (r.status >= 300) throw new Error(`create ${name}: ${JSON.stringify(r.json)}`);
  const login = await api('/auth/v1/token?grant_type=password', { method: 'POST', key: ANON, body: { email, password: PASSWORD } });
  if (!login.json?.access_token) throw new Error(`login ${name}: ${JSON.stringify(login.json)}`);
  users[name] = { id: r.json.id, email, role, token: login.json.access_token };
}

// ---- tiny test runner
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : '  -> ' + detail}`);
}
const denied = r => r.status >= 400 && (r.json?.code === '42501' || r.status === 401 || r.status === 403);
const rows = r => (Array.isArray(r.json) ? r.json : []);
const as = name => users[name].token;

const lead = (extra = {}) => ({
  contact_name: TAG, contact_phone: '0800000000', company_name: 'PRIBADI', program_name: 'RLS',
  estimated_seats: 1, status: 'Baru', source: 'WA Bisnis', pic_staff_name: 'rls', next_follow_up_date: '2026-12-31', ...extra,
});
const training = (extra = {}) => ({
  program_name: TAG, batch_code: 'RLS-' + Math.random().toString(36).slice(2, 7),
  start_date: '2026-10-01', end_date: '2026-10-02', location: 'x', status: 'Processing', ...extra,
});

async function main() {
  await makeUser('admin', 'admin');
  await makeUser('staff1', 'staff');
  await makeUser('staff2', 'staff');
  await makeUser('executive', 'executive');
  await makeUser('viewer', 'viewer');

  // Seed "legacy" rows (no owner) with the service key
  const legacyLead = rows(await rest('leads', { method: 'POST', body: lead({ contact_phone: 'legacy' }) }))[0];
  const legacyTraining = rows(await rest('trainings', { method: 'POST', body: training() }))[0];
  const participant = rows(await rest('participants', { method: 'POST', body: { name: TAG, company: 'RLS', registration_number: 'RLS-1' } }))[0];
  const cert = (trainingId, n, token) => rest('certificates', {
    method: 'POST', token,
    body: { training_id: trainingId, participant_id: participant.id, certificate_type: 'Attendance', certificate_number: `${TAG}-${n}`, status: 'Pending', sla_age_days: 0 },
  });
  const legacyCert = rows(await cert(legacyTraining.id, 'legacy'))[0];
  if (!legacyLead || !legacyTraining || !participant || !legacyCert) throw new Error('seeding failed');

  console.log(`\n== reading`);
  for (const u of Object.keys(users)) {
    const r = await rest('leads', { token: as(u), query: `id=eq.${legacyLead.id}&select=id` });
    check(`${u} can read leads`, r.status === 200 && rows(r).length === 1, JSON.stringify(r.json));
  }
  const settingsRead = await rest('app_settings', { token: as('viewer'), query: 'select=key' });
  check('viewer can read app_settings', settingsRead.status === 200);

  console.log(`\n== viewer and executive are read-only`);
  for (const u of ['viewer', 'executive']) {
    check(`${u} cannot insert a lead`, denied(await rest('leads', { method: 'POST', token: as(u), body: lead() })));
    check(`${u} cannot insert a company`, denied(await rest('companies', { method: 'POST', token: as(u), body: { name: TAG } })));
    const upd = await rest('leads', { method: 'PATCH', token: as(u), query: `id=eq.${legacyLead.id}`, body: { notes: 'x' } });
    check(`${u} cannot update a lead`, rows(upd).length === 0 || denied(upd), JSON.stringify(upd.json));
    const del = await rest('leads', { method: 'DELETE', token: as(u), query: `id=eq.${legacyLead.id}` });
    check(`${u} cannot delete a lead`, rows(del).length === 0 || denied(del), JSON.stringify(del.json));
    check(`${u} cannot insert certificate_history`, denied(await rest('certificate_history', { method: 'POST', token: as(u), body: { certificate_id: legacyCert.id, previous_status: 'Pending', new_status: 'Processing', changed_by: 'x', note: 'x' } })));
  }

  console.log(`\n== staff: write, ownership stamping`);
  const own = await rest('leads', { method: 'POST', token: as('staff1'), body: lead({ contact_phone: 'own1' }) });
  const ownLead = rows(own)[0];
  check('staff1 can insert a lead', own.status === 201 && ownLead, JSON.stringify(own.json));
  check('new lead is stamped with the creator (created_by = staff1)', ownLead?.created_by === users.staff1.id, String(ownLead?.created_by));
  check('staff1 cannot insert a lead owned by someone else', denied(await rest('leads', { method: 'POST', token: as('staff1'), body: lead({ created_by: users.staff2.id }) })));
  const updLegacy = await rest('leads', { method: 'PATCH', token: as('staff1'), query: `id=eq.${legacyLead.id}`, body: { notes: 'edited by staff1' } });
  check('staff1 can update any lead (including legacy)', rows(updLegacy).length === 1, JSON.stringify(updLegacy.json));
  const steal = await rest('leads', { method: 'PATCH', token: as('staff1'), query: `id=eq.${legacyLead.id}`, body: { created_by: users.staff1.id } });
  check('staff1 cannot take ownership of a legacy lead (created_by stays empty)', rows(steal)[0]?.created_by === null, JSON.stringify(steal.json));
  const act = await rest('lead_activities', { method: 'POST', token: as('staff1'), body: { lead_id: ownLead.id, action_type: 'created', note: 't', actor: 't', new_status: 'Baru' } });
  check('staff1 can add a lead activity', act.status === 201, JSON.stringify(act.json));
  const co = await rest('companies', { method: 'POST', token: as('staff1'), body: { name: TAG } });
  check('staff1 can add a company', co.status === 201, JSON.stringify(co.json));

  console.log(`\n== staff: deletes follow ownership`);
  const actId = rows(act)[0]?.id;
  const actDelOther = await rest('lead_activities', { method: 'DELETE', token: as('staff2'), query: `id=eq.${actId}` });
  check("staff2 cannot delete an activity of staff1's lead", rows(actDelOther).length === 0, JSON.stringify(actDelOther.json));
  const delOther = await rest('leads', { method: 'DELETE', token: as('staff2'), query: `id=eq.${ownLead.id}` });
  check("staff2 cannot delete staff1's lead", rows(delOther).length === 0, JSON.stringify(delOther.json));
  const delLegacy = await rest('leads', { method: 'DELETE', token: as('staff1'), query: `id=eq.${legacyLead.id}` });
  check('staff1 cannot delete a legacy lead (no owner)', rows(delLegacy).length === 0, JSON.stringify(delLegacy.json));
  const delOwn = await rest('leads', { method: 'DELETE', token: as('staff1'), query: `id=eq.${ownLead.id}` });
  check('staff1 can delete their own lead (activities cascade)', rows(delOwn).length === 1, JSON.stringify(delOwn.json));
  const actLeft = await rest('lead_activities', { query: `lead_id=eq.${ownLead.id}&select=id` });
  check('the lead activities went with it', rows(actLeft).length === 0);
  const coDel = await rest('companies', { method: 'DELETE', token: as('staff1'), query: `id=eq.${rows(co)[0]?.id}` });
  check('staff1 cannot delete a company (admin only)', rows(coDel).length === 0, JSON.stringify(coDel.json));

  console.log(`\n== staff: batches (delete cascades to certificates)`);
  const t1 = rows(await rest('trainings', { method: 'POST', token: as('staff1'), body: training() }))[0];
  const c1 = rows(await cert(t1.id, 'own', as('staff1')))[0];
  check('staff1 can create a batch and a certificate in it', t1?.created_by === users.staff1.id && c1?.created_by === users.staff1.id);
  const hist = await rest('certificate_history', { method: 'POST', token: as('staff1'), body: { certificate_id: c1.id, previous_status: 'Pending', new_status: 'Processing', changed_by: 'staff1', note: 'x' } });
  check('staff1 can append certificate_history', hist.status === 201, JSON.stringify(hist.json));
  const histId = rows(hist)[0]?.id;
  const histUpd = await rest('certificate_history', { method: 'PATCH', token: as('staff1'), query: `id=eq.${histId}`, body: { note: 'tampered' } });
  check('certificate_history cannot be edited', rows(histUpd).length === 0 || denied(histUpd), JSON.stringify(histUpd.json));
  const histDel = await rest('certificate_history', { method: 'DELETE', token: as('staff1'), query: `id=eq.${histId}` });
  check('certificate_history cannot be deleted directly', rows(histDel).length === 0 || denied(histDel), JSON.stringify(histDel.json));
  const certUpd = await rest('certificates', { method: 'PATCH', token: as('staff2'), query: `id=eq.${c1.id}`, body: { status: 'Processing' } });
  check("staff2 can change the status of staff1's certificate", rows(certUpd).length === 1, JSON.stringify(certUpd.json));
  const t1DelOther = await rest('trainings', { method: 'DELETE', token: as('staff2'), query: `id=eq.${t1.id}` });
  check("staff2 cannot delete staff1's batch", rows(t1DelOther).length === 0, JSON.stringify(t1DelOther.json));

  const t2 = rows(await rest('trainings', { method: 'POST', token: as('staff1'), body: training() }))[0];
  await cert(t2.id, 'foreign'); // a certificate created by someone else (service key = no owner)
  const t2Del = await rest('trainings', { method: 'DELETE', token: as('staff1'), query: `id=eq.${t2.id}` });
  check('staff1 cannot delete own batch when it contains certificates they do not own', rows(t2Del).length === 0, JSON.stringify(t2Del.json));
  const t1Del = await rest('trainings', { method: 'DELETE', token: as('staff1'), query: `id=eq.${t1.id}` });
  check('staff1 can delete own batch when every certificate is theirs', rows(t1Del).length === 1, JSON.stringify(t1Del.json));
  const c1Left = await rest('certificates', { query: `id=eq.${c1.id}&select=id` });
  check('the certificate and its history cascaded away', rows(c1Left).length === 0);

  console.log(`\n== settings: admin only`);
  check('staff cannot insert an app_setting', denied(await rest('app_settings', { method: 'POST', token: as('staff1'), body: { key: 'rls_test_a', value: 1 } })));
  const adminSetting = await rest('app_settings', { method: 'POST', token: as('admin'), body: { key: 'rls_test_' + RUN, value: 1 } });
  check('admin can insert an app_setting', adminSetting.status === 201, JSON.stringify(adminSetting.json));
  const setUpd = await rest('app_settings', { method: 'PATCH', token: as('staff1'), query: `key=eq.rls_test_${RUN}`, body: { value: 2 } });
  check('staff cannot update an app_setting', rows(setUpd).length === 0 || denied(setUpd), JSON.stringify(setUpd.json));

  console.log(`\n== admin: everything`);
  const aLead = rows(await rest('leads', { method: 'POST', token: as('admin'), body: lead() }))[0];
  check('admin can insert a lead (stamped with admin)', aLead?.created_by === users.admin.id);
  const reassign = await rest('leads', { method: 'PATCH', token: as('admin'), query: `id=eq.${aLead.id}`, body: { created_by: users.staff1.id } });
  check('admin can reassign ownership', rows(reassign)[0]?.created_by === users.staff1.id, JSON.stringify(reassign.json));
  const adminDelLeg = await rest('leads', { method: 'DELETE', token: as('admin'), query: `id=eq.${legacyLead.id}` });
  check('admin can delete a legacy lead', rows(adminDelLeg).length === 1, JSON.stringify(adminDelLeg.json));
  const adminDelCo = await rest('companies', { method: 'DELETE', token: as('admin'), query: `id=eq.${rows(co)[0]?.id}` });
  check('admin can delete a company', rows(adminDelCo).length === 1, JSON.stringify(adminDelCo.json));
  const adminDelT2 = await rest('trainings', { method: 'DELETE', token: as('admin'), query: `id=eq.${t2.id}` });
  check('admin can delete any batch', rows(adminDelT2).length === 1, JSON.stringify(adminDelT2.json));
}

async function cleanup() {
  console.log('\n== cleanup');
  const del = (table, query) => rest(table, { method: 'DELETE', query, prefer: 'return=minimal' });
  await del('leads', `contact_name=like.${encodeURIComponent(TAG + '%')}`);
  await del('trainings', `program_name=like.${encodeURIComponent(TAG + '%')}`);
  await del('participants', `name=like.${encodeURIComponent(TAG + '%')}`);
  await del('companies', `name=like.${encodeURIComponent(TAG + '%')}`);
  await del('app_settings', `key=like.rls_test_%25`);
  for (const u of Object.values(users)) await api(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' });
  const left = await api('/auth/v1/admin/users?per_page=200');
  const stray = (left.json?.users || []).filter(u => (u.email || '').includes(`.${RUN}@`));
  console.log(stray.length ? `WARNING: ${stray.length} temp account(s) left` : 'temporary accounts and rows removed');
}

try {
  await main();
} catch (e) {
  console.error('\nSETUP ERROR:', e.message);
  results.push({ name: 'setup', ok: false });
} finally {
  await cleanup();
}
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
