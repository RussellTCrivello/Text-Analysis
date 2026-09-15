import React, { createContext, useContext, type ReactNode } from 'react';
import en, { type TranslationShape } from './locales/en';
import ar from './locales/ar';
import type { Language } from '../types';

const locales: Record<Language, TranslationShape> = { en, ar };

export const LanguageContext = createContext<{
  language: Language;
  t: TranslationShape;
}>({ language: 'en', t: en });

export function LanguageProvider({ language, children }: { language: Language; children: ReactNode }) {
  const t = locales[language] ?? en;
  return (
    <LanguageContext.Provider value={{ language, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}

export function addLocale(code: string, translations: TranslationShape) {
  (locales as Record<string, TranslationShape>)[code] = translations;
}

export { type TranslationShape };
