import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PaymentHistory } from '@/components/profile/payment-history'
import { PlayerInfo } from '@/components/profile/player-info'
import { PaymentOptionsPanel } from '@/components/payment/payment-options-panel'
import { AddChildSection } from '@/components/profile/add-child-section'

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: parent } = await supabase
    .from('parents').select('*, players(*)').eq('user_id', user.id).single()

  const { data: payments } = await supabase
    .from('payments').select('*, players(name)').eq('parent_id', parent?.id ?? '').order('paid_at', { ascending: false })

  // Registration order matters — it determines which child (if any)
  // qualifies for the sibling discount (see getPaymentSchedule).
  const players = (parent?.players ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at))

  return (
    <main className="bg-brand-cream min-h-screen max-w-2xl mx-auto py-8 px-4 space-y-8">
      <h1 className="font-heading text-2xl uppercase tracking-wide text-brand-ink">My Profile</h1>

      {players.map(player => (
        <div key={player.id} className="space-y-4 pb-8 border-b border-brand-line last:border-b-0">
          <PlayerInfo player={player} />
          <PaymentOptionsPanel
            playerId={player.id}
            parentId={parent?.id ?? ''}
            parentName={parent?.name ?? ''}
            playerName={player.name}
          />
        </div>
      ))}

      <AddChildSection />

      <PaymentHistory payments={payments ?? []} />
    </main>
  )
}
