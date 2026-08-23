'use client'
import { Fragment, useState } from 'react'
import { updatePlayerStatus, updatePlayerPaymentPlan, updatePlayerAgeGroups, cancelPlayer, restorePlayer, deletePlayer } from '@/app/actions/admin'
import type { PaymentStatusInfo } from '@/app/actions/admin'
import { adminMarkCashPaid } from '@/app/actions/payment'
import { AGE_GROUPS } from '@/lib/age-groups'
import type { Player, PaymentPlan } from '@/lib/supabase/types'
import type { MonthlyStatus } from '@/lib/payment-schedule'

type PlayerWithParent = Player & {
  parents: { name: string; email: string }
  lastPaidAt: string | null
  regFeePaid: boolean
  hasPayments: boolean
  paymentStatus: PaymentStatusInfo
  monthlyStatus: MonthlyStatus[]
}

const installmentLabelText: Record<string, string> = {
  full: 'Season Fee', august: 'August', september: 'September', october: 'October', november: 'November',
}

const monthAbbrev: Record<string, string> = {
  august: 'Aug', september: 'Sep', october: 'Oct', november: 'Nov',
}

function MonthlyStatusRow({ monthlyStatus }: { monthlyStatus: MonthlyStatus[] }) {
  return (
    <div className="flex gap-2">
      {monthlyStatus.map(({ month, status }) => {
        const style =
          status === 'paid' ? 'bg-green-600 text-white border-green-600'
          : status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-400'
          : status === 'notApplicable' ? 'bg-transparent text-brand-mutedWarm border-brand-line'
          : 'bg-transparent text-brand-muted border-brand-line'
        const symbol = status === 'paid' ? '✓' : status === 'pending' ? '●' : status === 'notApplicable' ? '–' : ''
        return (
          <div
            key={month}
            title={`${monthAbbrev[month]}: ${status === 'notApplicable' ? 'Not applicable' : status}`}
            className={`flex flex-col items-center justify-center w-10 h-10 rounded border text-xs font-bold ${style}`}
          >
            <span>{symbol}</span>
            <span className="text-[9px] font-normal uppercase">{monthAbbrev[month]}</span>
          </div>
        )
      })}
    </div>
  )
}

function paymentStatusText(status: PaymentStatusInfo): string {
  switch (status.kind) {
    case 'paidUp': return 'Paid up'
    case 'awaitingRegistration': return 'Awaiting registration'
    case 'owes': return `Owes $${(status.amountCents / 100).toFixed(2)} (${installmentLabelText[status.label] ?? status.label})`
  }
}

export function PlayersTable({ players }: { players: PlayerWithParent[] }) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { status: string; returnDate: string; paymentPlan: PaymentPlan; ageGroups: string[] }>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
    setErrorMessage(null)
    setUpdating(p.id)
    const result = await deletePlayer(p.id)
    setUpdating(null)
    if (result.error) { setErrorMessage(result.error); return }
    window.location.reload()
  }

  return (
    <>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand-creamAlt">
            <tr>
              {['Player', 'Parent', 'Status', 'Reg. Fee', 'Payment Status', ''].map(h => (
                <th key={h} className="text-left p-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
              const edit = getEdit(p)
              const needsReturnDate = edit.status === 'injured' || edit.status === 'away'
              const isExpanded = expanded.has(p.id)
              const rowClass = p.status === 'cancelled' ? 'opacity-60' : ''
              return (
                <Fragment key={p.id}>
                  <tr className={`border-t align-top ${rowClass}`}>
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{p.parents?.name}</td>
                    <td className="p-3 capitalize">{p.status}</td>
                    <td className="p-3">
                      <span className={p.regFeePaid ? 'text-green-600 font-medium' : 'text-brand-primary font-medium'}>
                        {p.regFeePaid ? 'Paid' : 'Outstanding'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={p.paymentStatus.kind === 'paidUp' ? 'text-green-600 font-medium' : 'text-brand-primary font-medium'}>
                        {paymentStatusText(p.paymentStatus)}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleExpanded(p.id)}
                        className="text-brand-primaryDeep font-bold text-lg leading-none"
                        aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                      >
                        {isExpanded ? '▾' : '▸'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className={`border-t ${rowClass}`}>
                      <td colSpan={6} className="p-4 bg-brand-tint">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-brand-mutedWarm mb-1">Position</p>
                            <p>{p.position}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-brand-mutedWarm mb-1">DOB</p>
                            <p>{p.date_of_birth}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-brand-mutedWarm mb-1">Last Paid</p>
                            <p>{p.lastPaidAt ? new Date(p.lastPaidAt).toLocaleDateString() : '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-brand-mutedWarm mb-1">Age Group</p>
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
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-brand-mutedWarm mb-1">Plan</p>
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
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-brand-mutedWarm mb-1">Status</p>
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
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-brand-mutedWarm mb-1">Return Date</p>
                            {needsReturnDate ? (
                              <input
                                type="date"
                                value={edit.returnDate}
                                onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...edit, returnDate: e.target.value } }))}
                                className="border rounded p-1 text-sm"
                              />
                            ) : (p.return_date ?? '—')}
                          </div>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-brand-mutedWarm mb-1">Payment by Month</p>
                          <MonthlyStatusRow monthlyStatus={p.monthlyStatus} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {p.status === 'cancelled' ? (
                            <button
                              onClick={() => handleRestore(p)}
                              disabled={updating === p.id}
                              className="btn-primary text-xs"
                            >Restore</button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStatusSave(p)}
                                disabled={updating === p.id}
                                className="btn-primary text-xs"
                              >Save Changes</button>
                              <button
                                onClick={() => handleMarkCashPaid(p)}
                                disabled={updating === p.id}
                                className="btn-secondary text-xs"
                              >Mark Cash Paid</button>
                              {p.hasPayments ? (
                                <button
                                  onClick={() => handleCancel(p)}
                                  disabled={updating === p.id}
                                  className="text-xs px-3 py-1.5 border border-brand-primary text-brand-primary rounded font-bold uppercase tracking-wider hover:bg-brand-primary hover:text-white transition disabled:opacity-50"
                                >Cancel</button>
                              ) : (
                                <button
                                  onClick={() => handleDelete(p)}
                                  disabled={updating === p.id}
                                  className="text-xs px-3 py-1.5 border border-red-600 text-red-600 rounded font-bold uppercase tracking-wider hover:bg-red-600 hover:text-white transition disabled:opacity-50"
                                >Delete</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
