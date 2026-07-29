'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PaymentMethod, PaymentPlan, InstallmentLabel } from '@/lib/supabase/types'
import { getNextDue } from '@/lib/payment-schedule'

export type RequestPaymentResult = { error?: string }

/**
 * Computes what a player currently owes, based on their stored payment plan
 * and which installments already have a succeeded payment. Returns null if
 * every installment in their plan is paid. This is the single source of
 * truth for "amount due" — callers must not accept a client-supplied amount.
 */
export async function getAmountDue(playerId: string) {
  const supabase = createSupabaseServiceClient()

  const { data: player } = await supabase
    .from('players').select('payment_plan').eq('id', playerId).single()
  const plan = (player?.payment_plan ?? 'full') as PaymentPlan

  const { data: succeededPayments } = await supabase
    .from('payments').select('installment_label')
    .eq('player_id', playerId).eq('status', 'succeeded')

  const paidLabels = (succeededPayments ?? [])
    .map(p => p.installment_label)
    .filter((label): label is InstallmentLabel => label !== null)

  return getNextDue(plan, paidLabels)
}

// Parent-initiated: create a pending payment record for any method
export async function requestPayment({
  playerId, parentId, method, parentName, playerName,
}: {
  playerId: string; parentId: string; method: PaymentMethod
  parentName: string; playerName: string
}): Promise<RequestPaymentResult> {
  const supabase = createSupabaseServiceClient()

  const due = await getAmountDue(playerId)
  if (!due) return { error: 'No payment is currently due for this player' }

  const { error } = await supabase.from('payments').insert({
    parent_id: parentId,
    player_id: playerId,
    payment_method: method,
    amount: due.amountCents,
    installment_label: due.label,
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

  const due = await getAmountDue(playerId)
  if (!due) return { error: 'No payment is currently due for this player' }

  await supabase.from('payments').insert({
    parent_id: parentId,
    player_id: playerId,
    payment_method: 'cash',
    amount: due.amountCents,
    installment_label: due.label,
    currency: 'usd',
    status: 'succeeded',
    paid_at: new Date().toISOString(),
    notes: adminNotes ?? 'Cash paid directly — marked by admin',
  })
  await supabase.from('players').update({ status: 'active' }).eq('id', playerId)
  return {}
}

// Server action called by PaymentOptionsPanel to fetch settings for display
// (payment provider details only — the fee amount is per-player, see getAmountDue)
export async function getPaymentSettings() {
  const supabase = createSupabaseServiceClient()
  const { data: settings } = await supabase.from('settings').select('*')
  const map = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))
  return {
    paypalMeUrl: map.paypal_me_url ?? '',
    monzoDetails: map.monzo_details ?? '',
    revolutDetails: map.revolut_details ?? '',
  }
}
