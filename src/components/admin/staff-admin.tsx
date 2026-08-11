'use client'
import { useState } from 'react'
import { createStaffMember, updateStaffMember, deleteStaffMember } from '@/app/actions/staff'
import type { getStaffMembers } from '@/app/actions/staff'
import { cloudinaryUrl } from '@/lib/cloudinary-url'

type Staff = Awaited<ReturnType<typeof getStaffMembers>>[number]

type FormFields = {
  name: string; roleTitle: string; bio: string
  nationality: string; oneLineIntro: string; background: string
  qualifications: string; philosophy: string; favouriteTeam: string; funFact: string
}
type EditState = FormFields & { photoFile: File | null }

const EMPTY_FORM: FormFields = {
  name: '', roleTitle: '', bio: '',
  nationality: '', oneLineIntro: '', background: '',
  qualifications: '', philosophy: '', favouriteTeam: '', funFact: '',
}

async function uploadPhoto(file: File): Promise<string | undefined> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', uploadPreset)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error('Photo upload failed')
  const data = await res.json()
  return data.public_id as string | undefined
}

function BioFields({ value, onChange }: { value: FormFields; onChange: (next: FormFields) => void }) {
  const inputClass = 'input w-full'
  return (
    <>
      <input placeholder="Name" required className={inputClass} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} />
      <input placeholder="Role / Title" required className={inputClass} value={value.roleTitle} onChange={e => onChange({ ...value, roleTitle: e.target.value })} />
      <input placeholder="Nationality (optional)" className={inputClass} value={value.nationality} onChange={e => onChange({ ...value, nationality: e.target.value })} />
      <input placeholder="One-line intro (optional)" className={inputClass} value={value.oneLineIntro} onChange={e => onChange({ ...value, oneLineIntro: e.target.value })} />
      <textarea placeholder="About you" required rows={3} className={inputClass} value={value.bio} onChange={e => onChange({ ...value, bio: e.target.value })} />
      <textarea placeholder="Football or coaching background (optional)" rows={2} className={inputClass} value={value.background} onChange={e => onChange({ ...value, background: e.target.value })} />
      <textarea placeholder="Qualifications or certifications (optional)" rows={2} className={inputClass} value={value.qualifications} onChange={e => onChange({ ...value, qualifications: e.target.value })} />
      <textarea placeholder="Coaching philosophy or approach (optional)" rows={2} className={inputClass} value={value.philosophy} onChange={e => onChange({ ...value, philosophy: e.target.value })} />
      <input placeholder="Favourite football team (optional)" className={inputClass} value={value.favouriteTeam} onChange={e => onChange({ ...value, favouriteTeam: e.target.value })} />
      <textarea placeholder="Something fun (optional)" rows={2} className={inputClass} value={value.funFact} onChange={e => onChange({ ...value, funFact: e.target.value })} />
    </>
  )
}

export function StaffAdmin({ staff: initial }: { staff: Staff[] }) {
  const [staff, setStaff] = useState(initial)
  const [form, setForm] = useState<FormFields>(EMPTY_FORM)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, EditState>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function startEdit(s: Staff) {
    setEditingId(s.id)
    setEdits(prev => ({
      ...prev,
      [s.id]: {
        name: s.name, roleTitle: s.roleTitle, bio: s.bio,
        nationality: s.nationality ?? '', oneLineIntro: s.oneLineIntro ?? '', background: s.background ?? '',
        qualifications: s.qualifications ?? '', philosophy: s.philosophy ?? '', favouriteTeam: s.favouriteTeam ?? '', funFact: s.funFact ?? '',
        photoFile: null,
      },
    }))
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setCreating(true)
    try {
      const photoCloudinaryPublicId = photoFile ? await uploadPhoto(photoFile) : undefined
      const result = await createStaffMember({
        name: form.name, roleTitle: form.roleTitle, bio: form.bio, photoCloudinaryPublicId,
        nationality: form.nationality, oneLineIntro: form.oneLineIntro, background: form.background,
        qualifications: form.qualifications, philosophy: form.philosophy, favouriteTeam: form.favouriteTeam, funFact: form.funFact,
      })
      if (result.error) { setErrorMessage(result.error); return }
      setForm(EMPTY_FORM); setPhotoFile(null)
      window.location.reload()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit(id: string) {
    const edit = edits[id]
    if (!edit || !edit.name || !edit.roleTitle || !edit.bio) {
      setErrorMessage('Name, role, and "About you" are all required.')
      return
    }
    setErrorMessage(null)
    setSaving(id)
    try {
      const existing = staff.find(s => s.id === id)
      const photoCloudinaryPublicId = edit.photoFile
        ? await uploadPhoto(edit.photoFile)
        : existing?.photoCloudinaryPublicId ?? null
      const result = await updateStaffMember(id, {
        name: edit.name, roleTitle: edit.roleTitle, bio: edit.bio, photoCloudinaryPublicId,
        nationality: edit.nationality, oneLineIntro: edit.oneLineIntro, background: edit.background,
        qualifications: edit.qualifications, philosophy: edit.philosophy, favouriteTeam: edit.favouriteTeam, funFact: edit.funFact,
      })
      if (result.error) { setErrorMessage(result.error); return }
      setStaff(prev => prev.map(s => s.id === id
        ? {
            ...s, name: edit.name, roleTitle: edit.roleTitle, bio: edit.bio, photoCloudinaryPublicId: photoCloudinaryPublicId ?? null,
            nationality: edit.nationality || null, oneLineIntro: edit.oneLineIntro || null, background: edit.background || null,
            qualifications: edit.qualifications || null, philosophy: edit.philosophy || null,
            favouriteTeam: edit.favouriteTeam || null, funFact: edit.funFact || null,
          }
        : s
      ))
      setEditingId(null)
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(id: string) {
    setErrorMessage(null)
    setDeleting(id)
    try {
      const result = await deleteStaffMember(id)
      if (result.error) { setErrorMessage(result.error); return }
      setStaff(prev => prev.filter(s => s.id !== id))
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Our Team ({staff.length})</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      <div className="space-y-2 mb-4">
        {staff.map(s => (
          <div key={s.id} className="bg-brand-tint border border-brand-line rounded p-3">
            {editingId === s.id ? (
              <div className="space-y-2">
                <BioFields
                  value={edits[s.id]}
                  onChange={next => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], ...next } }))}
                />
                <input
                  type="file" accept="image/*" className="input w-full"
                  aria-label="Photo"
                  onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], photoFile: e.target.files?.[0] ?? null } }))}
                />
                <div className="flex gap-2">
                  <button onClick={() => handleSaveEdit(s.id)} disabled={saving === s.id} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                    {saving === s.id ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {s.photoCloudinaryPublicId ? (
                    <img src={cloudinaryUrl(s.photoCloudinaryPublicId, 60)} alt={s.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-brand-tint" />
                  )}
                  <div>
                    <p className="text-brand-ink font-bold text-sm">{s.name}</p>
                    <p className="text-brand-muted text-xs">{s.roleTitle}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(s)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Edit</button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    {deleting === s.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleCreate} className="border border-brand-line rounded p-4 space-y-3">
        <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">Add Staff Member</p>
        <BioFields value={form} onChange={setForm} />
        <div>
          <label htmlFor="staffPhoto" className="block text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1">Photo (optional)</label>
          <input id="staffPhoto" type="file" accept="image/*" className="input w-full" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
        </div>
        <button type="submit" disabled={creating} className="btn-primary text-sm w-full">
          {creating ? 'Adding…' : 'Add Staff Member'}
        </button>
      </form>
    </section>
  )
}
