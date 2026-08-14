import type { Metadata } from 'next'
import { Barlow_Condensed, Inter } from 'next/font/google'
import { Nav } from '@/components/nav'
import { getLocale } from '@/lib/i18n/get-locale'
import { LocaleProvider } from '@/lib/i18n/locale-context'
import './globals.css'

const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: '600', variable: '--font-barlow-condensed' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Tangerine Toucans',
  description: 'Youth football club in Bocas del Toro, Panama',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html lang={locale}>
      <body className={`${barlowCondensed.variable} ${inter.variable} font-body`}>
        <LocaleProvider initialLocale={locale}>
          <Nav />
          {children}
        </LocaleProvider>
      </body>
    </html>
  )
}
