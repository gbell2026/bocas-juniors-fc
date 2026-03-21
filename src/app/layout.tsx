import type { Metadata } from 'next'
import { Anton, Montserrat } from 'next/font/google'
import { Nav } from '@/components/nav'
import './globals.css'

const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' })

export const metadata: Metadata = {
  title: 'Bocas Juniors FC',
  description: 'Youth football club in Bocas del Toro, Panama',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${anton.variable} ${montserrat.variable} font-body`}>
        <Nav />
        {children}
      </body>
    </html>
  )
}
