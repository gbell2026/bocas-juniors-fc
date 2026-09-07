'use server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { RESEND_FROM } from '@/lib/resend-from'

export type Announcement = { id: string; title: string; body: string; createdAt: string }
export type Comment = { id: string; announcementId: string; authorName: string; body: string; createdAt: string }

export type EmailResult = { sent: number; failed: number; error?: string }

// Public: all announcements newest-first, each with its comments oldest-first.
export async function getAnnouncements(): Promise<(Announcement & { comments: Comment[] })[]> {
  const supabase = createSupabaseServiceClient()
  const { data: announcements } = await supabase
    .from('announcements').select('*').order('created_at', { ascending: false })
  const { data: comments } = await supabase
    .from('announcement_comments').select('*').order('created_at', { ascending: true })

  const commentsByAnnouncement = new Map<string, Comment[]>()
  for (const c of comments ?? []) {
    const list = commentsByAnnouncement.get(c.announcement_id) ?? []
    list.push({ id: c.id, announcementId: c.announcement_id, authorName: c.author_name, body: c.body, createdAt: c.created_at })
    commentsByAnnouncement.set(c.announcement_id, list)
  }

  return (announcements ?? []).map(a => ({
    id: a.id, title: a.title, body: a.body, createdAt: a.created_at,
    comments: commentsByAnnouncement.get(a.id) ?? [],
  }))
}

export type CreateAnnouncementInput = { title: string; body: string; emailParents?: boolean }

export type CreateAnnouncementResult = {
  error?: string
  announcement?: Announcement
  email?: EmailResult
}

// Admin: create a new announcement, optionally emailing every parent.
export async function createAnnouncement(input: CreateAnnouncementInput): Promise<CreateAnnouncementResult> {
  if (!input.title.trim() || !input.body.trim()) return { error: 'Title and body are both required.' }
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('announcements')
    .insert({ title: input.title, body: input.body })
    .select()
    .single()
  if (error || !data) return { error: 'Failed to create announcement' }

  const result: CreateAnnouncementResult = {
    announcement: { id: data.id, title: data.title, body: data.body, createdAt: data.created_at },
  }
  if (input.emailParents) {
    result.email = await emailAllParents(input.title.trim(), input.body.trim())
  }
  return result
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Best-effort broadcast to every parent's email. Never throws — a failure here
// must not undo an already-posted announcement (mirrors register.ts's
// non-blocking email approach). Reaches real inboxes only once RESEND_FROM is
// set to a verified-domain address.
export async function emailAllParents(subject: string, body: string): Promise<EmailResult> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('parents').select('email')
  const recipients = Array.from(
    new Set(
      (data ?? [])
        .map(p => p.email?.trim().toLowerCase())
        .filter((e): e is string => !!e && e.includes('@'))
    )
  )
  if (recipients.length === 0) return { sent: 0, failed: 0 }

  const html = body
    .split('\n')
    .map(line => (line.trim() === '' ? '<br/>' : `<p>${escapeHtml(line)}</p>`))
    .join('')

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    let sent = 0
    let failed = 0
    for (let i = 0; i < recipients.length; i += 100) {
      const chunk = recipients.slice(i, i + 100)
      const { error } = await resend.batch.send(
        chunk.map(to => ({
          from: RESEND_FROM,
          to: [to],
          replyTo: process.env.ADMIN_EMAIL,
          subject,
          text: body,
          html,
        }))
      )
      if (error) {
        failed += chunk.length
        console.error('emailAllParents Resend error:', error)
      } else {
        // Resend's strict batch returns one result per input on success.
        sent += chunk.length
      }
    }
    return { sent, failed, error: sent === 0 ? 'No emails were sent — check the Resend sending domain.' : undefined }
  } catch (e) {
    console.error('emailAllParents threw:', e)
    return { sent: 0, failed: recipients.length, error: 'Email service failed.' }
  }
}

// Admin: edit an existing announcement.
export async function updateAnnouncement(id: string, input: CreateAnnouncementInput): Promise<{ error?: string }> {
  if (!input.title.trim() || !input.body.trim()) return { error: 'Title and body are both required.' }
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('announcements')
    .update({ title: input.title, body: input.body, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: 'Failed to update announcement' }
  return {}
}

// Admin: delete an announcement (its comments cascade-delete with it).
export async function deleteAnnouncement(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) return { error: 'Failed to delete announcement' }
  return {}
}

// Public, but requires an authenticated session: post a comment on an
// announcement. Derives the caller's identity from their real session via
// the session-aware client — never trust a client-supplied user id — then
// uses the service-role client for the parents lookup and the actual write.
export async function postComment(announcementId: string, body: string): Promise<{ error?: string }> {
  const supabaseSession = await createSupabaseServerClient()
  const { data: { user } } = await supabaseSession.auth.getUser()
  if (!user) return { error: 'must_be_logged_in' }
  if (!body.trim()) return { error: 'comment_required' }

  const supabase = createSupabaseServiceClient()
  const { data: parent } = await supabase.from('parents').select('name').eq('user_id', user.id).single()
  const authorName = parent?.name ?? 'A club member'

  const { error } = await supabase.from('announcement_comments').insert({
    announcement_id: announcementId,
    user_id: user.id,
    author_name: authorName,
    body,
  })
  if (error) return { error: 'comment_failed' }
  return {}
}

// Admin: delete any comment.
export async function deleteComment(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('announcement_comments').delete().eq('id', id)
  if (error) return { error: 'Failed to delete comment' }
  return {}
}
