import type { PaymentPlan, InstallmentLabel } from './supabase/types'

export type Installment = { label: InstallmentLabel; amountCents: number }

// One-time $30 registration fee, due first for every plan — separate from
// and in addition to the season fee below. Never discounted, even for a
// sibling — only the season fee is halved for a second (or later) child.
const REGISTRATION_FEE: Installment = { label: 'registration', amountCents: 3000 }

function buildFullPlan(discounted: boolean): Installment[] {
  return [
    REGISTRATION_FEE,
    { label: 'full', amountCents: discounted ? 10500 : 21000 },
  ]
}

function buildMonthlyPlan(discounted: boolean): Installment[] {
  const halve = (cents: number) => discounted ? cents / 2 : cents
  return [
    REGISTRATION_FEE,
    { label: 'august', amountCents: halve(3000) },
    { label: 'september', amountCents: halve(6000) },
    { label: 'october', amountCents: halve(6000) },
    { label: 'november', amountCents: halve(6000) },
  ]
}

/**
 * `discounted` applies the 50% sibling discount to the season fee only —
 * for the second (and every subsequent) child registered under the same
 * parent, determined by registration order. The one-time registration fee
 * is always full price regardless.
 */
export function getSchedule(plan: PaymentPlan, discounted = false): Installment[] {
  return plan === 'full' ? buildFullPlan(discounted) : buildMonthlyPlan(discounted)
}

/**
 * Given a plan and the installment labels that already have a *succeeded* payment,
 * returns the next installment due, or null if every installment in the plan is paid.
 */
export function getNextDue(
  plan: PaymentPlan,
  paidLabels: InstallmentLabel[],
  discounted = false
): (Installment & { isFirstInstallment: boolean }) | null {
  const schedule = getSchedule(plan, discounted)
  const paidSet = new Set(paidLabels)
  const index = schedule.findIndex(inst => !paidSet.has(inst.label))
  if (index === -1) return null
  return { ...schedule[index], isFirstInstallment: index === 0 }
}

/**
 * "Registration fee paid" means the one-time $30 registration installment
 * (always first in the sequence, for both plans) has a succeeded payment —
 * regardless of whether the season fee itself is still outstanding.
 */
export function isRegistrationFeePaid(plan: PaymentPlan, paidLabels: InstallmentLabel[]): boolean {
  const firstLabel = getSchedule(plan)[0].label
  return paidLabels.includes(firstLabel)
}

export function getPlanTotalCents(plan: PaymentPlan, discounted = false): number {
  return getSchedule(plan, discounted).reduce((sum, inst) => sum + inst.amountCents, 0)
}
