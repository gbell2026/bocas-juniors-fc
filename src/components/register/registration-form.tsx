'use client'
import { useState } from 'react'
import { registerParentAndPlayer } from '@/app/actions/register'

type Props = { onSuccess: (playerId: string, parentId: string, parentName: string, playerName: string) => void }

export function RegistrationForm({ onSuccess }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await registerParentAndPlayer({
      parentName: fd.get('parentName') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
      password: fd.get('password') as string,
      playerName: fd.get('playerName') as string,
      dateOfBirth: fd.get('dateOfBirth') as string,
      position: fd.get('position') as string,
    })
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onSuccess(result.playerId!, result.parentId!, fd.get('parentName') as string, fd.get('playerName') as string)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold">Register Your Child</h2>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-brand-primary">Player Details</legend>
        <div>
          <label htmlFor="playerName" className="block text-sm font-medium">Player Name</label>
          <input id="playerName" name="playerName" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium">Date of Birth</label>
          <input id="dateOfBirth" name="dateOfBirth" type="date" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="position" className="block text-sm font-medium">Position</label>
          <select id="position" name="position" required className="input w-full">
            <option value="">Select…</option>
            {['Goalkeeper','Defender','Midfielder','Forward'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-brand-primary">Parent / Guardian Details</legend>
        <div>
          <label htmlFor="parentName" className="block text-sm font-medium">Parent Name</label>
          <input id="parentName" name="parentName" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium">Phone</label>
          <input id="phone" name="phone" type="tel" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" minLength={8} required className="input w-full" />
        </div>
      </fieldset>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Registering…' : 'Register & Pay'}
      </button>
    </form>
  )
}
