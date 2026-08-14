'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { getStaffMembers } from '@/app/actions/staff'
import { StaffCard } from '@/components/team/staff-card'

type Staff = Awaited<ReturnType<typeof getStaffMembers>>

export default function TeamPage() {
  const [staff, setStaff] = useState<Staff | null>(null)

  useEffect(() => {
    getStaffMembers().then(setStaff).catch(() => setStaff([]))
  }, [])

  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title="Our Team" subtitle="Coaches & Admin Staff" />
      <div className="py-8 px-4 max-w-4xl mx-auto">
        {staff === null ? (
          <p className="text-brand-muted text-center py-8">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="text-brand-muted text-center py-8">No staff members listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {staff.map(s => <StaffCard key={s.id} staff={s} />)}
          </div>
        )}
      </div>
    </main>
  )
}
