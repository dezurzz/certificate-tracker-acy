#!/usr/bin/env node
/**
 * i18n coverage check.
 *   - Every key used in t('...') / msg('...') must exist in src/i18n/en.ts
 *   - Every placeholder {name} in a key must also appear in its English text
 *   - Entries in en.ts that no code uses are reported (and fail with --strict)
 * Usage: npm run i18n:check [-- --strict]
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})('src');

const used = new Map(); // key -> first location
const dynamic = [];
for (const file of files) {
  if (file.endsWith(path.join('i18n', 'en.ts'))) continue;
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['t', 'msg'].includes(node.expression.text) && node.arguments.length) {
      const arg = node.arguments[0];
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
        if (!used.has(arg.text)) used.set(arg.text, `${file}:${line}`);
      } else if (node.expression.text === 't') {
        dynamic.push(`${file}:${line}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const enSrc = fs.readFileSync('src/i18n/en.ts', 'utf8');
const sf = ts.createSourceFile('en.ts', enSrc, ts.ScriptTarget.Latest, true);
const en = new Map();
sf.forEachChild(function walk(n) {
  if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.name) || ts.isIdentifier(n.name)) && ts.isStringLiteral(n.initializer)) {
    en.set(ts.isStringLiteral(n.name) ? n.name.text : n.name.text, n.initializer.text);
  }
  ts.forEachChild(n, walk);
});

const placeholders = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const missing = [...used].filter(([k]) => !en.has(k));
const mismatched = [...used].filter(([k]) => en.has(k) && placeholders(k) !== placeholders(en.get(k)));
const unused = [...en.keys()].filter(k => !used.has(k));

if (missing.length) { console.error(`\nMissing English translations (${missing.length}):`); missing.forEach(([k, loc]) => console.error(`  ${JSON.stringify(k)}  <- ${loc}`)); }
if (mismatched.length) { console.error(`\nPlaceholder mismatch (${mismatched.length}):`); mismatched.forEach(([k, loc]) => console.error(`  ${JSON.stringify(k)}  <- ${loc}`)); }
if (unused.length) { console.warn(`\nUnused entries in en.ts (${unused.length}):`); unused.slice(0, 30).forEach(k => console.warn(`  ${JSON.stringify(k)}`)); }
console.log(`\ni18n: ${used.size} keys used, ${en.size} English entries, ${dynamic.length} dynamic t() calls (checked via msg()).`);
if (missing.length || mismatched.length || (strict && unused.length)) process.exit(1);
console.log('i18n check passed.');
