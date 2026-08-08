import React from 'react';
import { useTranslationContext } from '../contexts/TranslationContext';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage } = useTranslationContext();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'am' : 'en');
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={language === 'en' ? 'Switch to Amharic (ወደ አማርኛ ቀይር)' : 'Switch to English'}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${className}`}
    >
      <Globe className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
      <span>{language === 'en' ? 'English' : 'አማርኛ'}</span>
      <span className="ml-0.5 rounded-xs bg-brand-50 px-1 py-0.2 text-[10px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        {language.toUpperCase()}
      </span>
    </button>
  );
}
