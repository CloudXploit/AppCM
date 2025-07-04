"use client";

import React, { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from './config';

interface I18nProviderProps {
  children: React.ReactNode;
  locale?: string;
}

export function I18nProvider({ children, locale }: I18nProviderProps) {
  useEffect(() => {
    if (locale && locale !== i18n.language) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}