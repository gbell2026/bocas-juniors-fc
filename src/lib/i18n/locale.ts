export type Locale = 'en' | 'es'
export const DEFAULT_LOCALE: Locale = 'en'

export function parseLocale(value: string | undefined): Locale {
  return value === 'es' ? 'es' : DEFAULT_LOCALE
}
