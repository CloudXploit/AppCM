"use client";

import React from 'react';
import { useLanguage } from '../hooks';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  className?: string;
}

const languageNames: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ja: '日本語',
  zh: '中文',
};

export function LanguageSelector({ className }: LanguageSelectorProps) {
  const { currentLanguage, supportedLanguages, changeLanguage } = useLanguage();

  return (
    <div className={className}>
      <div className="relative">
        <select
          value={currentLanguage}
          onChange={(e) => changeLanguage(e.target.value)}
          className="appearance-none bg-transparent border border-input rounded-md pl-10 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Select language"
        >
          {supportedLanguages.map((lang) => (
            <option key={lang} value={lang}>
              {languageNames[lang] || lang}
            </option>
          ))}
        </select>
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}