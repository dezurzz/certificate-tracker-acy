// Shared comparators for the list pages. Text uses the Indonesian collation
// (case/accent-insensitive, "Batch 2" before "Batch 10"); empty values always
// sort last so blank rows never lead the list.
const collator = new Intl.Collator('id', { sensitivity: 'base', numeric: true });

export const cmpText = (a?: string | null, b?: string | null) => {
  const x = (a ?? '').trim();
  const y = (b ?? '').trim();
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return collator.compare(x, y);
};

const time = (v?: string | null) => {
  const n = v ? Date.parse(v) : NaN;
  return Number.isNaN(n) ? null : n;
};

/** Ascending date compare (oldest first); missing dates last. */
export const cmpDate = (a?: string | null, b?: string | null) => {
  const x = time(a);
  const y = time(b);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return x - y;
};

/** Descending date compare (newest first); missing dates last. */
export const cmpDateDesc = (a?: string | null, b?: string | null) => {
  const x = time(a);
  const y = time(b);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return y - x;
};

export const cmpNumberDesc = (a?: number | null, b?: number | null) => (b ?? 0) - (a ?? 0);
