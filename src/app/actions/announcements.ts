'use server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

export type Announcement = { id: string; title: string; body: string; createdAt: string }
export type Comment = { id: string; announcementId: string; authorName: string; body: string; createdAt: string }

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

export type CreateAnnouncementInput = { title: string; body: string }

// Admin: create a new announcement.
export async function createAnnouncement(input: CreateAnnouncementInput): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('announcements').insert({ title: input.title, body: input.body })
  if (error) return { error: 'Failed to create announcement' }
  return {}
}

// Admin: edit an existing announcement.
export async function updateAnnouncement(id: string, input: CreateAnnouncementInput): Promise<{ error?: string }> {
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
  if (!user) return { error: 'You must be logged in to comment.' }

  const supabase = createSupabaseServiceClient()
  const { data: parent } = await supabase.from('parents').select('name').eq('user_id', user.id).single()
  const authorName = parent?.name ?? 'A club member'

  const { error } = await supabase.from('announcement_comments').insert({
    announcement_id: announcementId,
    user_id: user.id,
    author_name: authorName,
    body,
  })
  if (error) return { error: 'Failed to post comment' }
  return {}
}

// Admin: delete any comment.
export async function deleteComment(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('announcement_comments').delete().eq('id', id)
  if (error) return { error: 'Failed to delete comment' }
  return {}
}
