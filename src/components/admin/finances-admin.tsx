'use client'
import { useState, useEffect } from 'react'
import { createFinanceSeason, updateFinanceSeason } from '@/app/actions/finances'
import type { FinanceSeason, FinanceCategory } from '@/app/actions/finances'
import { getFinancePnL, setFinanceBudget } from '@/app/actions/finances'
import type { FinancePnLRow } from '@/app/actions/finances'

type Props = {
  seasons: FinanceSeason[]
  categories: FinanceCategory[]
}

// Falls back to the season with the latest start date when none contains
// today — `getFinanceSeasons` orders by start_date descending, so
// seasons[0] is that season. Not literally "most recently created" (this
// list doesn't carry a created_at to the client), but the closest available
// proxy and the only ordering already established by Chunk 1.
function defaultSeasonId(seasons: FinanceSeason[]): string {
  const today = new Date().toISOString().slice(0, 10)
  const current = seasons.find(s => s.startDate <= today && today <= s.endDate)
  return current?.id ?? seasons[0]?.id ?? ''
}

export function FinancesAdmin({ seasons: initialSeasons, categories }: Props) {
  const [seasons, setSeasons] = useState(initialSeasons)
  const [seasonId, setSeasonId] = useState(defaultSeasonId(initialSeasons))
  const [managingSeasons, setManagingSeasons] = useState(false)
  const [label, setLabel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { label: string; startDate: string; endDate: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pnl, setPnl] = useState<FinancePnLRow[]>([])
  const [loadingPnl, setLoadingPnl] = useState(false)
  const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({})
  const [savingBudget, setSavingBudget] = useState<string | null>(null)

  useEffect(() => {
    if (!seasonId) { setPnl([]); return }
    setLoadingPnl(true)
    getFinancePnL(seasonId).then(setPnl).finally(() => setLoadingPnl(false))
  }, [seasonId])

  async function handleSaveBudget(categoryId: string) {
    const raw = budgetEdits[categoryId]
    if (raw === undefined) return
    const cents = Math.round(parseFloat(raw) * 100)
    if (Number.isNaN(cents)) return
    setSavingBudget(categoryId)
    try {
      await setFinanceBudget({ seasonId, categoryId, targetAmountCents: cents })
      setPnl(prev => prev.map(r => r.id === categoryId ? { ...r, budgetCents: cents } : r))
      setBudgetEdits(prev => { const next = { ...prev }; delete next[categoryId]; return next })
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSavingBudget(null)
    }
  }

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`
  }

  const income = pnl.filter(r => r.kind === 'income')
  const expense = pnl.filter(r => r.kind === 'expense')
  const totalIncomeBudget = income.reduce((sum, r) => sum + r.budgetCents, 0)
  const totalIncomeActual = income.reduce((sum, r) => sum + r.actualCents, 0)
  const totalExpenseBudget = expense.reduce((sum, r) => sum + r.budgetCents, 0)
  const totalExpenseActual = expense.reduce((sum, r) => sum + r.actualCents, 0)

  function startEdit(s: FinanceSeason) {
    setEditingId(s.id)
    setEdits(prev => ({ ...prev, [s.id]: { label: s.label, startDate: s.startDate, endDate: s.endDate } }))
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setCreating(true)
    try {
      const result = await createFinanceSeason({ label, startDate, endDate })
      if (result.error) { setErrorMessage(result.error); return }
      setLabel(''); setStartDate(''); setEndDate('')
      window.location.reload()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit(id: string) {
    const edit = edits[id]
    if (!edit) return
    if (!edit.label || !edit.startDate || !edit.endDate) {
      setErrorMessage('Label, start date, and end date are all required.')
      return
    }
    setErrorMessage(null)
    setSaving(id)
    try {
      const result = await updateFinanceSeason(id, edit)
      if (result.error) { setErrorMessage(result.error); return }
      setSeasons(prev => prev.map(s => s.id === id ? { ...s, ...edit } : s))
      setEditingId(null)
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  const selectedSeason = seasons.find(s => s.id === seasonId) ?? null

  function variance(row: FinancePnLRow): number {
    const diff = row.actualCents - row.budgetCents
    return row.kind === 'income' ? diff : -diff
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink">Finances</h2>
        <button onClick={() => setManagingSeasons(v => !v)} className="btn-secondary text-xs px-3 py-1.5">
          {managingSeasons ? 'Done' : 'Manage Seasons'}
        </button>
      </div>

      {errorMessage && <p className="text-brand-primary text-sm">{errorMessage}</p>}

      {seasons.length === 0 ? (
        <p className="text-brand-muted text-sm">Create a season to get started.</p>
      ) : (
        <select
          value={seasonId}
          onChange={e => setSeasonId(e.target.value)}
          className="input"
        >
          {seasons.map(s => (
            <option key={s.id} value={s.id}>{s.label} ({s.startDate} – {s.endDate})</option>
          ))}
        </select>
      )}

      {managingSeasons && (
        <div className="space-y-2 border border-brand-line rounded p-4">
          {seasons.map(s => (
            <div key={s.id} className="bg-brand-tint border border-brand-line rounded p-3">
              {editingId === s.id ? (
                <div className="space-y-2">
                  <input
                    className="input w-full"
                    value={edits[s.id]?.label ?? ''}
                    onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], label: e.target.value } }))}
                  />
                  <div className="flex gap-2">
                    <input
                      type="date" className="input flex-1"
                      value={edits[s.id]?.startDate ?? ''}
                      onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], startDate: e.target.value } }))}
                    />
                    <input
                      type="date" className="input flex-1"
                      value={edits[s.id]?.endDate ?? ''}
                      onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], endDate: e.target.value } }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(s.id)} disabled={saving === s.id} className="btn-primary text-xs px-3 py-1.5">
                      {saving === s.id ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-brand-ink font-bold text-sm">{s.label}</p>
                    <p className="text-brand-muted text-xs">{s.startDate} – {s.endDate}</p>
                  </div>
                  <button onClick={() => startEdit(s)} className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                </div>
              )}
            </div>
          ))}

          <form onSubmit={handleCreate} className="border border-brand-line rounded p-4 space-y-3">
            <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">New Season</p>
            <input
              placeholder="Season label (e.g. 2026 Season)" required className="input w-full"
              value={label} onChange={e => setLabel(e.target.value)}
            />
            <div className="flex gap-2">
              <input type="date" required className="input flex-1" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <input type="date" required className="input flex-1" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button type="submit" disabled={creating} className="btn-primary text-sm w-full">
              {creating ? 'Creating…' : 'Create Season'}
            </button>
          </form>
        </div>
      )}

      {selectedSeason && (
        loadingPnl ? (
          <p className="text-brand-muted text-sm">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-brand-creamAlt">
              <tr>
                {['Category', 'Budget', 'Actual', 'Variance'].map(h => (
                  <th key={h} className="text-left p-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...income, ...expense].map(row => {
                const isAuto = categories.find(c => c.id === row.id)?.autoSource != null
                const v = variance(row)
                return (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3">
                      {budgetEdits[row.id] !== undefined ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="number" step="0.01" className="input w-24"
                            value={budgetEdits[row.id]}
                            onChange={e => setBudgetEdits(prev => ({ ...prev, [row.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => handleSaveBudget(row.id)}
                            disabled={savingBudget === row.id}
                            className="btn-primary text-xs px-2 py-1"
                          >Save</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setBudgetEdits(prev => ({ ...prev, [row.id]: (row.budgetCents / 100).toFixed(2) }))}
                          className="hover:underline"
                        >{formatCents(row.budgetCents)}</button>
                      )}
                    </td>
                    <td className="p-3">{formatCents(row.actualCents)}{isAuto && <span className="text-brand-mutedWarm text-xs ml-1">(auto)</span>}</td>
                    <td className={`p-3 font-medium ${v >= 0 ? 'text-green-600' : 'text-brand-primary'}`}>
                      {v >= 0 ? '+' : ''}{formatCents(v)}
                    </td>
                  </tr>
                )
              })}
              {(() => {
                // Same club's-favor sign convention as the per-row variance() helper:
                // higher-than-budget income is good, higher-than-budget expense is bad
                // (so expense variance flips sign), and Net (income minus expense) is
                // already combined, so it doesn't need flipping — a higher realized net
                // than budgeted is good exactly as-is. Every totals row uses the same
                // green/red + "+" prefix styling as the per-category rows above, rather
                // than showing an unsigned, uncolored number.
                const totalIncomeVariance = totalIncomeActual - totalIncomeBudget
                const totalExpenseVariance = totalExpenseBudget - totalExpenseActual
                const netVariance = (totalIncomeActual - totalExpenseActual) - (totalIncomeBudget - totalExpenseBudget)
                const varianceClass = (v: number) => `p-3 font-bold ${v >= 0 ? 'text-green-600' : 'text-brand-primary'}`
                const varianceText = (v: number) => `${v >= 0 ? '+' : ''}${formatCents(v)}`
                return (
                  <>
                    <tr className="border-t-2 font-bold">
                      <td className="p-3">Total Income</td>
                      <td className="p-3">{formatCents(totalIncomeBudget)}</td>
                      <td className="p-3">{formatCents(totalIncomeActual)}</td>
                      <td className={varianceClass(totalIncomeVariance)}>{varianceText(totalIncomeVariance)}</td>
                    </tr>
                    <tr className="font-bold">
                      <td className="p-3">Total Expenses</td>
                      <td className="p-3">{formatCents(totalExpenseBudget)}</td>
                      <td className="p-3">{formatCents(totalExpenseActual)}</td>
                      <td className={varianceClass(totalExpenseVariance)}>{varianceText(totalExpenseVariance)}</td>
                    </tr>
                    <tr className="border-t-2 font-bold">
                      <td className="p-3">Net</td>
                      <td className="p-3">{formatCents(totalIncomeBudget - totalExpenseBudget)}</td>
                      <td className="p-3">{formatCents(totalIncomeActual - totalExpenseActual)}</td>
                      <td className={varianceClass(netVariance)}>{varianceText(netVariance)}</td>
                    </tr>
                  </>
                )
              })()}
            </tbody>
          </table>
        )
      )}
    </section>
  )
}
