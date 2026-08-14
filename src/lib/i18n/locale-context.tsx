'use client'
import { createContext, useContext, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from './locale'
import { en } from './en'
import { es } from './es'

const dictionaries = { en, es }

type LocaleContextValue = { locale: Locale; t: typeof en; setLocale: (l: Locale) => void }

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const router = useRouter()

  function setLocale(next: Locale) {
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`
    setLocaleState(next)
    router.refresh()
  }

  return (
    <LocaleContext.Provider value={{ locale, t: dictionaries[locale], setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
