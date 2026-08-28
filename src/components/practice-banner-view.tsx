/**
 * Presentational cancellation banner. No data access, so it is safe to import
 * from both the server component and the client-side admin control, and easy to
 * unit-test.
 */
export function PracticeBannerView({ date, reason }: { date: string; reason: string }) {
  return (
    <div
      role="alert"
      className="bg-brand-primary text-white text-center px-4 py-4"
      style={{ boxShadow: '0 4px 16px rgba(255, 0, 85, 0.4)' }}
    >
      <p className="font-heading uppercase tracking-widest text-xl sm:text-2xl leading-tight">
        ⚠️ Today&apos;s practice{date ? ` (${date})` : ''} is Cancelled
      </p>
      {reason && (
        <p className="text-white/90 text-sm sm:text-base mt-1">due to {reason}</p>
      )}
    </div>
  )
}
