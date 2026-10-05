// Checks the permission matrix in src/lib/permissions.ts (roles x actions x pages).
// Run: npm run permissions:check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const source = readFileSync(fileURLToPath(new URL('../src/lib/permissions.ts', import.meta.url)), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { can, canAccessPath, homePath, parseRole } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

let fail = 0;
const eq = (name, got, want) => { if (got !== want) { fail++; console.log('FAIL', name, 'got', got, 'want', want); } };

// parseRole
eq('parse unknown', parseRole('superuser'), 'viewer');
eq('parse undefined', parseRole(undefined), 'viewer');
eq('parse staff', parseRole('staff'), 'staff');

// admin: everything
for (const a of ['data.write','delete.lead','delete.training','delete.certificate','delete.directory','settings.system','users.manage'])
  eq('admin '+a, can('admin', a), true);

// staff
eq('staff write', can('staff','data.write'), true);
eq('staff delete own lead', can('staff','delete.lead',{ownerId:'u1',userId:'u1'}), true);
eq('staff delete other lead', can('staff','delete.lead',{ownerId:'u2',userId:'u1'}), false);
eq('staff delete legacy lead', can('staff','delete.lead',{ownerId:null,userId:'u1'}), false);
eq('staff delete w/o user', can('staff','delete.lead',{ownerId:'u1'}), false);
eq('staff delete own certificate', can('staff','delete.certificate',{ownerId:'u1',userId:'u1'}), true);
eq('staff delete directory', can('staff','delete.directory',{ownerId:'u1',userId:'u1'}), false);
eq('staff settings', can('staff','settings.system'), false);
eq('staff users', can('staff','users.manage'), false);

// read-only roles
for (const r of ['executive','viewer'])
  for (const a of ['data.write','delete.lead','delete.directory','settings.system','users.manage'])
    eq(r+' '+a, can(r, a, {ownerId:'u1',userId:'u1'}), false);

// pages
eq('staff /crm/leads', canAccessPath('staff','/crm/leads'), true);
eq('staff /settings/system', canAccessPath('staff','/settings/system'), false);
eq('viewer /settings/users', canAccessPath('viewer','/settings/users'), false);
eq('admin /settings/system', canAccessPath('admin','/settings/system'), true);
eq('exec /executive', canAccessPath('executive','/executive'), true);
eq('exec /reports', canAccessPath('executive','/reports'), true);
eq('exec /crm/reports', canAccessPath('executive','/crm/reports'), true);
eq('exec /crm/leads', canAccessPath('executive','/crm/leads'), false);
eq('exec /trainings/abc', canAccessPath('executive','/trainings/abc'), false);
eq('exec /certificates', canAccessPath('executive','/certificates'), false);
eq('exec /dashboard', canAccessPath('executive','/dashboard'), false);
eq('exec /settings/profile', canAccessPath('executive','/settings/profile'), true);
eq('exec /settings/system', canAccessPath('executive','/settings/system'), false);
eq('exec /reportsX (prefix trap)', canAccessPath('executive','/reportsX'), false);
eq('exec /crm/reports-old (prefix trap)', canAccessPath('executive','/crm/reports-old'), false);
eq('home exec', homePath('executive'), '/executive');
eq('home staff', homePath('staff'), '/dashboard');
if (fail) { console.error(fail + ' permission checks FAILED'); process.exit(1); }
console.log('permissions: all checks passed');
