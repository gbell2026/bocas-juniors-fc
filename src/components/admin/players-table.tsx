'use client'
import { useState } from 'react'
import { updatePlayerStatus } from '@/app/actions/admin'
import { adminMarkCashPaid } from '@/app/actions/payment'
import type { Player } from '@/lib/supabase/types'

type PlayerWithParent = Player & {
  parents: { name: string; email: string }
  lastPaidAt: string | null
}

export function PlayersTable({ players }: { players: PlayerWithParent[] }) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { status: string; returnDate: string }>>({})

  function getEdit(p: Player) {
    return edits[p.id] ?? { status: p.status, returnDate: p.return_date ?? '' }
  }

  async function handleStatusSave(p: PlayerWithParent) {
    const { status, returnDate } = getEdit(p)
    setUpdating(p.id)
    await updatePlayerStatus(p.id, status as import('@/lib/supabase/types').PlayerStatus, returnDate || undefined)
    setUpdating(null)
    window.location.reload()
  }

  async function handleMarkCashPaid(p: PlayerWithParent) {
    setUpdating(p.id)
    await adminMarkCashPaid({ playerId: p.id, parentId: p.parent_id, adminNotes: 'Marked paid at training' })
    setUpdating(null)
    window.location.reload()
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-brand-creamAlt">
          <tr>
            {['Player', 'Position', 'DOB', 'Parent', 'Status', 'Return Date', 'Last Paid', 'Actions'].map(h => (
              <th key={h} className="text-left p-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map(p => {
            const edit = getEdit(p)
            const needsReturnDate = edit.status === 'injured' || edit.status === 'away'
            return (
              <tr key={p.id} className="border-t align-top">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">{p.position}</td>
                <td className="p-3">{p.date_of_birth}</td>
                <td className="p-3">{p.parents?.name}</td>
                <td className="p-3">
                  <select
                    value={edit.status}
                    disabled={updating === p.id}
                    onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...edit, status: e.target.value } }))}
                    className="border rounded p-1 text-sm"
                  >
                    {['active', 'inactive', 'injured', 'away'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  {needsReturnDate ? (
                    <input
                      type="date"
                      value={edit.returnDate}
                      onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...edit, returnDate: e.target.value } }))}
                      className="border rounded p-1 text-sm"
                    />
                  ) : (p.return_date ?? '—')}
                </td>
                <td className="p-3">{p.lastPaidAt ? new Date(p.lastPaidAt).toLocaleDateString() : '—'}</td>
                <td className="p-3 space-y-1">
                  <button
                    onClick={() => handleStatusSave(p)}
                    disabled={updating === p.id}
                    className="btn-primary text-xs block w-full"
                  >Save Status</button>
                  <button
                    onClick={() => handleMarkCashPaid(p)}
                    disabled={updating === p.id}
                    className="btn-secondary text-xs block w-full"
                  >Mark Cash Paid</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
