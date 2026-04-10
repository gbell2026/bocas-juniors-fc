'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PlayerStatus, Media, GetInvolvedSubmission } from '@/lib/supabase/types'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function updatePlayerStatus(
  playerId: string,
  status: PlayerStatus,
  returnDate?: string
) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players')
    .update({ status, return_date: returnDate ?? null })
    .eq('id', playerId)
}

export async function saveMediaRecord({
  cloudinaryPublicId, type, caption, uploadedBy
}: { cloudinaryPublicId: string; type: 'photo' | 'video'; caption?: string; uploadedBy: string }) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('media').insert({
    cloudinary_public_id: cloudinaryPublicId,
    type,
    caption: caption ?? null,
    uploaded_by: uploadedBy,
    published: true,
  })
}

export async function getPendingPayments() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('payments')
    .select('*, players(name), parents(name)')
    .eq('status', 'pending')
    .order('paid_at', { ascending: true })
  return data ?? []
}

export async function getAllPlayers() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('players')
    .select('*, parents(name, email), payments(paid_at, status)')
    .order('name')
  // Attach last succeeded payment date to each player
  return (data ?? []).map(p => ({
    ...p,
    lastPaidAt: (p.payments as any[])
      ?.filter((pay: any) => pay.status === 'succeeded')
      .map((pay: any) => pay.paid_at)
      .sort()
      .at(-1) ?? null,
  }))
}

export async function getTotalRevenue() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('payments')
    .select('amount')
    .eq('status', 'succeeded')
  return (data ?? []).reduce((sum, p) => sum + p.amount, 0)
}

export async function getPendingSubmissions(): Promise<Media[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('media')
    .select('*')
    .eq('published', false)
    .is('uploaded_by', null)
    .order('uploaded_at', { ascending: true })
  return data ?? []
}

export async function approveSubmission(id: string): Promise<void> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('media').update({ published: true }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function rejectSubmission(
  id: string,
  cloudinaryPublicId: string,
  resourceType: 'image' | 'video'
): Promise<void> {
  // Delete from Cloudinary first (fail open — proceed to DB delete even if this fails)
  try {
    await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: resourceType })
  } catch (err) {
    console.error('Cloudinary delete failed (proceeding to DB delete):', err)
  }
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('media').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getGetInvolvedSubmissions(): Promise<GetInvolvedSubmission[]> {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('get_involved_submissions')
    .select('*')
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function markSubmissionHandled(id: string): Promise<void> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('get_involved_submissions')
    .update({ handled: true })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
