'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { createBrowserClient } from '@/lib/supabase/client'
import { getAnnouncements } from '@/app/actions/announcements'
import { AnnouncementCard } from '@/components/announcements/announcement-card'
import { useLocale } from '@/lib/i18n/locale-context'

type AnnouncementWithComments = Awaited<ReturnType<typeof getAnnouncements>>[number]

export default function AnnouncementsPage() {
  const { t } = useLocale()
  const [announcements, setAnnouncements] = useState<AnnouncementWithComments[] | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    getAnnouncements().then(setAnnouncements).catch(() => setAnnouncements([]))
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user)).catch(() => setIsLoggedIn(false))
  }, [])

  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title={t.announcements.title} subtitle={t.announcements.subtitle} />
      <div className="py-8 px-4 max-w-2xl mx-auto space-y-6">
        {announcements === null ? (
          <p className="text-brand-muted text-center py-8">{t.announcements.loading}</p>
        ) : announcements.length === 0 ? (
          <p className="text-brand-muted text-center py-8">{t.announcements.empty}</p>
        ) : (
          announcements.map(a => (
            <AnnouncementCard key={a.id} announcement={a} isLoggedIn={isLoggedIn} />
          ))
        )}
      </div>
    </main>
  )
}
