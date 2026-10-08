// Verifies that every Material Symbols icon used in src/ is in ICON_NAMES
// (src/lib/icons.ts). The icon font is a subset: a name missing from the list
// renders as plain text instead of an icon. Run: npm run icons:check
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

// quoted names, skipping comparisons like `theme === 'dark'`
const quoted = text => [...text.matchAll(/(?<![=!]==?\s*)['"`]([a-z][a-z0-9_]*)['"`]/g)].map(m => m[1]);
const patterns = [
  { re: /material-symbols-outlined[^>]*>\s*([a-z][a-z0-9_]*)\s*</g, names: m => [m[1]] },
  { re: /material-symbols-outlined[^>]*>\s*\{([^}]*)\}\s*</g, names: m => quoted(m[1]) },
  { re: /\bicon(?:Right)?\s*[=:]\s*['"]([a-z][a-z0-9_]*)['"]/g, names: m => [m[1]] },
  { re: /\bicon(?:Right)?\s*=\s*\{([^{}]*)\}/g, names: m => quoted(m[1]) },
  { re: /\bicon\s*:\s*([^,}\n]+)/g, names: m => quoted(m[1]) },
];

const used = new Map(); // name -> first file
for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8');
  for (const { re, names } of patterns) {
    for (const m of src.matchAll(re)) {
      for (const n of names(m)) if (!used.has(n)) used.set(n, file.replace(root + '/', 'src/'));
    }
  }
}

const iconsSrc = readFileSync(join(root, 'lib/icons.ts'), 'utf8');
const listed = new Set([...iconsSrc.matchAll(/'([a-z][a-z0-9_]*)'/g)].map(m => m[1]));
const missing = [...used.entries()].filter(([n]) => !listed.has(n));

if (missing.length) {
  console.error(`Icons used but missing from ICON_NAMES in src/lib/icons.ts (${missing.length}):`);
  for (const [n, f] of missing) console.error(`  ${n}  <- ${f}`);
  console.error('Add them (alphabetical) so the icon font includes them.');
  process.exit(1);
}
console.log(`icons: ${used.size} used, ${listed.size} listed. OK`);
