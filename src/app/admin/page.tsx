import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlayersTable } from '@/components/admin/players-table'
import { PendingPayments } from '@/components/admin/pending-payments'
import { MediaUploader } from '@/components/admin/media-uploader'
import { getPendingPayments, getAllPlayers, getTotalRevenue } from '@/app/actions/admin'

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [players, pendingPayments, totalRevenueCents] = await Promise.all([
    getAllPlayers(),
    getPendingPayments(),
    getTotalRevenue(),
  ])

  return (
    <main className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-lg font-semibold text-brand-primary">
          Total Revenue: ${(totalRevenueCents / 100).toFixed(2)}
        </p>
      </div>

      <PendingPayments payments={pendingPayments as any} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Players ({players.length})</h2>
        <PlayersTable players={players as any} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Upload Media</h2>
        <MediaUploader uploadedBy={user.id} />
      </section>
    </main>
  )
}
