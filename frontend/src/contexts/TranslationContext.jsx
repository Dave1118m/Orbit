import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://localhost:7065/api/v1';

const TranslationContext = createContext({
  language: 'en',
  setLanguage: () => {},
  translate: async () => {},
  cache: {},
});

export function TranslationProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem('orbit_language') || 'en');
  const [cache, setCache] = useState({});

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

export function useTranslationContext() {
  return useContext(TranslationContext);
}

// ── 100% Dynamic AutoText Component ──
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
