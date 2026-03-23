'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

const links = [
  { href: '/', label: 'Home' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/register', label: 'Register' },
  { href: '/contact', label: 'Contact' },
]

export function Nav() {
  const pathname = usePathname()
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  async function handleLogout() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav className="bg-brand-dark border-b-[3px] border-brand-cyan px-4 py-3 flex items-center justify-between">
      <Link href="/">
        <Image src="/logo.png" width={48} height={48} alt="Bocas Juniors FC" />
      </Link>
      <div className="flex items-center gap-5 text-xs font-bold uppercase tracking-wider">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? 'text-brand-cyan' : 'text-white/75 hover:text-white transition'}
          >
            {label}
          </Link>
        ))}
        {user ? (
          <>
            <Link
              href="/profile"
              className="bg-brand-surface border border-brand-border text-white px-4 py-1.5 rounded hover:border-brand-cyan transition"
            >
              My Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-white/60 hover:text-white transition"
            >
              Log Out
            </button>
          </>
        ) : (
          <Link href="/login" className="bg-brand-primary text-white px-4 py-1.5 rounded">
            Log In
          </Link>
        )}
      </div>
    </nav>
  )
}
