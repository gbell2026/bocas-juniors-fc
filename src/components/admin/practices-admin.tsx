'use client'
import { useState } from 'react'
import { createPractice, updatePractice, setPracticeCancelled, deletePractice } from '@/app/actions/practices'
import type { getAllPractices } from '@/app/actions/practices'

type Practice = Awaited<ReturnType<typeof getAllPractices>>[number]
type EditState = { practiceDate: string; practiceTime: string; location: string; notes: string }

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso))
}

function formatTime(time: string) {
  const [h, m] = time.split(':')
  return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(2000, 0, 1, Number(h), Number(m)))
}

export function PracticesAdmin({ practices: initial }: { practices: Practice[] }) {
  const [practices, setPractices] = useState(initial)
  const [practiceDate, setPracticeDate] = useState('')
  const [practiceTime, setPracticeTime] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, EditState>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function startEdit(p: Practice) {
    setEditingId(p.id)
    setEdits(prev => ({ ...prev, [p.id]: { practiceDate: p.practiceDate, practiceTime: p.practiceTime, location: p.location ?? '', notes: p.notes ?? '' } }))
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setCreating(true)
    try {
      const result = await createPractice({ practiceDate, practiceTime, location, notes })
      if (result.error) { setErrorMessage(result.error); return }
      setPracticeDate(''); setPracticeTime(''); setLocation(''); setNotes('')
      window.location.reload()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit(id: string) {
    const edit = edits[id]
    if (!edit || !edit.practiceDate || !edit.practiceTime) {
      setErrorMessage('Date and time are both required.')
      return
    }
    setErrorMessage(null)
    setSaving(id)
    try {
      const result = await updatePractice(id, edit)
      if (result.error) { setErrorMessage(result.error); return }
      setPractices(prev => prev.map(p => p.id === id
        ? { ...p, practiceDate: edit.practiceDate, practiceTime: edit.practiceTime, location: edit.location || null, notes: edit.notes || null }
        : p
      ))
      setEditingId(null)
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleToggleCancelled(p: Practice) {
    setErrorMessage(null)
    setSaving(p.id)
    try {
      const result = await setPracticeCancelled(p.id, !p.cancelled)
      if (result.error) { setErrorMessage(result.error); return }
      setPractices(prev => prev.map(item => item.id === p.id ? { ...item, cancelled: !p.cancelled } : item))
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(id: string) {
    setErrorMessage(null)
    setSaving(id)
    try {
      const result = await deletePractice(id)
      if (result.error) { setErrorMessage(result.error); return }
      setPractices(prev => prev.filter(p => p.id !== id))
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Practices ({practices.length})</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      <div className="space-y-2 mb-4">
        {practices.map(p => (
          <div key={p.id} className={`bg-brand-tint border border-brand-line rounded p-3 ${p.cancelled ? 'opacity-60' : ''}`}>
            {editingId === p.id ? (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="date" className="input flex-1"
                    value={edits[p.id]?.practiceDate ?? ''}
                    onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], practiceDate: e.target.value } }))}
                  />
                  <input
                    type="time" className="input flex-1"
                    value={edits[p.id]?.practiceTime ?? ''}
                    onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], practiceTime: e.target.value } }))}
                  />
                </div>
                <input
                  className="input w-full" placeholder="Location (optional)"
                  value={edits[p.id]?.location ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], location: e.target.value } }))}
                />
                <input
                  className="input w-full" placeholder="Notes (optional)"
                  value={edits[p.id]?.notes ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], notes: e.target.value } }))}
                />
                <div className="flex gap-2">
                  <button onClick={() => handleSaveEdit(p.id)} disabled={saving === p.id} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                    {saving === p.id ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  {p.cancelled && <p className="text-red-600 text-[10px] font-bold uppercase tracking-wider">Cancelled</p>}
                  <p className="text-brand-ink font-bold text-sm">{formatDate(p.practiceDate)} — {formatTime(p.practiceTime)}</p>
                  {p.location && <p className="text-brand-muted text-xs">{p.location}</p>}
                  {p.notes && <p className="text-brand-muted text-xs">{p.notes}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(p)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Edit</button>
                  <button
                    onClick={() => handleToggleCancelled(p)}
                    disabled={saving === p.id}
                    className="text-xs px-3 py-1.5 border border-brand-primary text-brand-primary rounded font-bold uppercase tracking-wider hover:bg-brand-primary hover:text-white transition disabled:opacity-50"
                  >
                    {p.cancelled ? 'Un-cancel' : 'Cancel'}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={saving === p.id}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    {saving === p.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {practices.length === 0 && <p className="text-brand-muted text-sm">No practices scheduled yet.</p>}
      </div>

      <form onSubmit={handleCreate} className="border border-brand-line rounded p-4 space-y-3">
        <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">Add Practice</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="date" required className="input flex-1"
            value={practiceDate} onChange={e => setPracticeDate(e.target.value)}
          />
          <input
            type="time" required className="input flex-1"
            value={practiceTime} onChange={e => setPracticeTime(e.target.value)}
          />
        </div>
        <input
          placeholder="Location (optional)" className="input w-full"
          value={location} onChange={e => setLocation(e.target.value)}
        />
        <input
          placeholder="Notes (optional)" className="input w-full"
          value={notes} onChange={e => setNotes(e.target.value)}
        />
        <button type="submit" disabled={creating} className="btn-primary text-sm w-full">
          {creating ? 'Adding…' : 'Add Practice'}
        </button>
      </form>
    </section>
  )
}
