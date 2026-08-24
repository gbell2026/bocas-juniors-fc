'use client'
import type { FinanceSeason, FinanceCategory } from '@/app/actions/finances'

type Props = {
  seasons: FinanceSeason[]
  categories: FinanceCategory[]
}

export function FinancesAdmin({ seasons, categories }: Props) {
  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Finances</h2>
      <p className="text-brand-muted text-sm">{seasons.length} season(s), {categories.length} categories.</p>
    </section>
  )
}
