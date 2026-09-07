'use client'
import { Fragment, useMemo, useState } from 'react'
import {
  updatePlayerStatus, updatePlayerPaymentPlan, updatePlayerAgeGroups,
  cancelPlayer, restorePlayer, deletePlayer,
  bulkUpdatePlayerStatus, bulkUpdatePlayerPaymentPlan, bulkSetAgeGroup,
} from '@/app/actions/admin'
import type { PaymentStatusInfo } from '@/app/actions/admin'
import { adminMarkCashPaid, bulkMarkCashPaid } from '@/app/actions/payment'
import { AGE_GROUPS } from '@/lib/age-groups'
import type { Player, PaymentPlan, PlayerStatus } from '@/lib/supabase/types'
import type { MonthlyStatus } from '@/lib/payment-schedule'

type PlayerWithParent = Player & {
  parents: { name: string; email: string }
  lastPaidAt: string | null
  regFeePaid: boolean
  hasPayments: boolean
  paymentStatus: PaymentStatusInfo
  monthlyStatus: MonthlyStatus[]
}

const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'] as const
const PAYMENT_FILTERS: { key: PaymentStatusInfo['kind']; label: string }[] = [
  { key: 'paidUp', label: 'Paid up' },
  { key: 'owes', label: 'Owes' },
  { key: 'awaitingRegistration', label: 'Awaiting registration' },
]
const BULK_STATUSES: PlayerStatus[] = ['active', 'inactive', 'injured', 'away']

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

