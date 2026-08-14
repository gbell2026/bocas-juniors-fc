import type { Player } from '@/lib/supabase/types'
import type { Locale } from '@/lib/i18n/locale'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'

export function PlayerInfo({ player, locale }: { player: Player; locale: Locale }) {
  const t = locale === 'es' ? es : en
  const positionKey = player.position.toLowerCase() as keyof typeof t.register.positions
  const translatedPosition = t.register.positions[positionKey] ?? player.position

  return (
    <section className="bg-brand-tint rounded-lg p-4">
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-2">{t.profile.playerInfo.legend}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="font-medium">{t.profile.playerInfo.name}</dt><dd>{player.name}</dd>
        <dt className="font-medium">{t.profile.playerInfo.position}</dt><dd>{translatedPosition}</dd>
        <dt className="font-medium">{t.profile.playerInfo.dob}</dt><dd>{player.date_of_birth}</dd>
        <dt className="font-medium">{t.profile.playerInfo.status}</dt>
        <dd className="capitalize">
          {t.profile.playerInfo.statuses[player.status]}
          {player.return_date && ` ${t.profile.playerInfo.returns(player.return_date)}`}
        </dd>
      </dl>
    </section>
  )
}
