import i18n from 'i18next';
import { initReactI18next, useTranslation as useReactI18nextTranslation } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import ta from './locales/ta.json';
import api from './services/api';

// Retrieve stored language or fallback to 'en'
const storedLang = (typeof window !== 'undefined' && localStorage.getItem('baaki_language')) || 'en';
const initialLang = ['en', 'hi', 'ta'].includes(storedLang) ? storedLang : 'en';

// Set document html lang attribute immediately (prevents flash of wrong language)
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLang;
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en,
      hi,
      ta
    },
    lng: initialLang,
    fallbackLng: 'en',
    defaultNS: 'common',
    fallbackNS: [
      'common',
      'dashboard',
      'invoices',
      'customers',
      'payments',
      'followups',
      'inbox',
      'forecast',
      'settings',
      'pay',
      'documents',
      'chase_reasons',
      'errors',
      'statuses'
    ],
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false
    }
  });

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
    localStorage.setItem('baaki_language', lng);
  }
});

/**
 * Changes language across the app, persists to localStorage,
 * updates <html lang>, and syncs with backend settings.
 */
export async function setAppLanguage(lang) {
  if (!['en', 'hi', 'ta'].includes(lang)) return;
  await i18n.changeLanguage(lang);
  if (typeof window !== 'undefined') {
    localStorage.setItem('baaki_language', lang);
  }
  // Try persisting to backend settings if user is in an active session
  try {
    const token = typeof window !== 'undefined' ? (sessionStorage.getItem('baaki_auth_token') || localStorage.getItem('baaki_auth_token')) : null;
    if (token) {
      await api.put('/settings', { language: lang });
    }
  } catch (err) {
    // Non-critical background sync
  }
}

/**
 * Universal useTranslation hook providing t, language, and setLanguage.
 */
export function useTranslation(ns) {
  const { t: baseT, i18n: i18nInstance } = useReactI18nextTranslation(ns);

  const t = (key, fallbackOrParams, maybeParams) => {
    let params = {};
    let fallback = '';

    if (typeof fallbackOrParams === 'object' && fallbackOrParams !== null) {
      params = fallbackOrParams;
    } else if (typeof fallbackOrParams === 'string') {
      fallback = fallbackOrParams;
      if (typeof maybeParams === 'object' && maybeParams !== null) {
        params = maybeParams;
      }
    }

    // If key has dot notation matching a known namespace (e.g. 'pay.title' -> 'pay:title')
    if (key.includes('.')) {
      const parts = key.split('.');
      const first = parts[0];
      const rest = parts.slice(1).join('.');
      const colonKey = `${first}:${rest}`;
      const res = baseT(colonKey, { ...params, defaultValue: '' });
      if (res && res !== colonKey) {
        return res;
      }
    }

    // Try direct translation with params
    const translated = baseT(key, { ...params, defaultValue: fallback });
    if (translated && translated !== key) {
      return translated;
    }

    // If key not found in primary namespace, check across other known namespaces
    for (const otherNs of ['common', 'dashboard', 'invoices', 'customers', 'payments', 'followups', 'inbox', 'forecast', 'settings', 'pay', 'documents', 'statuses', 'errors', 'chase_reasons']) {
      const fullNsKey = `${otherNs}:${key}`;
      const res = baseT(fullNsKey, { ...params, defaultValue: '' });
      if (res && res !== fullNsKey) {
        return res;
      }
    }

    return fallback || key;
  };

  return {
    t,
    i18n: i18nInstance,
    language: i18nInstance.language,
    setLanguage: setAppLanguage
  };
}

export default i18n;
