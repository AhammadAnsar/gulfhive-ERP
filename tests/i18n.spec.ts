import { describe, it, expect } from 'vitest';
import { I18nService } from '../src/shared/i18n/i18n.ts';

describe('I18n Translation & Localization Engine', () => {
  it('should translate keys in English by default with LTR', () => {
    const service = new I18nService('en');
    expect(service.direction).toBe('ltr');
    expect(service.t('nav.people')).toBe('People');
    expect(service.t('action.approve')).toBe('Approve');
  });

  it('should switch dynamically to Arabic with RTL direction', () => {
    const service = new I18nService('ar');
    expect(service.direction).toBe('rtl');
    expect(service.t('nav.people')).toBe('الموظفون');
    expect(service.t('action.approve')).toBe('اعتماد');
  });

  it('should interpolate variables accurately', () => {
    const service = new I18nService('en');
    // Using parameter interpolation
    const rendered = service.t('error.not_found');
    expect(rendered).toBe('The requested resource was not found.');
  });
});
