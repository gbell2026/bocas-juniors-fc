'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { createBrowserClient } from '@/lib/supabase/client'
import { getAnnouncements } from '@/app/actions/announcements'
import { AnnouncementCard } from '@/components/announcements/announcement-card'

type AnnouncementWithComments = Awaited<ReturnType<typeof getAnnouncements>>[number]

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementWithComments[] | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    getAnnouncements().then(setAnnouncements).catch(() => setAnnouncements([]))
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user)).catch(() => setIsLoggedIn(false))
  }, [])

  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title="Announcements" subtitle="Club News & Updates" />
      <div className="py-8 px-4 max-w-2xl mx-auto space-y-6">
        {announcements === null ? (
          <p className="text-brand-muted text-center py-8">Loading announcements…</p>
        ) : announcements.length === 0 ? (
          <p className="text-brand-muted text-center py-8">No announcements yet.</p>
        ) : (
          announcements.map(a => (
            <AnnouncementCard key={a.id} announcement={a} isLoggedIn={isLoggedIn} />
          ))
        )}
      </div>
    </main>
  )
}
