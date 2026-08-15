import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/app/actions/auth'
import { getRosterForCoach } from '@/app/actions/roster'
import { RosterList } from '@/components/roster/roster-list'

export default async function RosterPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await getUserRole(user.id)
  if (role !== 'coach' && role !== 'admin') redirect('/')

  const players = await getRosterForCoach()

  return (
    <main className="bg-brand-cream min-h-screen max-w-4xl mx-auto py-8 px-4">
      <h1 className="font-heading text-2xl uppercase tracking-wide text-brand-ink mb-6">Roster</h1>
      <RosterList players={players} />
    </main>
  )
}
