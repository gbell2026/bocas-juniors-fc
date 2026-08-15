'use client'
import { useState } from 'react'
import { cloudinaryUrl } from '@/lib/cloudinary-url'
import type { getStaffMembers } from '@/app/actions/staff'
import { useLocale } from '@/lib/i18n/locale-context'

type StaffMember = Awaited<ReturnType<typeof getStaffMembers>>[number]

function DetailBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-brand-primaryDeep text-[10px] font-bold uppercase tracking-wider">{label}</p>
      <p className="text-brand-ink/80 text-sm mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

// Centered "roster card" look — photo/name/role/nationality only. Everything
// else (intro, bio, and the richer optional fields) sits behind a single
// "Read more" toggle so a grid of many cards stays scannable at a glance.
export function StaffCard({ staff: s }: { staff: StaffMember }) {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-brand-tint border border-brand-line rounded-lg p-5 text-center">
      {s.photoCloudinaryPublicId ? (
        <img
          src={cloudinaryUrl(s.photoCloudinaryPublicId, 200)}
          alt={s.name}
          className="w-24 h-24 rounded-full object-cover mx-auto"
        />
      ) : (
        <div className="w-24 h-24 rounded-full bg-brand-tint mx-auto" />
      )}
      <p className="font-heading text-brand-ink uppercase tracking-wide mt-3">{s.name}</p>
      <p className="text-brand-primaryDeep text-xs font-bold uppercase tracking-wider mt-0.5">{s.roleTitle}</p>
      {s.nationality && <p className="text-brand-mutedWarm text-xs mt-0.5">{s.nationality}</p>}

      <button
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        className="text-brand-primaryDeep text-xs font-bold uppercase tracking-wider mt-3 underline"
      >
        {expanded ? `${t.team.showLess} ▲` : `${t.team.readMore} ▼`}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-brand-line space-y-2 text-left">
          {s.oneLineIntro && <p className="text-brand-ink/90 text-sm italic">{s.oneLineIntro}</p>}
          <p className="text-brand-ink/80 text-sm">{s.bio}</p>
          <DetailBlock label={t.team.background} value={s.background} />
          <DetailBlock label={t.team.qualifications} value={s.qualifications} />
          <DetailBlock label={t.team.philosophy} value={s.philosophy} />
          <DetailBlock label={t.team.favouriteTeam} value={s.favouriteTeam} />
          <DetailBlock label={t.team.funFact} value={s.funFact} />
        </div>
      )}
    </div>
  )
}
