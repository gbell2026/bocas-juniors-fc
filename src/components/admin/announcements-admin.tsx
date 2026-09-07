'use client'
import { useState } from 'react'
import { createAnnouncement, updateAnnouncement, deleteAnnouncement, deleteComment } from '@/app/actions/announcements'
import type { getAnnouncements } from '@/app/actions/announcements'
import { whatsappShareUrl } from '@/lib/whatsapp-share'

type AnnouncementWithComments = Awaited<ReturnType<typeof getAnnouncements>>[number]

export function AnnouncementsAdmin({ announcements: initial }: { announcements: AnnouncementWithComments[] }) {
  const [announcements, setAnnouncements] = useState(initial)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [emailParents, setEmailParents] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { title: string; body: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  function startEdit(a: AnnouncementWithComments) {
    setEditingId(a.id)
    setEdits(prev => ({ ...prev, [a.id]: { title: a.title, body: a.body } }))
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setCreating(true)
    try {
      const result = await createAnnouncement({ title, body, emailParents })
      if (result.error || !result.announcement) {
        setErrorMessage(result.error ?? 'Something went wrong. Please try again.')
        return
      }
      setAnnouncements(prev => [{ ...result.announcement!, comments: [] }, ...prev])
      setTitle(''); setBody(''); setEmailParents(false)

      if (result.email) {
        setSuccessMessage(
          result.email.error
            ? `Posted. Email did not send: ${result.email.error}`
            : `Posted and emailed ${result.email.sent} parent${result.email.sent === 1 ? '' : 's'}` +
              (result.email.failed > 0 ? ` (${result.email.failed} failed).` : '.')
        )
      } else {
        setSuccessMessage('Posted.')
      }
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit(id: string) {
    const edit = edits[id]
    if (!edit || !edit.title || !edit.body) {
      setErrorMessage('Title and body are both required.')
      return
    }
    setErrorMessage(null)
    setSaving(id)
    try {
      const result = await updateAnnouncement(id, edit)
      if (result.error) { setErrorMessage(result.error); return }
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, title: edit.title, body: edit.body } : a))
      setEditingId(null)
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
      const result = await deleteAnnouncement(id)
      if (result.error) { setErrorMessage(result.error); return }
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleDeleteComment(announcementId: string, commentId: string) {
    setErrorMessage(null)
    setSaving(commentId)
    try {
      const result = await deleteComment(commentId)
      if (result.error) { setErrorMessage(result.error); return }
      setAnnouncements(prev => prev.map(a => a.id === announcementId
        ? { ...a, comments: a.comments.filter(c => c.id !== commentId) }
        : a
      ))
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Announcements</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}
      {successMessage && <p className="text-green-700 text-sm mb-2">{successMessage}</p>}

      <div className="space-y-2 mb-4">
        {announcements.map(a => (
          <div key={a.id} className="bg-brand-tint border border-brand-line rounded p-3">
            {editingId === a.id ? (
              <div className="space-y-2">
                <input
                  className="input w-full"
                  value={edits[a.id]?.title ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [a.id]: { ...prev[a.id], title: e.target.value } }))}
                />
                <textarea
                  className="input w-full"
                  rows={3}
                  value={edits[a.id]?.body ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [a.id]: { ...prev[a.id], body: e.target.value } }))}
                />
                <div className="flex gap-2">
                  <button onClick={() => handleSaveEdit(a.id)} disabled={saving === a.id} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                    {saving === a.id ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-brand-ink font-bold text-sm">{a.title}</p>
                    <p className="text-brand-muted text-xs">{a.body}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <a
                      href={whatsappShareUrl(`*${a.title}*\n\n${a.body}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 border border-[#25D366] text-[#128C3E] rounded font-bold uppercase tracking-wider hover:bg-[#25D366] hover:text-white transition"
                    >
                      Share on WhatsApp
                    </a>
                    <button onClick={() => startEdit(a)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Edit</button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={saving === a.id}
                      className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                    >
                      {saving === a.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
                {a.comments.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-brand-line pt-2">
                    {a.comments.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                        <span><span className="font-bold">{c.authorName}:</span> {c.body}</span>
                        <button
                          onClick={() => handleDeleteComment(a.id, c.id)}
                          disabled={saving === c.id}
                          className="text-brand-primary disabled:opacity-50 flex-shrink-0"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleCreate} className="border border-brand-line rounded p-4 space-y-3">
        <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">New Announcement</p>
        <input
          placeholder="Title" required className="input w-full"
          value={title} onChange={e => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Body" required rows={3} className="input w-full"
          value={body} onChange={e => setBody(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-brand-muted">
          <input type="checkbox" checked={emailParents} onChange={e => setEmailParents(e.target.checked)} />
          Also email all parents
        </label>
        <button type="submit" disabled={creating} className="btn-primary text-sm w-full">
          {creating ? (emailParents ? 'Posting & emailing…' : 'Creating…') : 'Create Announcement'}
        </button>
      </form>
    </section>
  )
}
