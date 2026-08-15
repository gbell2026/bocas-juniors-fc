'use client'
import { useState } from 'react'
import { adminMarkCashPaid } from '@/app/actions/payment'
import { AGE_GROUPS } from '@/lib/age-groups'
import type { RosterPlayer } from '@/app/actions/roster'

export function RosterList({ players: initial }: { players: RosterPlayer[] }) {
  const [players, setPlayers] = useState(initial)
  const [updating, setUpdating] = useState<string | null>(null)

  async function handleMarkPaid(player: RosterPlayer) {
    setUpdating(player.id)
    try {
      await adminMarkCashPaid({ playerId: player.id, parentId: player.parentId, adminNotes: 'Cash paid directly — marked from roster' })
      setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, hasOutstanding: false } : p))
    } finally {
      setUpdating(null)
    }
  }

  const groups: { label: string; players: RosterPlayer[] }[] = [
    ...AGE_GROUPS.map(group => ({ label: group, players: players.filter(p => p.ageGroups.includes(group)) })),
    { label: 'Unassigned', players: players.filter(p => p.ageGroups.length === 0) },
  ].filter(g => g.players.length > 0)

  if (groups.length === 0) return <p className="text-brand-muted text-sm">No players to show.</p>

  return (
    <div className="space-y-8">
      {groups.map(group => (
        <section key={group.label}>
          <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">{group.label} ({group.players.length})</h2>
          <div className="space-y-2">
            {group.players.map(player => (
              <div key={player.id} className="bg-brand-tint border border-brand-line rounded p-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-brand-ink font-bold text-sm">{player.name}</p>
                  <p className="text-brand-muted text-xs">{player.position}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {player.hasOutstanding && <span className="text-brand-primary text-xs font-bold uppercase tracking-wider">Outstanding</span>}
                  {player.hasOutstanding && (
                    <button
                      onClick={() => handleMarkPaid(player)}
                      disabled={updating === player.id}
                      className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                    >
                      {updating === player.id ? 'Marking…' : 'Mark Paid'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
