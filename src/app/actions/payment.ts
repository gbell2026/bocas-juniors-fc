'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PaymentMethod, PaymentPlan, InstallmentLabel } from '@/lib/supabase/types'
import { getNextDue, getSchedule } from '@/lib/payment-schedule'

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

export type ScheduleItemStatus = 'paid' | 'pending' | 'outstanding'
export type ScheduleItem = { label: InstallmentLabel; amountCents: number; status: ScheduleItemStatus }

/**
 * Full breakdown of every installment in a player's plan (registration fee
 * plus every season installment), each tagged with its current status.
 * Shown as a table so a parent can see the whole picture in one place —
 * paying the registration fee doesn't make it look like everything is done.
 */
export async function getPaymentSchedule(playerId: string): Promise<ScheduleItem[]> {
  const supabase = createSupabaseServiceClient()

  const { data: player } = await supabase
    .from('players').select('payment_plan').eq('id', playerId).single()
  const plan = (player?.payment_plan ?? 'full') as PaymentPlan

  const { data: payments } = await supabase
    .from('payments').select('installment_label, status')
    .eq('player_id', playerId).in('status', ['succeeded', 'pending'])

  const paidLabels = new Set<InstallmentLabel>()
  const pendingLabels = new Set<InstallmentLabel>()
  for (const p of payments ?? []) {
    if (!p.installment_label) continue
    if (p.status === 'succeeded') paidLabels.add(p.installment_label)
    else if (p.status === 'pending') pendingLabels.add(p.installment_label)
  }

  return getSchedule(plan).map(inst => ({
    ...inst,
    status: paidLabels.has(inst.label) ? 'paid' : pendingLabels.has(inst.label) ? 'pending' : 'outstanding',
  }))
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

  // Notify admin (non-blocking — don't let email failures break the payment request)
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: 'Tangerine Toucans <onboarding@resend.dev>',
      to: ['g.bell2010@googlemail.com'],
      subject: `Payment reported — ${playerName} (${method})`,
      text: `A payment has been self-reported and needs review.\n\nPlayer: ${playerName}\nParent: ${parentName}\nMethod: ${method}\nAmount: $${(due.amountCents / 100).toFixed(2)}\nInstallment: ${due.label}\n\nConfirm or deny it from /admin.`,
    })
    if (emailError) console.error('Resend error:', emailError)
  } catch (e) {
    console.error('Resend threw:', e)
  }

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

// Called by the nav bar to decide whether to show a "registration fee
// outstanding" banner for the currently logged-in parent. Follows the
// existing single-player-per-parent assumption used elsewhere (e.g.
// profile/page.tsx's `parent?.players?.[0]`). Returns null if the user
// has no parent record yet, or no player registered yet — the banner
// simply doesn't show in either case.
export async function getRegFeeAlertForUser(userId: string): Promise<{ playerId: string; regFeePaid: boolean } | null> {
  const supabase = createSupabaseServiceClient()

  const { data: parent } = await supabase.from('parents').select('id').eq('user_id', userId).single()
  if (!parent) return null

  const { data: players } = await supabase.from('players').select('id').eq('parent_id', parent.id).limit(1)
  const player = players?.[0]
  if (!player) return null

  const due = await getAmountDue(player.id)
  return { playerId: player.id, regFeePaid: due === null || !due.isFirstInstallment }
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
