import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PaymentHistory } from '@/components/profile/payment-history'
import { PlayerInfo } from '@/components/profile/player-info'
import { PaymentOptionsPanel } from '@/components/payment/payment-options-panel'

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: parent } = await supabase
    .from('parents').select('*, players(*)').eq('user_id', user.id).single()

  const { data: payments } = await supabase
    .from('payments').select('*').eq('parent_id', parent?.id ?? '').order('paid_at', { ascending: false })

  const player = parent?.players?.[0]

  return (
    <main className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <h1 className="text-2xl font-bold">My Profile</h1>
      {player && <PlayerInfo player={player} />}
      <PaymentOptionsPanel
        playerId={player?.id ?? ''}
        parentId={parent?.id ?? ''}
        parentName={parent?.name ?? ''}
        playerName={player?.name ?? ''}
      />
      <PaymentHistory payments={payments ?? []} />
    </main>
  )
}
