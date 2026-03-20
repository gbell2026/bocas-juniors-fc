'use client'
import Link from 'next/link'
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
  const [user, setUser] = useState<any>(null)

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
    <nav className="bg-brand-primary text-white px-4 py-3 flex items-center justify-between">
      <Link href="/" className="font-bold text-lg">Bocas Juniors FC</Link>
      <div className="flex items-center gap-4 text-sm">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`hover:underline ${pathname === href ? 'font-semibold' : ''}`}
          >
            {label}
          </Link>
        ))}
        {user ? (
          <>
            <Link href="/profile" className="hover:underline">My Profile</Link>
            <button onClick={handleLogout} className="hover:underline">Log Out</button>
          </>
        ) : (
          <Link href="/login" className="hover:underline">Log In</Link>
        )}
      </div>
    </nav>
  )
}
