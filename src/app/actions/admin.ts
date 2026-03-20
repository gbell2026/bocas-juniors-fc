'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PlayerStatus } from '@/lib/supabase/types'

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
