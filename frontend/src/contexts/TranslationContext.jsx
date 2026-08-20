import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://localhost:7065/api/v1';

/**
 * Context for multi-language translation and localization.
 */
const TranslationContext = createContext({
  language: 'en',
  setLanguage: () => {},
  translate: async () => {},
  cache: {},
});

/**
 * Provider component for internationalization (i18n), managing active language state,
 * caching translated strings in-memory and in localStorage, and adding typography classes.
 * @param {{ children: React.ReactNode }} props
 */
export function TranslationProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem('orbit_language') || 'en');
  const [cache, setCache] = useState({});

  /**
   * Updates active UI language, persists selection in localStorage, and toggles body font classes.
   * @param {string} lang - Language code ('en', 'am', etc.).
   */
  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem('orbit_language', lang);
    if (lang === 'am') {
      document.documentElement.classList.add('lang-amharic');
    } else {
      document.documentElement.classList.remove('lang-amharic');
    }
  };

  useEffect(() => {
    if (language === 'am') {
      document.documentElement.classList.add('lang-amharic');
    } else {
      document.documentElement.classList.remove('lang-amharic');
    }
  }, [language]);

  /**
   * Asynchronously translates a given English string to the active target language.
   * Uses client memory cache for 0ms re-renders before calling `/api/v1/translation/translate`.
   * @param {string} text - The source English text.
   * @param {string} [targetLang=language] - The target language ISO code.
   * @returns {Promise<string>} The translated text.
   */
  const translate = async (text, targetLang = language) => {
    if (!text || typeof text !== 'string' || targetLang === 'en') return text;

    const trimmed = text.trim();
    if (!trimmed) return text;

    // Client memory cache check for fast 0ms re-renders
    const cacheKey = `${targetLang}:${trimmed}`;
    if (cache[cacheKey]) return cache[cacheKey];

    // Dynamic API call to backend (which also checks Redis cache!)
    try {
      const resp = await fetch(`${API_BASE}/translation/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, sourceLanguage: 'en', targetLanguage: targetLang })
      });

      if (resp.ok) {
        const data = await resp.json();
        const result = data.translatedText || text;
        setCache(prev => ({ ...prev, [cacheKey]: result }));
        return result;
      }
    } catch (err) {
      console.warn('Translation API error:', err);
    }

    return text;
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, translate, cache }}>
      {children}
    </TranslationContext.Provider>
  );
}

/**
 * Custom React hook to consume the TranslationContext.
 * @returns {{
 *   language: string,
 *   setLanguage: (lang: string) => void,
 *   translate: (text: string, targetLang?: string) => Promise<string>,
 *   cache: Object
 * }}
 */
export function useTranslationContext() {
  return useContext(TranslationContext);
}

/**
 * Auto-translating UI text wrapper component that dynamically translates its text prop at runtime.
 * @param {{
 *   text: string|number,
 *   fallback?: string,
 *   className?: string
 * }} props
 */
export function AutoText({ text, fallback, className = '' }) {
  const { language, translate, cache } = useTranslationContext();
  const strValue = (text !== undefined && text !== null) ? String(text) : '';
  const trimmed = strValue.trim();

  const cacheKey = `${language}:${trimmed}`;
  const [translatedText, setTranslatedText] = useState(() => {
    if (language === 'en' || !trimmed) return strValue;
    return cache[cacheKey] || strValue;
  });

  useEffect(() => {
    let isMounted = true;

    if (!trimmed || language === 'en') {
      setTranslatedText(strValue);
      return;
    }

    if (cache[cacheKey]) {
      setTranslatedText(cache[cacheKey]);
      return;
    }

    translate(trimmed, language).then(res => {
      if (isMounted) setTranslatedText(res || fallback || strValue);
    });

    return () => { isMounted = false; };
  }, [text, language, cacheKey]);

  return <span className={className}>{translatedText}</span>;
}
