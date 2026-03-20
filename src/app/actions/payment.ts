'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PaymentMethod } from '@/lib/supabase/types'

export type RequestPaymentResult = { error?: string }

// Parent-initiated: create a pending payment record for any method
export async function requestPayment({
  playerId, parentId, method, parentName, playerName,
}: {
  playerId: string; parentId: string; method: PaymentMethod
  parentName: string; playerName: string
}): Promise<RequestPaymentResult> {
  const supabase = createSupabaseServiceClient()

  const { data: setting } = await supabase
    .from('settings').select('value').eq('key', 'membership_fee_cents').single()
  const amount = parseInt(setting?.value ?? '2500', 10)

  const { error } = await supabase.from('payments').insert({
    parent_id: parentId,
    player_id: playerId,
    payment_method: method,
    amount,
    currency: 'usd',
    status: 'pending',
    notes: `${method} payment requested by ${parentName} for ${playerName}`,
  })

  if (error) return { error: 'Failed to create payment request' }

  // MVP: log to console. Phase 2: send email via Resend.
  console.log(`[ADMIN NOTIFY] ${method} payment requested: ${parentName} for ${playerName}`)
  return {}
}

// Admin: confirm a pending payment (any method)
export async function confirmPayment(paymentId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('payments')
    .update({ status: 'succeeded', paid_at: new Date().toISOString() })
    .eq('id', paymentId)
  const { data: payment } = await supabase
    .from('payments').select('player_id').eq('id', paymentId).single()
  if (payment) {
    await supabase.from('players').update({ status: 'active' }).eq('id', payment.player_id)
  }
  return {}
}

// Admin: deny a pending payment (any method)
export async function denyPayment(paymentId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('payments')
    .update({ status: 'failed' })
    .eq('id', paymentId)
  return {}
}

// Admin: directly mark a player as paid with cash (no prior pending record needed)
export async function adminMarkCashPaid({
  playerId, parentId, adminNotes,
}: { playerId: string; parentId: string; adminNotes?: string }) {
  const supabase = createSupabaseServiceClient()
  const { data: setting } = await supabase
    .from('settings').select('value').eq('key', 'membership_fee_cents').single()
  const amount = parseInt(setting?.value ?? '2500', 10)

  await supabase.from('payments').insert({
    parent_id: parentId,
    player_id: playerId,
    payment_method: 'cash',
    amount,
    currency: 'usd',
    status: 'succeeded',
    paid_at: new Date().toISOString(),
    notes: adminNotes ?? 'Cash paid directly — marked by admin',
  })
  await supabase.from('players').update({ status: 'active' }).eq('id', playerId)
  return {}
}

// Server action called by PaymentOptionsPanel to fetch settings for display
export async function getPaymentSettings() {
  const supabase = createSupabaseServiceClient()
  const { data: settings } = await supabase.from('settings').select('*')
  const map = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))
  return {
    feeCents: parseInt(map.membership_fee_cents ?? '2500', 10),
    paypalMeUrl: map.paypal_me_url ?? '',
    monzoDetails: map.monzo_details ?? '',
    revolutDetails: map.revolut_details ?? '',
  }
}
