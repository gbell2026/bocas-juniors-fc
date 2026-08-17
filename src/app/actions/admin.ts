'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PlayerStatus, Media, GetInvolvedSubmission, PaymentPlan, InstallmentLabel } from '@/lib/supabase/types'
import { isRegistrationFeePaid } from '@/lib/payment-schedule'
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
    .select('*, parents(name, email), payments(paid_at, status, installment_label)')
    .order('name')
  // Attach last succeeded payment date and registration-fee-paid status to each player
  return (data ?? []).map(p => {
    const succeeded = (p.payments as any[])?.filter((pay: any) => pay.status === 'succeeded') ?? []
    const paidLabels = succeeded
      .map((pay: any) => pay.installment_label)
      .filter((label: any): label is InstallmentLabel => label !== null)
    return {
      ...p,
      lastPaidAt: succeeded.map((pay: any) => pay.paid_at).sort().at(-1) ?? null,
      regFeePaid: isRegistrationFeePaid(p.payment_plan, paidLabels),
      ageGroups: p.age_groups,
      hasPayments: ((p.payments as any[]) ?? []).length > 0,
    }
  })
}

export async function updatePlayerPaymentPlan(playerId: string, paymentPlan: PaymentPlan) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players').update({ payment_plan: paymentPlan }).eq('id', playerId)
}

export async function updatePlayerAgeGroups(playerId: string, ageGroups: string[]) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players').update({ age_groups: ageGroups }).eq('id', playerId)
}

// Reversible — sets the player aside without touching their payment
// history. Does not preserve a prior injured/away status or return_date;
// restorePlayer always lands them back on 'active'. This is a deliberate
// simplification (see spec) — if a restored player still needs
// injured/away re-applied, admin does that afterward via the status
// dropdown.
export async function cancelPlayer(playerId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players').update({ status: 'cancelled', return_date: null }).eq('id', playerId)
}

export async function restorePlayer(playerId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players').update({ status: 'active' }).eq('id', playerId)
}

// Permanently removes a player row — only when they have zero payment
// records (of ANY status: pending, succeeded, or failed). payments.player_id
// is `on delete cascade`, so deleting a player with payment history would
// silently destroy their financial records; this check exists specifically
// to make that impossible, and is re-validated here even though the UI
// already hides the Delete button once payments exist — never trust the
// client alone for the one irreversible path in this feature.
export async function deletePlayer(playerId: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { data: payments } = await supabase.from('payments').select('id').eq('player_id', playerId).limit(1)
  if (payments && payments.length > 0) {
    return { error: 'Cannot delete a player with payment history — cancel instead.' }
  }
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) return { error: 'Failed to delete player' }
  return {}
}

// Admin: create a login for a coach. Mirrors registerParentAndPlayer's
// create-then-rollback pattern — a coach account is an auth user plus a
// user_roles row; if the role assignment fails, the orphaned auth user is
// deleted rather than left dangling with no role.
export async function createCoachAccount(input: { name: string; email: string; password: string }): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  })
  if (authError || !authData.user) return { error: 'Failed to create login' }

  const { error: roleError } = await supabase
    .from('user_roles').insert({ user_id: authData.user.id, role: 'coach' })
  if (roleError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { error: 'Failed to assign coach role' }
  }

  return {}
}

export async function getCoachAccounts(): Promise<{ userId: string; email: string }[]> {
  const supabase = createSupabaseServiceClient()
  const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'coach')
  const results: { userId: string; email: string }[] = []
  for (const row of roleRows ?? []) {
    const { data } = await supabase.auth.admin.getUserById(row.user_id)
    if (data.user?.email) results.push({ userId: row.user_id, email: data.user.email })
  }
  return results
}

export async function deleteCoachAccount(userId: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error: roleError } = await supabase.from('user_roles').delete().eq('user_id', userId)
  if (roleError) return { error: 'Failed to remove coach role' }
  await supabase.auth.admin.deleteUser(userId)
  return {}
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
