/**
 * Marks a string as a translation key without translating it yet. Use it in
 * module-level constants (where hooks are unavailable), then call `t(value)` at render:
 *   const TABS = [{ label: msg('Ringkasan') }];  ...  {t(tab.label)}
 */
export const msg = <T extends string>(key: T): T => key;
