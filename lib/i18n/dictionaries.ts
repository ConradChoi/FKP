import type { Dictionary, Locale } from './types'
import { en } from './en'
import { ja } from './ja'

const dictionaries: Record<Locale, Dictionary> = { en, ja }

export const locales: Locale[] = ['en', 'ja']

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale]
}
