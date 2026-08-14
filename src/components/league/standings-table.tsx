'use client'
import { useEffect, useState } from 'react'
import { getStandings } from '@/app/actions/league'
import { cloudinaryUrl } from '@/lib/cloudinary-url'
import { useLocale } from '@/lib/i18n/locale-context'

type StandingsRow = Awaited<ReturnType<typeof getStandings>>[number]

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

  return (
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
          {rows.map((row, index) => (
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
              <td className="p-2 font-bold">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
