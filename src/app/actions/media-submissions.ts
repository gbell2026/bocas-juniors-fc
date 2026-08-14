'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function submitMediaRecord({
  cloudinaryPublicId,
  type,
  caption,
  submitterName,
}: {
  cloudinaryPublicId: string
  type: 'photo' | 'video'
  caption?: string
  submitterName?: string
}): Promise<{ error: string | null }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('media').insert({
    cloudinary_public_id: cloudinaryPublicId,
    type,
    caption: caption ?? null,
    submitter_name: submitterName ?? null,
    uploaded_by: null,
    published: false,
    pinned: false,
  })
  return { error: error ? 'submission_failed' : null }
}
