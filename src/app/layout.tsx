import type { Metadata } from 'next'
import { Barlow_Condensed, Inter } from 'next/font/google'
import { Nav } from '@/components/nav'
import './globals.css'

const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: '600', variable: '--font-barlow-condensed' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Tangerine Toucans',
  description: 'Youth football club in Bocas del Toro, Panama',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${barlowCondensed.variable} ${inter.variable} font-body`}>
        <Nav />
        {children}
      </body>
    </html>
  )
}
