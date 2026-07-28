import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlayersTable } from '@/components/admin/players-table'
import { PendingPayments } from '@/components/admin/pending-payments'
import { MediaUploader } from '@/components/admin/media-uploader'
import { PendingSubmissions } from '@/components/admin/pending-submissions'
import { GetInvolvedSubmissions } from '@/components/admin/get-involved-submissions'
import { getPendingPayments, getAllPlayers, getTotalRevenue, getPendingSubmissions, getGetInvolvedSubmissions } from '@/app/actions/admin'

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [players, pendingPayments, totalRevenueCents, pendingSubmissions, getInvolvedSubmissions] = await Promise.all([
    getAllPlayers(),
    getPendingPayments(),
    getTotalRevenue(),
    getPendingSubmissions(),
    getGetInvolvedSubmissions(),
  ])

  return (
    <main className="bg-brand-cream min-h-screen max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl uppercase tracking-wide text-brand-ink">Admin Dashboard</h1>
        <p className="text-lg font-semibold text-brand-primary">
          Total Revenue: ${(totalRevenueCents / 100).toFixed(2)}
        </p>
      </div>

      <GetInvolvedSubmissions submissions={getInvolvedSubmissions} />

      <PendingPayments payments={pendingPayments as any} />

      <section>
        <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Players ({players.length})</h2>
        <PlayersTable players={players as any} />
      </section>

      <PendingSubmissions submissions={pendingSubmissions} />

      <section>
        <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Upload Media</h2>
        <MediaUploader uploadedBy={user.id} />
      </section>
    </main>
  )
}
