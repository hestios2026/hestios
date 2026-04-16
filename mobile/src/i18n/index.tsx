import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, type Lang, type Translations } from './translations';

const LANG_KEY = 'hestios_lang';

// Intersection ensures the context type has all keys from both locales
type TR = typeof translations.ro;

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  tr: TR;
}

const LangContext = createContext<LangContextValue>({
  lang: 'ro',
  setLang: () => {},
  tr: translations.ro,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ro');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(stored => {
      if (stored === 'ro' || stored === 'de') setLangState(stored);
    });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, tr: translations[lang] as TR }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
