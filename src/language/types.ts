export const LANGUAGES = ['en', 'tr', 'ru', 'ar', 'ja', 'zh'] as const

export type LanguageCode = (typeof LANGUAGES)[number]

export type TranslationValues = Record<string, string | number>

export interface LanguageOption {
  value: LanguageCode
  label: string
  nativeName: string
  dir: 'ltr' | 'rtl'
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { value: 'en', label: 'English', nativeName: 'English', dir: 'ltr' },
  { value: 'tr', label: 'Turkish', nativeName: 'Türkçe', dir: 'ltr' },
  { value: 'ru', label: 'Russian', nativeName: 'Русский', dir: 'ltr' },
  { value: 'ar', label: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  { value: 'ja', label: 'Japanese', nativeName: '日本語', dir: 'ltr' },
  { value: 'zh', label: 'Simplified Chinese', nativeName: '简体中文', dir: 'ltr' },
] as const

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}
