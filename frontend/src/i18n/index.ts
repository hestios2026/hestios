import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ro from './ro';
import de from './de';
import en from './en';

i18n.use(initReactI18next).init({
  resources: {
    ro: { translation: ro },
    de: { translation: de },
    en: { translation: en },
  },
  lng: localStorage.getItem('hestios_lang') || 'ro',
  fallbackLng: 'ro',
  interpolation: { escapeValue: false },
});

export default i18n;
