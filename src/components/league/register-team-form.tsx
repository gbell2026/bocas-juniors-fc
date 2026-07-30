'use client'
import { useEffect, useState } from 'react'
import { registerLeagueTeam, addLeaguePlayer, getOpenDivisions, getApprovedTeams } from '@/app/actions/league'

type Mode = 'newTeam' | 'addPlayer'
type PlayerRow = { name: string; dateOfBirth: string; squadNumber: string }
type Division = Awaited<ReturnType<typeof getOpenDivisions>>[number]
type ApprovedTeam = Awaited<ReturnType<typeof getApprovedTeams>>[number]

const emptyPlayerRow: PlayerRow = { name: '', dateOfBirth: '', squadNumber: '' }
const labelClass = 'block text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1'

export function RegisterTeamForm() {
  const [mode, setMode] = useState<Mode>('newTeam')
  const [divisions, setDivisions] = useState<Division[]>([])
  const [teams, setTeams] = useState<ApprovedTeam[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [clubName, setClubName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [badgeFile, setBadgeFile] = useState<File | null>(null)
  const [teamName, setTeamName] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [players, setPlayers] = useState<PlayerRow[]>([{ ...emptyPlayerRow }])

  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerDob, setPlayerDob] = useState('')
  const [playerSquadNumber, setPlayerSquadNumber] = useState('')

  useEffect(() => {
    getOpenDivisions().then(setDivisions).catch(() => setDivisions([]))
    getApprovedTeams().then(setTeams).catch(() => setTeams([]))
  }, [])

  function updatePlayerRow(index: number, patch: Partial<PlayerRow>) {
    setPlayers(prev => prev.map((p, i) => i === index ? { ...p, ...patch } : p))
  }

  function addPlayerRow() {
    setPlayers(prev => [...prev, { ...emptyPlayerRow }])
  }

  function removePlayerRow(index: number) {
    setPlayers(prev => prev.filter((_, i) => i !== index))
  }

  async function uploadBadge(): Promise<string | undefined> {
    if (!badgeFile) return undefined
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
    const fd = new FormData()
    fd.append('file', badgeFile)
    fd.append('upload_preset', uploadPreset)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
    if (!res.ok) throw new Error('Badge upload failed')
    const data = await res.json()
    return data.public_id as string | undefined
  }

  function isValidSquadNumber(value: string) {
    const n = Number(value)
    return Number.isInteger(n) && n > 0
  }

  async function handleNewTeamSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (players.some(p => !isValidSquadNumber(p.squadNumber))) {
      setError('Squad numbers must be whole numbers greater than 0.')
      return
    }

    setLoading(true)
    try {
      const badgeCloudinaryPublicId = await uploadBadge()
      const result = await registerLeagueTeam({
        clubName, contactName, contactEmail, contactPhone,
        badgeCloudinaryPublicId,
        teamName, divisionId,
        players: players.map(p => ({ name: p.name, dateOfBirth: p.dateOfBirth, squadNumber: Number(p.squadNumber) })),
      })
      if (result.error) { setError(result.error); return }
      setSuccess(true)
    } catch {
      setError('Something went wrong submitting your registration. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddPlayerSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!isValidSquadNumber(playerSquadNumber)) {
      setError('Squad number must be a whole number greater than 0.')
      return
    }

    setLoading(true)
    try {
      const result = await addLeaguePlayer({
        teamId: selectedTeamId, name: playerName, dateOfBirth: playerDob, squadNumber: Number(playerSquadNumber),
      })
      if (result.error) { setError(result.error); return }
      setSuccess(true)
    } catch {
      setError('Something went wrong submitting the player. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <p className="text-brand-ink font-bold text-lg mb-2">Thanks for registering!</p>
        <p className="text-brand-muted text-sm">Your submission is pending admin approval.</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('newTeam')}
          aria-pressed={mode === 'newTeam'}
          className={mode === 'newTeam' ? 'btn-primary text-sm flex-1' : 'btn-secondary text-sm flex-1'}
        >
          Register New Team
        </button>
        <button
          type="button"
          onClick={() => setMode('addPlayer')}
          aria-pressed={mode === 'addPlayer'}
          className={mode === 'addPlayer' ? 'btn-primary text-sm flex-1' : 'btn-secondary text-sm flex-1'}
        >
          Add a Player
        </button>
      </div>

      {mode === 'newTeam' ? (
        <form onSubmit={handleNewTeamSubmit} className="space-y-6">
          <fieldset className="space-y-4">
            <legend className={labelClass}>Club Details</legend>
            <div>
              <label htmlFor="clubName" className={labelClass}>Club Name</label>
              <input id="clubName" required className="input w-full" value={clubName} onChange={e => setClubName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="contactName" className={labelClass}>Contact Name</label>
              <input id="contactName" required className="input w-full" value={contactName} onChange={e => setContactName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="contactEmail" className={labelClass}>Contact Email</label>
              <input id="contactEmail" type="email" required className="input w-full" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="contactPhone" className={labelClass}>Contact Phone</label>
              <input id="contactPhone" type="tel" required className="input w-full" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
            </div>
            <div>
              <label htmlFor="badgeFile" className={labelClass}>Club Badge (optional)</label>
              <input id="badgeFile" type="file" accept="image/*" className="input w-full" onChange={e => setBadgeFile(e.target.files?.[0] ?? null)} />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className={labelClass}>Team Details</legend>
            <div>
              <label htmlFor="teamName" className={labelClass}>Team Name</label>
              <input id="teamName" required className="input w-full" value={teamName} onChange={e => setTeamName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="divisionId" className={labelClass}>Division</label>
              <select id="divisionId" required className="input w-full" value={divisionId} onChange={e => setDivisionId(e.target.value)}>
                <option value="">Select…</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className={labelClass}>Initial Roster</legend>
            {players.map((p, i) => (
              <div key={i} className="border border-brand-line rounded p-3 space-y-2">
                <input
                  placeholder="Player name" aria-label={`Player ${i + 1} name`} required className="input w-full"
                  value={p.name} onChange={e => updatePlayerRow(i, { name: e.target.value })}
                />
                <div className="flex gap-2">
                  <input
                    type="date" aria-label={`Player ${i + 1} date of birth`} required className="input flex-1"
                    value={p.dateOfBirth} onChange={e => updatePlayerRow(i, { dateOfBirth: e.target.value })}
                  />
                  <input
                    type="number" placeholder="Squad #" aria-label={`Player ${i + 1} squad number`}
                    min={1} step={1} required className="input w-24"
                    value={p.squadNumber} onChange={e => updatePlayerRow(i, { squadNumber: e.target.value })}
                  />
                </div>
                {players.length > 1 && (
                  <button
                    type="button" onClick={() => removePlayerRow(i)}
                    aria-label={`Remove player ${i + 1}`}
                    className="text-brand-primary text-xs"
                  >
                    Remove player
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addPlayerRow} className="btn-secondary text-sm w-full">Add Another Player</button>
          </fieldset>

          {error && <p role="alert" className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Submitting…' : 'Submit Registration'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleAddPlayerSubmit} className="space-y-4">
          <div>
            <label htmlFor="selectedTeamId" className={labelClass}>Your Team</label>
            <select id="selectedTeamId" required className="input w-full" value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}>
              <option value="">Select…</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.clubName} — {t.name} ({t.divisionName})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="playerName" className={labelClass}>Player Name</label>
            <input id="playerName" required className="input w-full" value={playerName} onChange={e => setPlayerName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="playerDob" className={labelClass}>Date of Birth</label>
            <input id="playerDob" type="date" required className="input w-full" value={playerDob} onChange={e => setPlayerDob(e.target.value)} />
          </div>
          <div>
            <label htmlFor="playerSquadNumber" className={labelClass}>Squad Number</label>
            <input id="playerSquadNumber" type="number" min={1} step={1} required className="input w-full" value={playerSquadNumber} onChange={e => setPlayerSquadNumber(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Submitting…' : 'Submit Player'}
          </button>
        </form>
      )}
    </div>
  )
}
