'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { getRegFeeAlertForUser } from '@/app/actions/payment'

const socialLinks = [
  {
    href: 'https://www.facebook.com/people/Tangerine-Toucans-FC/61592807065798/',
    label: 'Facebook',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
      </svg>
    ),
  },
  {
    href: 'https://www.instagram.com/tangerinetoucans/',
    label: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
]

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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

  // Close the mobile menu automatically after navigating to a new page.
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  async function handleLogout() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const authLinks = user ? (
    <>
      <Link
        href="/profile"
        className="bg-brand-charcoal border border-brand-mutedLight/30 text-white px-4 py-1.5 rounded hover:border-brand-primary transition text-center"
      >
        My Profile
      </Link>
      <button
        onClick={handleLogout}
        className="text-white/60 hover:text-white transition text-left md:text-center"
      >
        Log Out
      </button>
    </>
  ) : (
    <Link href="/login" className="bg-brand-primary text-white px-4 py-1.5 rounded text-center">
      Log In
    </Link>
  )

  return (
    <>
      <nav className="bg-brand-ink border-b-[3px] border-brand-primary px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Image src="/logo-white-bg.png" width={48} height={48} alt="Tangerine Toucans" />
          </Link>
          <div className="flex items-center gap-2">
            {socialLinks.map(({ href, label, icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-white/75 hover:text-white transition"
              >
                {icon}
              </a>
            ))}
          </div>
        </div>

        {/* Desktop nav links — hidden below md, where the hamburger menu takes over */}
        <div className="hidden md:flex items-center gap-5 text-xs font-bold uppercase tracking-wider">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? 'text-brand-primary' : 'text-white/75 hover:text-white transition'}
            >
              {label}
            </Link>
          ))}
          {authLinks}
        </div>

        {/* Mobile hamburger toggle */}
        <button
          onClick={() => setMobileMenuOpen(open => !open)}
          className="md:hidden text-white p-1"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile menu panel */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-brand-ink border-b-[3px] border-brand-primary px-4 py-4 flex flex-col gap-4 text-xs font-bold uppercase tracking-wider">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? 'text-brand-primary' : 'text-white/75 hover:text-white transition'}
            >
              {label}
            </Link>
          ))}
          <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
            {authLinks}
          </div>
        </div>
      )}

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
