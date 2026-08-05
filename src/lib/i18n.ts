import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import zh from './locales/zh.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    // Fallback chain: when a key is missing in the active language, try zh first
    // (zh is the source-of-truth for new keys — see audit-launch-2026-08-06.md P1).
    // Then en as final fallback. If a key is missing in both, i18next renders
    // the raw key string.
    fallbackLng: ['zh', 'en'],
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
