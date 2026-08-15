'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { useLocale } from '@/lib/i18n/locale-context'
import { getUserRole } from '@/app/actions/auth'

export default function LoginPage() {
  const { t } = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const supabase = createBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: fd.get('email') as string,
      password: fd.get('password') as string,
    })
    setLoading(false)
    if (error) {
      // Supabase's error text isn't a stable contract to string-match against —
      // only the one well-known message gets a specific translation, anything
      // else falls back to a generic translated error.
      setError(error.message === 'Invalid login credentials' ? t.login.invalidCredentials : t.login.error)
      return
    }
    const { data: { user: signedInUser } } = await supabase.auth.getUser()
    const role = signedInUser ? await getUserRole(signedInUser.id) : null
    router.push(role === 'coach' ? '/roster' : '/profile')
  }

  return (
    <main className="bg-brand-cream min-h-screen py-12 px-4">
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
        <h1 className="font-heading text-2xl uppercase tracking-wide text-brand-ink">{t.login.title}</h1>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">{t.login.emailLabel}</label>
          <input id="email" name="email" type="email" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">{t.login.passwordLabel}</label>
          <input id="password" name="password" type="password" required className="input w-full" />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t.login.loggingIn : t.login.submit}
        </button>
        <p className="text-sm text-center">
          {t.login.notRegistered} <a href="/register" className="underline">{t.login.registerHere}</a>
        </p>
      </form>
    </main>
  )
}
