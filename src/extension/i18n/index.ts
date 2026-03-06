import { type Locales } from '../../Options'
import zhCN from './zh-CN'
import enUS from './en-US'

const locales: Record<string, Locales> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

function registerLocale(locale: string, ls: Locales): void {
  locales[locale] = { ...locales[locale], ...ls }
}

function getSupportedLocales(): string[] {
  return Object.keys(locales)
}

function i18n(key: string, locale: string): string {
  return locales[locale]?.[key] ?? key
}

export { i18n, registerLocale, getSupportedLocales }
