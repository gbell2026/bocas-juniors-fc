import type { Metadata } from 'next'
import { getKickoffFlyer } from '@/app/actions/flyer'
import { getLocale } from '@/lib/i18n/get-locale'
import { KickoffFlyer } from '@/components/flyer/kickoff-flyer'

// Always render fresh so the flyer reflects the current fixture list.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sunday Kick-Off — Tangerine Toucans FC',
  description: "This Sunday's league fixtures, location and teams.",
}

export default async function FlyerPage() {
  const [flyer, locale] = await Promise.all([getKickoffFlyer(), getLocale()])
  return <KickoffFlyer flyer={flyer} locale={locale} />
}
