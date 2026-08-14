'use client'
import { useState } from 'react'
import { postComment, getAnnouncements } from '@/app/actions/announcements'
import { useLocale } from '@/lib/i18n/locale-context'
import { translateError } from '@/lib/i18n/error-messages'
import type { Locale } from '@/lib/i18n/locale'

type AnnouncementWithComments = Awaited<ReturnType<typeof getAnnouncements>>[number]

function formatDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

export function AnnouncementCard({ announcement, isLoggedIn }: { announcement: AnnouncementWithComments; isLoggedIn: boolean }) {
  const { locale, t } = useLocale()
  const [comments, setComments] = useState(announcement.comments)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await postComment(announcement.id, body)
      if (result.error) { setError(translateError(locale, result.error)); return }
      setBody('')
      // No per-announcement comment fetch exists — refetch everything and
      // pull out just this announcement's fresh comment list. Acceptable at
      // this site's scale (small club, infrequent posting).
      const fresh = await getAnnouncements()
      const updated = fresh.find(a => a.id === announcement.id)
      if (updated) setComments(updated.comments)
    } catch {
      setError(translateError(locale, 'submission_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <article className="bg-brand-tint border border-brand-line rounded-lg p-5">
      <h2 className="font-heading text-brand-ink text-xl uppercase tracking-wide">{announcement.title}</h2>
      <p className="text-brand-mutedWarm text-xs mt-1">{formatDate(announcement.createdAt, locale)}</p>
      <p className="text-brand-ink/90 mt-3 whitespace-pre-wrap">{announcement.body}</p>

      {comments.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-brand-line pt-4">
          {comments.map(c => (
            <div key={c.id} className="text-sm">
              <span className="font-bold text-brand-primaryDeep">{c.authorName}</span>{' '}
              <span className="text-brand-mutedWarm text-xs">{formatDate(c.createdAt, locale)}</span>
              <p className="text-brand-ink/80">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {isLoggedIn ? (
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder={t.announcements.commentPlaceholder}
            aria-label={t.announcements.commentPlaceholder}
            value={body}
            onChange={e => setBody(e.target.value)}
            required
          />
          <button type="submit" disabled={submitting} className="btn-secondary text-xs px-3 disabled:opacity-50">
            {submitting ? t.announcements.posting : t.announcements.post}
          </button>
        </form>
      ) : (
        <p className="text-brand-mutedWarm text-xs mt-4">
          <a href="/login" className="underline">{t.announcements.login}</a> {t.announcements.loginSuffix}
        </p>
      )}
      {error && <p role="alert" className="text-red-500 text-xs mt-2">{error}</p>}
    </article>
  )
}
