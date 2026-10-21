export const LANGUAGES = ['en'] as const

export type LanguageCode = (typeof LANGUAGES)[number]

export type TranslationValues = Record<string, string | number>

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}
