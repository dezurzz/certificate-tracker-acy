'use client';

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { en } from './en';

import { type Language, LANGUAGE_COOKIE } from './config';

export type { Language };

export type TranslateVars = Record<string, string | number | null | undefined>;
export type TFunction = (key: string, vars?: TranslateVars) => string;

interface LanguageContextType {
  language: Language;
  /** BCP-47 locale for Intl / toLocale*String. */
  locale: string;
  /** Persists the choice in a cookie and reloads so server + client render the same language. */
  setLanguage: (lang: Language) => void;
  t: TFunction;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export { msg } from './msg';

const warned = new Set<string>();

function interpolate(text: string, vars?: TranslateVars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name] ?? '') : match));
}

/**
 * Source text in the code is Indonesian; it is the dictionary key.
 *   t('Simpan')                          -> "Save" in English
 *   t('Halo {name}', { name: 'Budi' })   -> placeholders are filled in both languages
 * A key missing from `en` falls back to the Indonesian text (and warns in dev).
 */
export function createT(language: Language): TFunction {
  return (key, vars) => {
    let text = key;
    if (language === 'en') {
      const hit = en[key];
      if (hit !== undefined) text = hit;
      else if (process.env.NODE_ENV !== 'production' && !warned.has(key)) {
        warned.add(key);
        console.warn(`[i18n] missing English translation: "${key}"`);
      }
    }
    return interpolate(text, vars);
  };
}

export function LanguageProvider({ initialLanguage, children }: { initialLanguage: Language; children: React.ReactNode }) {
  const language = initialLanguage;

  const setLanguage = useCallback(
    (next: Language) => {
      if (next === language) return;
      document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      window.location.reload();
    },
    [language]
  );

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      locale: language === 'en' ? 'en-GB' : 'id-ID',
      setLanguage,
      t: createT(language),
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

/** Shorthand for `useLanguage().t`. */
export function useT(): TFunction {
  return useLanguage().t;
}
