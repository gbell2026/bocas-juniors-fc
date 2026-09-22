'use client'
import { useEffect, useState } from 'react'
import { getStandings } from '@/app/actions/league'
import { cloudinaryUrl } from '@/lib/cloudinary-url'
import { useLocale } from '@/lib/i18n/locale-context'

type StandingsRow = Awaited<ReturnType<typeof getStandings>>[number]

// Footnote markers for adjusted teams — cycles through the classic
// typographic sequence, then falls back to plain numbers if a division
// somehow has more than 6 adjusted teams.
const FOOTNOTE_SYMBOLS = ['*', '†', '‡', '§', '¶', '#']
function footnoteMarker(index: number): string {
  return FOOTNOTE_SYMBOLS[index] ?? String(index + 1)
}

export function StandingsTable({ divisionId }: { divisionId: string }) {
  const { t } = useLocale()
  const [rows, setRows] = useState<StandingsRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    getStandings(divisionId)
      .then(data => { if (!cancelled) setRows(data) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [divisionId])

  if (rows === null) return <p className="text-brand-muted py-8 text-center">{t.league.standings.loading}</p>
  if (rows.length === 0) return <p className="text-brand-muted py-8 text-center">{t.league.standings.empty}</p>

  const headers = ['#', t.league.standings.team, t.league.standings.played, t.league.standings.won, t.league.standings.drawn, t.league.standings.lost, t.league.standings.goalDifference, t.league.standings.points]

  // Assign each adjusted team its own footnote marker, in table order, so the
  // reason is spelled out below the table (a hover tooltip alone doesn't work
  // on a touch device, so it can't be the only way to see it).
  const adjustedRows = rows.filter(r => r.adjustmentPoints !== 0)
  const markerByTeamId = new Map(adjustedRows.map((r, i) => [r.teamId, footnoteMarker(i)]))

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand-creamAlt">
            <tr>
              {headers.map(h => (
                <th key={h} className="text-left p-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const marker = markerByTeamId.get(row.teamId)
              const adjustmentColor = row.adjustmentPoints < 0 ? 'text-red-600' : 'text-green-600'
              return (
                <tr key={row.teamId} className="border-t border-brand-line">
                  <td className="p-2 font-bold">{index + 1}</td>
                  <td className="p-2">
                    <span className="flex items-center gap-2">
                      {row.badgeCloudinaryPublicId ? (
                        <img src={cloudinaryUrl(row.badgeCloudinaryPublicId, 40)} alt="" className="w-5 h-5 object-contain" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-brand-tint inline-block" />
                      )}
                      {row.teamName}
                    </span>
                  </td>
                  <td className="p-2">{row.played}</td>
                  <td className="p-2">{row.won}</td>
                  <td className="p-2">{row.drawn}</td>
                  <td className="p-2">{row.lost}</td>
                  <td className="p-2">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                  <td className="p-2 font-bold">
                    {row.points}
                    {marker && <span className={`text-xs align-top ml-0.5 font-bold ${adjustmentColor}`}>{marker}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {adjustedRows.length > 0 && (
        <div className="px-2 py-3 space-y-1 text-xs border-t border-brand-line">
          {adjustedRows.map(row => (
            <p key={row.teamId}>
              <span className={`font-bold mr-1 ${row.adjustmentPoints < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {markerByTeamId.get(row.teamId)}
              </span>
              <span className="font-bold text-brand-ink">{row.teamName}:</span>{' '}
              <span className="text-brand-muted">{row.adjustmentNotes.join('; ')}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
