/**
 * GulfHive ERP - Core Translation & Localization Engine
 * Supports LTR/RTL, translation keys, parameter interpolation, and GCC localization rules.
 */

import { enTranslations } from './translations/en.ts';
import { arTranslations } from './translations/ar.ts';

export type SupportedLanguage = 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

export class I18nService {
  private currentLanguage: SupportedLanguage = 'en';

  constructor(initialLanguage: SupportedLanguage = 'en') {
    this.currentLanguage = initialLanguage;
  }

  public get language(): SupportedLanguage {
    return this.currentLanguage;
  }

  public get direction(): Direction {
    return this.currentLanguage === 'ar' ? 'rtl' : 'ltr';
  }

  public setLanguage(lang: SupportedLanguage): void {
    this.currentLanguage = lang;
  }

  public t(key: string, params?: Record<string, string | number>, lang?: SupportedLanguage): string {
    const currentLang = lang || this.currentLanguage;
    const dictionary = currentLang === 'ar' ? arTranslations : enTranslations;
    let translation = dictionary[key] || enTranslations[key] || key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        translation = translation.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }
    }

    return translation;
  }

  public formatDate(date: Date | string, includeTime = false, lang?: SupportedLanguage): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const currentLang = lang || this.currentLanguage;
    const locale = currentLang === 'ar' ? 'ar-KW' : 'en-US';
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
  }
}

export const i18n = new I18nService('en');
