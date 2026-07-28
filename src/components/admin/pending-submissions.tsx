'use client'
import { useState } from 'react'
import type { Media } from '@/lib/supabase/types'
import { approveSubmission, rejectSubmission } from '@/app/actions/admin'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function PendingSubmissions({ submissions: initial }: { submissions: Media[] }) {
  const [items, setItems] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState<Set<string>>(new Set())

  if (items.length === 0) return null

  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

  async function handleApprove(id: string) {
    setError(null)
    setProcessing(prev => new Set(prev).add(id))
    try {
      await approveSubmission(id)
      setItems(prev => prev.filter(s => s.id !== id))
    } catch {
      setError('Approval failed. Please try again.')
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  async function handleReject(item: Media) {
    // Note: window.confirm is synchronous and works correctly here because it runs
    // before the first await. Browsers may suppress this in iframe/PWA contexts.
    if (!window.confirm('Reject and delete this submission?')) return
    setError(null)
    setProcessing(prev => new Set(prev).add(item.id))
    try {
      const resourceType = item.type === 'video' ? 'video' : 'image'
      await rejectSubmission(item.id, item.cloudinary_public_id, resourceType)
      setItems(prev => prev.filter(s => s.id !== item.id))
    } catch {
      setError('Rejection failed. The item has been kept.')
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(item.id); return s })
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Pending Submissions ({items.length})</h2>
      {error && <p className="text-brand-primary text-sm mb-2">{error}</p>}
      <div className="space-y-3">
        {items.map(item => (
          <div
            key={item.id}
            className="flex gap-4 items-start bg-brand-tint border border-brand-line rounded p-3"
          >
            {/* Thumbnail */}
            <div className="w-16 h-16 rounded bg-brand-creamAlt overflow-hidden flex-shrink-0 flex items-center justify-center">
              {item.type === 'photo' ? (
                <img
                  src={`https://res.cloudinary.com/${cloud}/image/upload/w_120,h_120,c_fill,q_auto,f_auto/${item.cloudinary_public_id}`}
                  alt={item.caption ?? ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-brand-mutedWarm text-2xl">▶</span>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-brand-ink font-bold text-sm">{item.submitter_name ?? 'Anonymous'}</p>
              {item.caption && <p className="text-brand-muted text-xs mt-0.5">{item.caption}</p>}
              <p className="text-brand-mutedWarm text-xs mt-0.5">{formatDate(item.uploaded_at)}</p>
            </div>
            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleApprove(item.id)}
                disabled={processing.has(item.id)}
                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(item)}
                disabled={processing.has(item.id)}
                className="text-xs px-3 py-1.5 border border-brand-primary text-brand-primary rounded font-bold uppercase tracking-wider hover:bg-brand-primary hover:text-white transition disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
