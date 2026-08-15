'use client'
import { useState } from 'react'
import { createCoachAccount, deleteCoachAccount } from '@/app/actions/admin'

type CoachAccount = { userId: string; email: string }

export function CoachAccounts({ accounts: initial }: { accounts: CoachAccount[] }) {
  const [accounts, setAccounts] = useState(initial)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setCreating(true)
    try {
      const result = await createCoachAccount({ name, email, password })
      if (result.error) { setErrorMessage(result.error); return }
      setName(''); setEmail(''); setPassword('')
      window.location.reload()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleRemove(userId: string) {
    setErrorMessage(null)
    setRemoving(userId)
    try {
      const result = await deleteCoachAccount(userId)
      if (result.error) { setErrorMessage(result.error); return }
      setAccounts(prev => prev.filter(a => a.userId !== userId))
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Coach Accounts ({accounts.length})</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      {accounts.length > 0 && (
        <div className="space-y-2 mb-4">
          {accounts.map(a => (
            <div key={a.userId} className="bg-brand-tint border border-brand-line rounded p-3 flex items-center justify-between gap-4">
              <p className="text-brand-ink text-sm">{a.email}</p>
              <button
                onClick={() => handleRemove(a.userId)}
                disabled={removing === a.userId}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
              >
                {removing === a.userId ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleCreate} className="border border-brand-line rounded p-4 space-y-3">
        <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">Add Coach Account</p>
        <input
          placeholder="Name" required className="input w-full"
          value={name} onChange={e => setName(e.target.value)}
        />
        <input
          placeholder="Email" type="email" required className="input w-full"
          value={email} onChange={e => setEmail(e.target.value)}
        />
        <input
          placeholder="Password" type="text" required minLength={8} className="input w-full"
          value={password} onChange={e => setPassword(e.target.value)}
        />
        <p className="text-brand-muted text-[10px]">
          There&apos;s no invite-email flow — communicate this password to the coach directly (e.g. WhatsApp).
        </p>
        <button type="submit" disabled={creating} className="btn-primary text-sm w-full">
          {creating ? 'Creating…' : 'Create Coach Account'}
        </button>
      </form>
    </section>
  )
}
