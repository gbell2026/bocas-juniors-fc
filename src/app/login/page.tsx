'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
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
    if (error) { setError(error.message); return }
    router.push('/profile')
  }

  return (
    <main className="bg-brand-cream min-h-screen py-12 px-4">
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
        <h1 className="font-heading text-2xl uppercase tracking-wide text-brand-ink">Log In</h1>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" required className="input w-full" />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Logging in…' : 'Log In'}
        </button>
        <p className="text-sm text-center">
          Not registered? <a href="/register" className="underline">Register here</a>
        </p>
      </form>
    </main>
  )
}
