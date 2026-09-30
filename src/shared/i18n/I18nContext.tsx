/**
 * GulfHive ERP - React I18n Context Provider
 * Guarantees proper LTR/RTL layout switching and document synchronization.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { i18n, SupportedLanguage, Direction } from './i18n.ts';

interface I18nContextType {
  language: SupportedLanguage;
  direction: Direction;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (date: Date | string, includeTime?: boolean) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLang] = useState<SupportedLanguage>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('gulfhive_lang') : null;
      if (saved === 'ar' || saved === 'en') {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return 'en';
  });

  // Synchronously update i18n instance before child rendering
  i18n.setLanguage(language);

  const direction: Direction = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    try {
      localStorage.setItem('gulfhive_lang', language);
    } catch {
      // Ignore storage errors
    }
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    if (language === 'ar') {
      document.body.classList.add('font-arabic');
    } else {
      document.body.classList.remove('font-arabic');
    }
  }, [language, direction]);

  const setLanguage = (lang: SupportedLanguage) => {
    i18n.setLanguage(lang);
    setLang(lang);
  };

  const toggleLanguage = () => {
    setLang((prev) => {
      const next = prev === 'en' ? 'ar' : 'en';
      i18n.setLanguage(next);
      return next;
    });
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    return i18n.t(key, params, language);
  };

  const formatDate = (date: Date | string, includeTime?: boolean) => {
    return i18n.formatDate(date, includeTime, language);
  };

  return (
    <I18nContext.Provider value={{ language, direction, setLanguage, toggleLanguage, t, formatDate }}>
      <div dir={direction} className={direction === 'rtl' ? 'rtl text-right font-arabic' : 'ltr text-left'}>
        {children}
      </div>
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
