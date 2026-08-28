import { getPracticeBanner } from '@/app/actions/practice-banner'
import { PracticeBannerView } from '@/components/practice-banner-view'

/** Server component: reads the current setting and renders the banner if active. */
export async function PracticeBanner() {
  const { active, date, reason } = await getPracticeBanner()
  if (!active) return null
  return <PracticeBannerView date={date} reason={reason} />
}
