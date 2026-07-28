export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-brand-tint border-l-4 border-brand-primary px-6 py-5">
      <h1 className="font-heading text-brand-ink uppercase tracking-wider text-3xl">{title}</h1>
      {subtitle && (
        <p className="text-brand-primaryDeep font-bold uppercase tracking-[0.25em] text-xs mt-1">{subtitle}</p>
      )}
    </div>
  )
}
