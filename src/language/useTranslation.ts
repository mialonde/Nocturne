import { useMemo } from 'react'
import { useNocturneStore } from '../store/useNocturneStore'
import { translate } from './index'
import type { TranslationKey, TranslationValues } from './index'

export interface Translator {
  language: string
  t: (key: TranslationKey, values?: TranslationValues) => string
}

export function useTranslation(): Translator {
  const language = useNocturneStore((state) => state.language)
  return useMemo(
    () => ({
      language,
      t: (key, values) => translate(language, key, values),
    }),
    [language],
  )
}
