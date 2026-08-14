'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { getStaffMembers } from '@/app/actions/staff'
import { StaffCard } from '@/components/team/staff-card'
import { useLocale } from '@/lib/i18n/locale-context'

type Staff = Awaited<ReturnType<typeof getStaffMembers>>

export default function TeamPage() {
  const { t } = useLocale()
  const [staff, setStaff] = useState<Staff | null>(null)

  useEffect(() => {
    getStaffMembers().then(setStaff).catch(() => setStaff([]))
  }, [])

  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title={t.team.title} subtitle={t.team.subtitle} />
      <div className="py-8 px-4 max-w-4xl mx-auto">
        {staff === null ? (
          <p className="text-brand-muted text-center py-8">{t.common.loading}</p>
        ) : staff.length === 0 ? (
          <p className="text-brand-muted text-center py-8">{t.team.empty}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {staff.map(s => <StaffCard key={s.id} staff={s} />)}
          </div>
        )}
      </div>
    </main>
  )
}
