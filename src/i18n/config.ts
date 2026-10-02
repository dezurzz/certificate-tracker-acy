export type Language = 'id' | 'en';

export const LANGUAGE_COOKIE = 'bki_lang';
export const DEFAULT_LANGUAGE: Language = 'id';

export function isLanguage(value: unknown): value is Language {
  return value === 'id' || value === 'en';
}
