'use client'
import { useState } from 'react'
import { updatePlayerStatus, updatePlayerPaymentPlan, updatePlayerAgeGroups, cancelPlayer, restorePlayer, deletePlayer } from '@/app/actions/admin'
import { adminMarkCashPaid } from '@/app/actions/payment'
import { AGE_GROUPS } from '@/lib/age-groups'
import type { Player, PaymentPlan } from '@/lib/supabase/types'

type PlayerWithParent = Player & {
  parents: { name: string; email: string }
  lastPaidAt: string | null
  regFeePaid: boolean
  hasPayments: boolean
}

export function PlayersTable({ players }: { players: PlayerWithParent[] }) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { status: string; returnDate: string; paymentPlan: PaymentPlan; ageGroups: string[] }>>({})

  function getEdit(p: PlayerWithParent) {
    return edits[p.id] ?? { status: p.status, returnDate: p.return_date ?? '', paymentPlan: p.payment_plan, ageGroups: p.age_groups }
  }

  function toggleAgeGroup(p: PlayerWithParent, group: string) {
    const edit = getEdit(p)
    const ageGroups = edit.ageGroups.includes(group)
      ? edit.ageGroups.filter(g => g !== group)
      : [...edit.ageGroups, group]
    setEdits(prev => ({ ...prev, [p.id]: { ...edit, ageGroups } }))
  }

  async function handleStatusSave(p: PlayerWithParent) {
    const { status, returnDate, paymentPlan, ageGroups } = getEdit(p)
    setUpdating(p.id)
    await updatePlayerStatus(p.id, status as import('@/lib/supabase/types').PlayerStatus, returnDate || undefined)
    await updatePlayerPaymentPlan(p.id, paymentPlan)
    await updatePlayerAgeGroups(p.id, ageGroups)
    setUpdating(null)
    window.location.reload()
  }

  async function handleMarkCashPaid(p: PlayerWithParent) {
    setUpdating(p.id)
    await adminMarkCashPaid({ playerId: p.id, parentId: p.parent_id, adminNotes: 'Marked paid at training' })
    setUpdating(null)
    window.location.reload()
  }

  async function handleCancel(p: PlayerWithParent) {
    setUpdating(p.id)
    await cancelPlayer(p.id)
    setUpdating(null)
    window.location.reload()
  }

  async function handleRestore(p: PlayerWithParent) {
    setUpdating(p.id)
    await restorePlayer(p.id)
    setUpdating(null)
    window.location.reload()
  }

  async function handleDelete(p: PlayerWithParent) {
    if (!window.confirm('Permanently delete this player? This cannot be undone.')) return
    setUpdating(p.id)
    const result = await deletePlayer(p.id)
    setUpdating(null)
    if (result.error) { window.alert(result.error); return }
    window.location.reload()
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-brand-creamAlt">
          <tr>
            {['Player', 'Position', 'Age Group', 'DOB', 'Parent', 'Plan', 'Reg. Fee', 'Status', 'Return Date', 'Last Paid', 'Actions'].map(h => (
              <th key={h} className="text-left p-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map(p => {
            const edit = getEdit(p)
            const needsReturnDate = edit.status === 'injured' || edit.status === 'away'
            return (
              <tr key={p.id} className={`border-t align-top ${p.status === 'cancelled' ? 'opacity-60' : ''}`}>
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">{p.position}</td>
                <td className="p-3">
                  <div className="flex flex-col gap-0.5">
                    {AGE_GROUPS.map(group => (
                      <label key={group} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={edit.ageGroups.includes(group)}
                          disabled={updating === p.id}
                          onChange={() => toggleAgeGroup(p, group)}
                        />
                        {group}
                      </label>
                    ))}
                  </div>
                </td>
                <td className="p-3">{p.date_of_birth}</td>
                <td className="p-3">{p.parents?.name}</td>
                <td className="p-3">
                  {/* Known limitation: switching a player's plan after they've made payments under
                      the old plan can make their reg-fee/amount-due status look wrong, since
                      paid-installment labels don't get relabeled. Acceptable for MVP; revisit if
                      this bites a real family. */}
                  <select
                    value={edit.paymentPlan}
                    disabled={updating === p.id}
                    onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...edit, paymentPlan: e.target.value as PaymentPlan } }))}
                    className="border rounded p-1 text-sm"
                  >
                    {['full', 'monthly'].map(plan => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <span className={p.regFeePaid ? 'text-green-600 font-medium' : 'text-brand-primary font-medium'}>
                    {p.regFeePaid ? 'Paid' : 'Outstanding'}
                  </span>
                </td>
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
                  {p.status === 'cancelled' ? (
                    <button
                      onClick={() => handleRestore(p)}
                      disabled={updating === p.id}
                      className="btn-primary text-xs block w-full"
                    >Restore</button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStatusSave(p)}
                        disabled={updating === p.id}
                        className="btn-primary text-xs block w-full"
                      >Save Changes</button>
                      <button
                        onClick={() => handleMarkCashPaid(p)}
                        disabled={updating === p.id}
                        className="btn-secondary text-xs block w-full"
                      >Mark Cash Paid</button>
                      {p.hasPayments ? (
                        <button
                          onClick={() => handleCancel(p)}
                          disabled={updating === p.id}
                          className="text-xs px-3 py-1.5 border border-brand-primary text-brand-primary rounded font-bold uppercase tracking-wider hover:bg-brand-primary hover:text-white transition disabled:opacity-50 w-full"
                        >Cancel</button>
                      ) : (
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={updating === p.id}
                          className="text-xs px-3 py-1.5 border border-red-600 text-red-600 rounded font-bold uppercase tracking-wider hover:bg-red-600 hover:text-white transition disabled:opacity-50 w-full"
                        >Delete</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