function FilterGroup({
  label, options, selected, onToggle,
}: {
  label: string
  options: readonly { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-mutedWarm">{label}</span>
      {options.map(opt => {
        const on = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            className={`text-xs rounded-full px-2.5 py-1 border transition ${
              on
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'border-brand-line text-brand-muted hover:border-brand-primary'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function PlayersTable({ players }: { players: PlayerWithParent[] }) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { status: string; returnDate: string; paymentPlan: PaymentPlan; ageGroups: string[] }>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [ageFilter, setAgeFilter] = useState<string[]>([])
  const [posFilter, setPosFilter] = useState<string[]>([])
  const [payFilter, setPayFilter] = useState<string[]>([])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'' | 'status' | 'plan' | 'addAge' | 'removeAge' | 'cash'>('')
  const [bulkStatus, setBulkStatus] = useState<PlayerStatus>('active')
  const [bulkReturnDate, setBulkReturnDate] = useState('')
  const [bulkPlan, setBulkPlan] = useState<PaymentPlan>('full')
  const [bulkGroup, setBulkGroup] = useState<string>(AGE_GROUPS[0])
  const [bulkBusy, setBulkBusy] = useState(false)

  const filtered = useMemo(() => players.filter(p =>
    (ageFilter.length === 0 || ageFilter.some(g => (p.age_groups ?? []).includes(g))) &&
    (posFilter.length === 0 || posFilter.includes(p.position)) &&
    (payFilter.length === 0 || payFilter.includes(p.paymentStatus.kind))
  ), [players, ageFilter, posFilter, payFilter])

  const anyFilter = ageFilter.length + posFilter.length + payFilter.length > 0
  const filteredIds = filtered.map(p => p.id)
  const allVisibleSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))

  // Selection is scoped to the current filter — changing a filter clears it so
  // a bulk action can never hit rows you can't see.
  function makeFilterToggler(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    return (value: string) => {
      setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
      setSelected(new Set())
    }
  }
  const toggleAge = makeFilterToggler(setAgeFilter)
  const togglePos = makeFilterToggler(setPosFilter)
  const togglePay = makeFilterToggler(setPayFilter)

  function clearFilters() {
    setAgeFilter([]); setPosFilter([]); setPayFilter([]); setSelected(new Set())
  }

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(filteredIds))
  }

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
    await updatePlayerStatus(p.id, status as PlayerStatus, returnDate || undefined)
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

  async function handleBulkApply() {
    const ids = filteredIds.filter(id => selected.has(id))
    if (ids.length === 0 || !bulkAction) return
    const needsReturn = bulkAction === 'status' && (bulkStatus === 'injured' || bulkStatus === 'away')
    if (needsReturn && !bulkReturnDate) {
      setErrorMessage('Set a return date for injured / away.')
      return
    }
    if (!window.confirm(`Apply this change to ${ids.length} player${ids.length > 1 ? 's' : ''}?`)) return

    setErrorMessage(null)
    setBulkBusy(true)
    try {
      if (bulkAction === 'status') {
        await bulkUpdatePlayerStatus(ids, bulkStatus, needsReturn ? bulkReturnDate : undefined)
      } else if (bulkAction === 'plan') {
        await bulkUpdatePlayerPaymentPlan(ids, bulkPlan)
      } else if (bulkAction === 'addAge' || bulkAction === 'removeAge') {
        await bulkSetAgeGroup(ids, bulkGroup, bulkAction === 'addAge' ? 'add' : 'remove')
      } else if (bulkAction === 'cash') {
        const items = filtered.filter(p => selected.has(p.id)).map(p => ({ playerId: p.id, parentId: p.parent_id }))
        const { skipped } = await bulkMarkCashPaid(items)
        if (skipped > 0) {
          setErrorMessage(`${skipped} player${skipped > 1 ? 's' : ''} had nothing due and were skipped.`)
        }
      }
      window.location.reload()
    } catch {
      setErrorMessage('The bulk update failed. Please try again.')
      setBulkBusy(false)
    }
  }

  const selectedCount = filteredIds.filter(id => selected.has(id)).length

  return (
    <>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      {/* Filters */}
      <div className="bg-brand-creamAlt border border-brand-line rounded p-3 mb-3 flex flex-col gap-2">
        <FilterGroup
          label="Age group"
          options={AGE_GROUPS.map(g => ({ value: g, label: g }))}
          selected={ageFilter}
          onToggle={toggleAge}
        />
        <FilterGroup
          label="Position"
          options={POSITIONS.map(p => ({ value: p, label: p }))}
          selected={posFilter}
          onToggle={togglePos}
        />
        <FilterGroup
          label="Payment"
          options={PAYMENT_FILTERS.map(f => ({ value: f.key, label: f.label }))}
          selected={payFilter}
          onToggle={togglePay}
        />
        <div className="flex items-center gap-3 text-xs text-brand-mutedWarm">
          <span>Showing {filtered.length} of {players.length}</span>
          {anyFilter && (
            <button onClick={clearFilters} className="text-brand-primaryDeep font-bold uppercase tracking-wider underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="bg-brand-tint border border-brand-primary rounded p-3 mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-ink">{selectedCount} selected</span>

          <select
            value={bulkAction}
            onChange={e => setBulkAction(e.target.value as typeof bulkAction)}
            className="border rounded p-1 text-sm"
          >
            <option value="">Choose action…</option>
            <option value="status">Set status</option>
            <option value="plan">Set payment plan</option>
            <option value="addAge">Add age group</option>
            <option value="removeAge">Remove age group</option>
            <option value="cash">Mark cash paid</option>
          </select>

          {bulkAction === 'status' && (
            <>
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as PlayerStatus)} className="border rounded p-1 text-sm">
                {BULK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {(bulkStatus === 'injured' || bulkStatus === 'away') && (
                <input type="date" value={bulkReturnDate} onChange={e => setBulkReturnDate(e.target.value)} className="border rounded p-1 text-sm" />
              )}
            </>
          )}

          {bulkAction === 'plan' && (
            <select value={bulkPlan} onChange={e => setBulkPlan(e.target.value as PaymentPlan)} className="border rounded p-1 text-sm">
              {['full', 'monthly'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}

          {(bulkAction === 'addAge' || bulkAction === 'removeAge') && (
            <select value={bulkGroup} onChange={e => setBulkGroup(e.target.value)} className="border rounded p-1 text-sm">
              {AGE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}

          <button onClick={handleBulkApply} disabled={bulkBusy || !bulkAction} className="btn-primary text-xs disabled:opacity-50">
            {bulkBusy ? 'Applying…' : `Apply to ${selectedCount}`}
          </button>
          <button onClick={() => setSelected(new Set())} className="btn-secondary text-xs">Clear selection</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand-creamAlt">
            <tr>
              <th className="p-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allVisibleSelected}
                  ref={el => { if (el) el.indeterminate = selectedCount > 0 && !allVisibleSelected }}
                  onChange={toggleSelectAll}
                />
              </th>
              {['Player', 'Parent', 'Status', 'Reg. Fee', 'Payment Status', ''].map(h => (
                <th key={h} className="text-left p-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const edit = getEdit(p)
              const needsReturnDate = edit.status === 'injured' || edit.status === 'away'
              const isExpanded = expanded.has(p.id)
              const rowClass = p.status === 'cancelled' ? 'opacity-60' : ''
              return (
                <Fragment key={p.id}>
                  <tr className={`border-t align-top ${rowClass}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${p.name}`}
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelected(p.id)}
                      />
                    </td>
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
                      <td colSpan={7} className="p-4 bg-brand-tint">
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
            {filtered.length === 0 && (
              <tr className="border-t">
                <td colSpan={7} className="p-4 text-center text-brand-muted text-sm">No players match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
