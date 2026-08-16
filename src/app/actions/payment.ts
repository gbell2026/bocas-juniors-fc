'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PaymentMethod, PaymentPlan, InstallmentLabel } from '@/lib/supabase/types'
import { getNextDue, getSchedule, type JoinMonth } from '@/lib/payment-schedule'

export type RequestPaymentResult = { error?: string }

/**
 * A player qualifies for the 50% sibling discount on the season fee if
 * they're not the first-registered child under their parent (by
 * `created_at`). A parent with no `parent_id` match or a lookup failure is
 * treated as not discounted — never silently discount when uncertain.
 */
async function isDiscountedSibling(playerId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient()

  const { data: player } = await supabase
    .from('players').select('parent_id').eq('id', playerId).single()
  if (!player) return false

  const { data: siblings } = await supabase
    .from('players').select('id').eq('parent_id', player.parent_id).order('created_at', { ascending: true })
  const index = (siblings ?? []).findIndex(s => s.id === playerId)
  return index > 0
}

/**
 * Computes what a player currently owes, based on their stored payment plan,
 * whether they qualify for the sibling discount, and which installments
 * already have a succeeded payment. Returns null if every installment in
 * their plan is paid. This is the single source of truth for "amount due" —
 * callers must not accept a client-supplied amount.
 */
export async function getAmountDue(playerId: string) {
  const supabase = createSupabaseServiceClient()

  const { data: player } = await supabase
    .from('players').select('payment_plan, join_month').eq('id', playerId).single()
  const plan = (player?.payment_plan ?? 'full') as PaymentPlan
  const joinMonth = (player?.join_month ?? 'august') as JoinMonth

  const { data: succeededPayments } = await supabase
    .from('payments').select('installment_label')
    .eq('player_id', playerId).eq('status', 'succeeded')

  const paidLabels = (succeededPayments ?? [])
    .map(p => p.installment_label)
    .filter((label): label is InstallmentLabel => label !== null)

  const discounted = await isDiscountedSibling(playerId)
  return getNextDue(plan, paidLabels, discounted, joinMonth)
}

export type ScheduleItemStatus = 'paid' | 'pending' | 'outstanding'
export type ScheduleItem = { label: InstallmentLabel; amountCents: number; status: ScheduleItemStatus; discounted: boolean }

/**
 * Full breakdown of every installment in a player's plan (registration fee
 * plus every season installment), each tagged with its current status.
 * Shown as a table so a parent can see the whole picture in one place —
 * paying the registration fee doesn't make it look like everything is done.
 */
export async function getPaymentSchedule(playerId: string): Promise<ScheduleItem[]> {
  const supabase = createSupabaseServiceClient()

  const { data: player } = await supabase
    .from('players').select('payment_plan, join_month').eq('id', playerId).single()
  const plan = (player?.payment_plan ?? 'full') as PaymentPlan
  const joinMonth = (player?.join_month ?? 'august') as JoinMonth

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

  const discounted = await isDiscountedSibling(playerId)
  return getSchedule(plan, discounted, joinMonth).map(inst => ({
    ...inst,
    status: paidLabels.has(inst.label) ? 'paid' : pendingLabels.has(inst.label) ? 'pending' : 'outstanding',
    discounted: discounted && inst.label !== 'registration',
  }))
}

// Parent-initiated: create a pending payment record for a specific
// installment. The client specifies WHICH installment it's paying (by
// label), never the amount — the amount is always derived server-side from
// that item's entry in the player's schedule, so a client still can't submit
// an arbitrary amount. Validating against the live schedule (rather than
// just "the next sequential due item") also lets a parent report more than
// one installment in the same visit — e.g. the registration fee via cash and
// the season fee via PayPal — without waiting for the admin to confirm the
// first one, which could otherwise take a day or more.
export async function requestPayment({
  playerId, parentId, method, parentName, playerName, label,
}: {
  playerId: string; parentId: string; method: PaymentMethod
  parentName: string; playerName: string; label: InstallmentLabel
}): Promise<RequestPaymentResult> {
  const supabase = createSupabaseServiceClient()

  const schedule = await getPaymentSchedule(playerId)
  const item = schedule.find(i => i.label === label)
  if (!item || item.status !== 'outstanding') {
    return { error: 'This item is not currently payable' }
  }

  const { error } = await supabase.from('payments').insert({
    parent_id: parentId,
    player_id: playerId,
    payment_method: method,
    amount: item.amountCents,
    installment_label: item.label,
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
      text: `A payment has been self-reported and needs review.\n\nPlayer: ${playerName}\nParent: ${parentName}\nMethod: ${method}\nAmount: $${(item.amountCents / 100).toFixed(2)}\nInstallment: ${item.label}\n\nConfirm or deny it from /admin.`,
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
// outstanding" banner for the currently logged-in parent. Checks every
// child under the parent (not just one), since a parent can now register
// more than one — the banner shows if ANY child still owes their
// registration fee. Returns null if the user has no parent record yet, or
// no player registered yet — the banner simply doesn't show in either case.
export async function getRegFeeAlertForUser(userId: string): Promise<{ playerId: string; regFeePaid: boolean } | null> {
  const supabase = createSupabaseServiceClient()

  const { data: parent } = await supabase.from('parents').select('id').eq('user_id', userId).single()
  if (!parent) return null

  const { data: players } = await supabase.from('players').select('id').eq('parent_id', parent.id)
  if (!players || players.length === 0) return null

  for (const player of players) {
    const due = await getAmountDue(player.id)
    if (due !== null && due.isFirstInstallment) {
      return { playerId: player.id, regFeePaid: false }
    }
  }

  return { playerId: players[0].id, regFeePaid: true }
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
