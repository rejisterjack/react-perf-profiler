/**
 * Lightweight i18n utility.
 *
 * Usage:
 *   import { t } from '@/shared/i18n';
 *   t('welcome.title')              // → "React Perf Profiler"
 *   t('recording.stopped', { count: 42 })  // → "42 commits captured"
 *
 * To add a new locale:
 *   1. Create `src/shared/i18n/<locale>.ts` mirroring the `en.ts` shape.
 *   2. Register it via `registerLocale('fr', frTranslations)`.
 *   3. Call `setLocale('fr')`.
 */

import en, { type TranslationKey } from './en';

export type Locale = string;
export type TranslationMap = Record<string, string>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const locales = new Map<Locale, TranslationMap>();
locales.set('en', en as unknown as TranslationMap);

let currentLocale: Locale = 'en';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register a locale's translations.
 */
export function registerLocale(locale: Locale, translations: TranslationMap): void {
  locales.set(locale, translations);
}

/**
 * Switch the active locale at runtime.
 * Falls back to 'en' if the locale is not registered.
 */
export function setLocale(locale: Locale): void {
  if (locales.has(locale)) {
    currentLocale = locale;
  } else {
    console.warn(`[i18n] Locale "${locale}" not registered, falling back to "en"`);
    currentLocale = 'en';
  }
}

/**
 * Get the current locale identifier.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Resolve a translation key to its localized string.
 *
 * Supports simple interpolation: `{varName}` tokens in the translation
 * string are replaced with values from the `params` object.
 *
 * @param key - Dot-separated translation key (must exist in en.ts)
 * @param params - Optional interpolation parameters
 * @returns Localized string, or the raw key as fallback
 */
export function t(key: TranslationKey | string, params?: Record<string, string | number>): string {
  const map = locales.get(currentLocale) ?? (locales.get('en') as TranslationMap);
  let value = map[key];

  if (!value) {
    // Fallback to English
    const enMap = locales.get('en') as TranslationMap;
    value = enMap?.[key];
  }

  if (!value) {
    return key;
  }

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return value;
}

/**
 * Returns all registered locale identifiers.
 */
export function getAvailableLocales(): Locale[] {
  return Array.from(locales.keys());
}

/**
 * Checks if a key exists in the current locale or English fallback.
 */
export function hasKey(key: string): boolean {
  const map = locales.get(currentLocale);
  const enMap = locales.get('en');
  return !!(map?.[key] ?? enMap?.[key]);
}

export type { TranslationKey };
