'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { getRegFeeAlertForUser } from '@/app/actions/payment'

const links = [
  { href: '/', label: 'Home' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/league', label: 'League' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/team', label: 'Our Team' },
  { href: '/register', label: 'Register' },
  { href: '/contact', label: 'Contact' },
]

export function Nav() {
  const pathname = usePathname()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [regFeeUnpaid, setRegFeeUnpaid] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    if (!user) { setRegFeeUnpaid(false); return }
    getRegFeeAlertForUser(user.id)
      .then(alert => setRegFeeUnpaid(alert !== null && !alert.regFeePaid))
      .catch(err => console.error('Failed to check registration fee status:', err))
  }, [user])

  async function handleLogout() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <>
      <nav className="bg-brand-ink border-b-[3px] border-brand-primary px-4 py-3 flex items-center justify-between">
        <Link href="/">
          <Image src="/logo-white-bg.png" width={48} height={48} alt="Tangerine Toucans" />
        </Link>
        <div className="flex items-center gap-5 text-xs font-bold uppercase tracking-wider">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? 'text-brand-primary' : 'text-white/75 hover:text-white transition'}
            >
              {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                href="/profile"
                className="bg-brand-charcoal border border-brand-mutedLight/30 text-white px-4 py-1.5 rounded hover:border-brand-primary transition"
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
      {regFeeUnpaid && (
        <div className="bg-brand-primary text-white text-center text-xs sm:text-sm font-bold uppercase tracking-wider py-2 px-4 flex items-center justify-center gap-3 flex-wrap">
          <span>Registration fee outstanding</span>
          <Link href="/profile" className="underline underline-offset-2 hover:no-underline">
            Pay Now →
          </Link>
        </div>
      )}
    </>
  )
}
