'use client'
import { useState } from 'react'
import { updateLeagueClub } from '@/app/actions/league-admin'
import type { getAllLeagueClubs } from '@/app/actions/league-admin'
import { cloudinaryUrl } from '@/lib/cloudinary-url'

type Club = Awaited<ReturnType<typeof getAllLeagueClubs>>[number]
type Status = Club['status']

type EditState = {
  name: string
  contactName: string
  contactEmail: string
  contactPhone: string
  status: Status
  badgeFile: File | null
  removeBadge: boolean
}

async function uploadBadge(file: File): Promise<string | undefined> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', uploadPreset)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error('Logo upload failed')
  const data = await res.json()
  return data.public_id as string | undefined
}

export function ManageLeagueClubs({ clubs: initial }: { clubs: Club[] }) {
  const [clubs, setClubs] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, EditState>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (clubs.length === 0) return null

  function startEdit(c: Club) {
    setEditingId(c.id)
    setEdits(prev => ({
      ...prev,
      [c.id]: {
        name: c.name,
        contactName: c.contact_name ?? '',
        contactEmail: c.contact_email ?? '',
        contactPhone: c.contact_phone ?? '',
        status: c.status,
        badgeFile: null,
        removeBadge: false,
      },
    }))
  }

  async function handleSaveEdit(id: string) {
    const edit = edits[id]
    if (!edit || !edit.name) {
      setErrorMessage('Club name is required.')
      return
    }
    setErrorMessage(null)
    setSaving(id)
    try {
      // undefined = leave badge unchanged, null = clear it, string = new upload
      const badgeCloudinaryPublicId = edit.removeBadge
        ? null
        : edit.badgeFile
          ? await uploadBadge(edit.badgeFile)
          : undefined

      const result = await updateLeagueClub(id, {
        name: edit.name,
        contactName: edit.contactName || null,
        contactEmail: edit.contactEmail || null,
        contactPhone: edit.contactPhone || null,
        status: edit.status,
        badgeCloudinaryPublicId,
      })
      if (result.error) { setErrorMessage(result.error); return }
      setClubs(prev => prev.map(c => c.id === id
        ? {
            ...c,
            name: edit.name,
            contact_name: edit.contactName || null,
            contact_email: edit.contactEmail || null,
            contact_phone: edit.contactPhone || null,
            status: edit.status,
            badge_cloudinary_public_id: badgeCloudinaryPublicId !== undefined ? badgeCloudinaryPublicId : c.badge_cloudinary_public_id,
          }
        : c
      ))
      setEditingId(null)
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Manage Clubs ({clubs.length})</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      <div className="space-y-2">
        {clubs.map(c => (
          <div key={c.id} className="bg-brand-tint border border-brand-line rounded p-3">
            {editingId === c.id ? (
              <div className="space-y-2">
                <input
                  className="input w-full" placeholder="Club name"
                  value={edits[c.id].name}
                  onChange={e => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], name: e.target.value } }))}
                />
                <input
                  className="input w-full" placeholder="Contact name (optional)"
                  value={edits[c.id].contactName}
                  onChange={e => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], contactName: e.target.value } }))}
                />
                <input
                  className="input w-full" placeholder="Contact email (optional)"
                  value={edits[c.id].contactEmail}
                  onChange={e => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], contactEmail: e.target.value } }))}
                />
                <input
                  className="input w-full" placeholder="Contact phone (optional)"
                  value={edits[c.id].contactPhone}
                  onChange={e => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], contactPhone: e.target.value } }))}
                />
                <select
                  className="input w-full" aria-label="Status"
                  value={edits[c.id].status}
                  onChange={e => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], status: e.target.value as Status } }))}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>

                <div className="flex items-center gap-3">
                  {c.badge_cloudinary_public_id && !edits[c.id].removeBadge && (
                    <img
                      src={cloudinaryUrl(c.badge_cloudinary_public_id, 60)} alt=""
                      className="w-10 h-10 object-contain bg-white rounded border border-brand-line flex-shrink-0"
                    />
                  )}
                  <input
                    type="file" accept="image/*" className="input flex-1"
                    aria-label="Logo"
                    onChange={e => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], badgeFile: e.target.files?.[0] ?? null, removeBadge: false } }))}
                  />
                  {c.badge_cloudinary_public_id && !edits[c.id].removeBadge && (
                    <button
                      type="button"
                      onClick={() => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], badgeFile: null, removeBadge: true } }))}
                      className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0"
                    >
                      Remove logo
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => handleSaveEdit(c.id)} disabled={saving === c.id} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                    {saving === c.id ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {c.badge_cloudinary_public_id ? (
                    <img
                      src={cloudinaryUrl(c.badge_cloudinary_public_id, 60)} alt=""
                      className="w-10 h-10 object-contain bg-white rounded border border-brand-line flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-brand-tint flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-brand-ink font-bold text-sm">{c.name}</p>
                    <p className="text-brand-muted text-xs">
                      {[c.contact_name, c.contact_email, c.contact_phone].filter(Boolean).join(' · ') || 'No contact details'}
                      {' · '}<span className="uppercase">{c.status}</span>
                    </p>
                  </div>
                </div>
                <button onClick={() => startEdit(c)} className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0">Edit</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
