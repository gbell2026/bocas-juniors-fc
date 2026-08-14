'use client'
import { useLocale } from '@/lib/i18n/locale-context'

export function LanguageToggle() {
  const { locale, setLocale } = useLocale()
  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      <button
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
        className={`px-2 py-0.5 rounded text-xs font-bold ${locale === 'en' ? 'bg-brand-primary text-white' : 'text-white/60 hover:text-white'}`}
      >
        EN
      </button>
      <button
        aria-pressed={locale === 'es'}
        onClick={() => setLocale('es')}
        className={`px-2 py-0.5 rounded text-xs font-bold ${locale === 'es' ? 'bg-brand-primary text-white' : 'text-white/60 hover:text-white'}`}
      >
        ES
      </button>
    </div>
  )
}
