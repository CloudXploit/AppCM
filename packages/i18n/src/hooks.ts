import { useTranslation as useTranslationBase } from 'react-i18next';
import { TKey } from './types';

export function useTranslation() {
  const { t, i18n, ready } = useTranslationBase();

  const translate = (key: TKey, options?: any) => {
    return t(key, options);
  };

  return {
    t: translate,
    i18n,
    ready,
    language: i18n.language,
    changeLanguage: i18n.changeLanguage.bind(i18n),
  };
}

export function useLanguage() {
  const { i18n } = useTranslationBase();

  return {
    currentLanguage: i18n.language,
    supportedLanguages: i18n.languages,
    changeLanguage: i18n.changeLanguage.bind(i18n),
    isRTL: i18n.dir() === 'rtl',
  };
}