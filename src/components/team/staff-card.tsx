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

// Compact horizontal header (photo + name/role) so the card stays scannable
// in a grid — the richer fields (background, qualifications, philosophy,
// favourite team, fun fact) are hidden behind a "Read more" drawer instead
// of always rendering inline, since a fully filled-out bio otherwise turns
// every card into a wall of text.
export function StaffCard({ staff: s }: { staff: StaffMember }) {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const hasMore = !!(s.background || s.qualifications || s.philosophy || s.favouriteTeam || s.funFact)

  return (
    <div className="bg-brand-tint border border-brand-line rounded-lg p-4">
      <div className="flex items-center gap-4">
        {s.photoCloudinaryPublicId ? (
          <img
            src={cloudinaryUrl(s.photoCloudinaryPublicId, 160)}
            alt={s.name}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-brand-tint flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-heading text-brand-ink uppercase tracking-wide truncate">{s.name}</p>
          <p className="text-brand-primaryDeep text-xs font-bold uppercase tracking-wider mt-0.5">{s.roleTitle}</p>
          {s.nationality && <p className="text-brand-mutedWarm text-xs mt-0.5 truncate">{s.nationality}</p>}
        </div>
      </div>

      {s.oneLineIntro && <p className="text-brand-ink/90 text-sm italic mt-3">{s.oneLineIntro}</p>}
      <p className="text-brand-ink/80 text-sm mt-2">{s.bio}</p>

      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          className="text-brand-primaryDeep text-xs font-bold uppercase tracking-wider mt-3 underline"
        >
          {expanded ? `${t.team.showLess} ▲` : `${t.team.readMore} ▼`}
        </button>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-brand-line space-y-2">
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
