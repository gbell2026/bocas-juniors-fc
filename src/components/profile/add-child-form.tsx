'use client'
import { useState } from 'react'
import { addChildToParent } from '@/app/actions/register'
import type { PaymentPlan } from '@/lib/supabase/types'

type Props = { onSuccess: (playerId: string) => void; onCancel: () => void }

export function AddChildForm({ onSuccess, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await addChildToParent({
      playerName: fd.get('playerName') as string,
      dateOfBirth: fd.get('dateOfBirth') as string,
      position: fd.get('position') as string,
      paymentPlan: fd.get('paymentPlan') as PaymentPlan,
    })
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onSuccess(result.playerId!)
  }

  const labelClass = 'block text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-brand-tint border border-brand-line rounded-lg p-4">
      <p className="text-sm text-brand-muted">
        This child qualifies for a <span className="font-bold">50% sibling discount</span> on the season fee.
        The one-time $30 registration fee still applies in full.
      </p>
      <div>
        <label htmlFor="addChildPlayerName" className={labelClass}>Player Name</label>
        <input id="addChildPlayerName" name="playerName" required className="input w-full" />
      </div>
      <div>
        <label htmlFor="addChildDateOfBirth" className={labelClass}>Date of Birth</label>
        <input id="addChildDateOfBirth" name="dateOfBirth" type="date" required className="input w-full" />
      </div>
      <div>
        <label htmlFor="addChildPosition" className={labelClass}>Position</label>
        <select id="addChildPosition" name="position" required className="input w-full">
          <option value="">Select…</option>
          {['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className={labelClass}>Payment Plan</legend>
        <label className="flex items-start gap-2 cursor-pointer text-sm">
          <input type="radio" name="paymentPlan" value="full" required className="mt-1" />
          <span>
            <span className="block font-bold">Pay in Full — $105 season fee</span>
            <span className="block text-brand-muted">One payment for the whole season, plus the $30 registration fee.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer text-sm">
          <input type="radio" name="paymentPlan" value="monthly" required className="mt-1" />
          <span>
            <span className="block font-bold">Monthly — $105 season total</span>
            <span className="block text-brand-muted">$15 in August, then $30/month September–November, plus the $30 registration fee.</span>
          </span>
        </label>
      </fieldset>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary text-sm flex-1 disabled:opacity-50">
          {loading ? 'Adding…' : 'Add Child'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm px-4">
          Cancel
        </button>
      </div>
    </form>
  )
}
