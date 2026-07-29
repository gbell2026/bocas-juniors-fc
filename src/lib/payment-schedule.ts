import type { PaymentPlan, InstallmentLabel } from './supabase/types'

export type Installment = { label: InstallmentLabel; amountCents: number }

const FULL_PLAN: Installment[] = [
  { label: 'full', amountCents: 21000 },
]

const MONTHLY_PLAN: Installment[] = [
  { label: 'august', amountCents: 3000 },
  { label: 'september', amountCents: 6000 },
  { label: 'october', amountCents: 6000 },
  { label: 'november', amountCents: 6000 },
]

function getSchedule(plan: PaymentPlan): Installment[] {
  return plan === 'full' ? FULL_PLAN : MONTHLY_PLAN
}

/**
 * Given a plan and the installment labels that already have a *succeeded* payment,
 * returns the next installment due, or null if every installment in the plan is paid.
 */
export function getNextDue(
  plan: PaymentPlan,
  paidLabels: InstallmentLabel[]
): (Installment & { isFirstInstallment: boolean }) | null {
  const schedule = getSchedule(plan)
  const paidSet = new Set(paidLabels)
  const index = schedule.findIndex(inst => !paidSet.has(inst.label))
  if (index === -1) return null
  return { ...schedule[index], isFirstInstallment: index === 0 }
}

/**
 * "Registration fee paid" means the *first* installment in the plan's sequence
 * has a succeeded payment — regardless of whether later monthly installments
 * are still outstanding.
 */
export function isRegistrationFeePaid(plan: PaymentPlan, paidLabels: InstallmentLabel[]): boolean {
  const firstLabel = getSchedule(plan)[0].label
  return paidLabels.includes(firstLabel)
}

export function getPlanTotalCents(plan: PaymentPlan): number {
  return getSchedule(plan).reduce((sum, inst) => sum + inst.amountCents, 0)
}
