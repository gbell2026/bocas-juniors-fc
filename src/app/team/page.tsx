'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { getStaffMembers } from '@/app/actions/staff'
import { cloudinaryUrl } from '@/lib/cloudinary-url'

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
            {staff.map(s => (
              <div key={s.id} className="bg-brand-tint border border-brand-line rounded-lg p-5 text-center">
                {s.photoCloudinaryPublicId ? (
                  <img
                    src={cloudinaryUrl(s.photoCloudinaryPublicId, 200)}
                    alt={s.name}
                    className="w-24 h-24 rounded-full object-cover mx-auto mb-3"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-brand-tint mx-auto mb-3" />
                )}
                <p className="font-heading text-brand-ink uppercase tracking-wide">{s.name}</p>
                <p className="text-brand-primaryDeep text-xs font-bold uppercase tracking-wider mt-1">{s.roleTitle}</p>
                <p className="text-brand-ink/80 text-sm mt-3">{s.bio}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
