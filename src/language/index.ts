import { en } from './en'
import type { LanguageCode, TranslationValues } from './types'
import type { Messages, TranslationKey } from './en'

export const DEFAULT_LANGUAGE: LanguageCode = 'en'

/**
 * Add a locale by creating `xx.ts` with the same `TranslationKey` shape,
 * importing it here, and adding its code to `LANGUAGES` in `types.ts`.
 */
export const LOCALES: Record<LanguageCode, Messages> = {
  en,
}

function interpolate(message: string, values?: TranslationValues): string {
  if (!values) return message
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = values[key]
    return value === undefined ? placeholder : String(value)
  })
}

export function translate(
  language: LanguageCode,
  key: TranslationKey,
  values?: TranslationValues,
): string {
  const catalogue = LOCALES[language] ?? LOCALES[DEFAULT_LANGUAGE]
  const message = catalogue[key] ?? LOCALES[DEFAULT_LANGUAGE][key] ?? key
  return interpolate(message, values)
}

export type { LanguageCode, TranslationKey, TranslationValues }
