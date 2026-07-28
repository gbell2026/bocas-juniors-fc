import type { Player } from '@/lib/supabase/types'

export function PlayerInfo({ player }: { player: Player }) {
  return (
    <section className="bg-brand-tint rounded-lg p-4">
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-2">Player Details</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="font-medium">Name</dt><dd>{player.name}</dd>
        <dt className="font-medium">Position</dt><dd>{player.position}</dd>
        <dt className="font-medium">Date of Birth</dt><dd>{player.date_of_birth}</dd>
        <dt className="font-medium">Status</dt>
        <dd className="capitalize">
          {player.status}
          {player.return_date && ` (returns ${player.return_date})`}
        </dd>
      </dl>
    </section>
  )
}
