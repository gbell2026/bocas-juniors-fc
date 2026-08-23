import type { PaymentPlan, InstallmentLabel } from './supabase/types'

export type Installment = { label: InstallmentLabel; amountCents: number }
export type JoinMonth = 'august' | 'september' | 'october' | 'november'

// One-time $30 registration fee, due first for every plan — separate from
// and in addition to the season fee below. Never discounted, even for a
// sibling — only the season fee is halved for a second (or later) child.
const REGISTRATION_FEE: Installment = { label: 'registration', amountCents: 3000 }

export const JOIN_MONTHS: JoinMonth[] = ['august', 'september', 'october', 'november']
const MONTH_ORDER = JOIN_MONTHS
const MONTH_RATE_CENTS: Record<JoinMonth, number> = {
  august: 3000, // half rate — preseason/partial month
  september: 6000,
  october: 6000,
  november: 6000,
}

// Months from (and including) the join month through the end of the
// season — a family never pays for months before they joined.
function remainingMonths(joinMonth: JoinMonth): JoinMonth[] {
  return MONTH_ORDER.slice(MONTH_ORDER.indexOf(joinMonth))
}

function buildFullPlan(discounted: boolean, joinMonth: JoinMonth): Installment[] {
  const seasonTotal = remainingMonths(joinMonth).reduce((sum, m) => sum + MONTH_RATE_CENTS[m], 0)
  return [
    REGISTRATION_FEE,
    { label: 'full', amountCents: discounted ? seasonTotal / 2 : seasonTotal },
  ]
}

function buildMonthlyPlan(discounted: boolean, joinMonth: JoinMonth): Installment[] {
  const halve = (cents: number) => discounted ? cents / 2 : cents
  return [
    REGISTRATION_FEE,
    ...remainingMonths(joinMonth).map(month => ({ label: month as InstallmentLabel, amountCents: halve(MONTH_RATE_CENTS[month]) })),
  ]
}

/**
 * `discounted` applies the 50% sibling discount to the season fee only —
 * for the second (and every subsequent) child registered under the same
 * parent, determined by registration order. The one-time registration fee
 * is always full price regardless.
 *
 * `joinMonth` prorates the season fee to only the months from (and
 * including) that month onward — a family joining in October never owes
 * August or September. Defaults to 'august', which reproduces the full
 * four-month schedule exactly (existing players default to this).
 */
export function getSchedule(plan: PaymentPlan, discounted = false, joinMonth: JoinMonth = 'august'): Installment[] {
  return plan === 'full' ? buildFullPlan(discounted, joinMonth) : buildMonthlyPlan(discounted, joinMonth)
}

/**
 * Given a plan and the installment labels that already have a *succeeded* payment,
 * returns the next installment due, or null if every installment in the plan is paid.
 */
export function getNextDue(
  plan: PaymentPlan,
  paidLabels: InstallmentLabel[],
  discounted = false,
  joinMonth: JoinMonth = 'august'
): (Installment & { isFirstInstallment: boolean }) | null {
  const schedule = getSchedule(plan, discounted, joinMonth)
  const paidSet = new Set(paidLabels)
  const index = schedule.findIndex(inst => !paidSet.has(inst.label))
  if (index === -1) return null
  return { ...schedule[index], isFirstInstallment: index === 0 }
}

/**
 * "Registration fee paid" means the one-time $30 registration installment
 * (always first in the sequence, for both plans, regardless of join month)
 * has a succeeded payment — regardless of whether the season fee itself is
 * still outstanding.
 */
export function isRegistrationFeePaid(plan: PaymentPlan, paidLabels: InstallmentLabel[]): boolean {
  const firstLabel = getSchedule(plan)[0].label
  return paidLabels.includes(firstLabel)
}

export function getPlanTotalCents(plan: PaymentPlan, discounted = false, joinMonth: JoinMonth = 'august'): number {
  return getSchedule(plan, discounted, joinMonth).reduce((sum, inst) => sum + inst.amountCents, 0)
}

export type MonthStatus = 'paid' | 'pending' | 'outstanding' | 'notApplicable'
export type MonthlyStatus = { month: JoinMonth; status: MonthStatus }

/**
 * Per-month view of the season fee, for a "which months has this player
 * paid" display. On the monthly plan, each month has its own label and is
 * checked independently. On the full plan, the season fee is one lump-sum
 * installment (label 'full') — its single status applies to every month
 * from the join month onward at once, since paying it covers the whole
 * remaining season in one go. Months before the join month are
 * 'notApplicable': the player never owed for them.
 */
export function getMonthlyStatus(
  plan: PaymentPlan,
  paidLabels: InstallmentLabel[],
  pendingLabels: InstallmentLabel[],
  joinMonth: JoinMonth = 'august'
): MonthlyStatus[] {
  const joinIndex = MONTH_ORDER.indexOf(joinMonth)
  const statusOf = (label: InstallmentLabel): MonthStatus =>
    paidLabels.includes(label) ? 'paid' : pendingLabels.includes(label) ? 'pending' : 'outstanding'
  const seasonStatus = plan === 'full' ? statusOf('full') : null

  return MONTH_ORDER.map((month, i) => ({
    month,
    status: i < joinIndex ? 'notApplicable' : seasonStatus ?? statusOf(month as InstallmentLabel),
  }))
}
