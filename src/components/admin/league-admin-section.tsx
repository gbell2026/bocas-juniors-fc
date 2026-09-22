'use client'
import { useState } from 'react'
import { PracticesAdmin } from '@/components/admin/practices-admin'
import { LeaguePendingQueue } from '@/components/admin/league-pending-queue'
import { LeagueDivisions } from '@/components/admin/league-divisions'
import { LeagueFixturesAdmin } from '@/components/admin/league-fixtures-admin'
import { ManageLeagueClubs } from '@/components/admin/manage-league-clubs'
import { ManageLeagueTeams } from '@/components/admin/manage-league-teams'
import { LeagueBannerAdmin } from '@/components/admin/league-banner-admin'
import type { getPendingLeagueClubs, getPendingLeagueTeams, getPendingLeaguePlayers, getLeagueDivisionsAdmin, getAllLeagueClubs, getAllLeagueTeams } from '@/app/actions/league-admin'
import type { getApprovedTeams } from '@/app/actions/league'
import type { getAllPractices } from '@/app/actions/practices'

type SubTab = 'practices' | 'approvals' | 'divisions' | 'clubsTeams' | 'banner'

type Props = {
  practices: Awaited<ReturnType<typeof getAllPractices>>
  pendingLeagueClubs: Awaited<ReturnType<typeof getPendingLeagueClubs>>
  pendingLeagueTeams: Awaited<ReturnType<typeof getPendingLeagueTeams>>
  pendingLeaguePlayers: Awaited<ReturnType<typeof getPendingLeaguePlayers>>
  leagueDivisions: Awaited<ReturnType<typeof getLeagueDivisionsAdmin>>
  approvedLeagueTeams: Awaited<ReturnType<typeof getApprovedTeams>>
  allLeagueClubs: Awaited<ReturnType<typeof getAllLeagueClubs>>
  allLeagueTeams: Awaited<ReturnType<typeof getAllLeagueTeams>>
}

export function LeagueAdminSection({
  practices, pendingLeagueClubs, pendingLeagueTeams, pendingLeaguePlayers,
  leagueDivisions, approvedLeagueTeams, allLeagueClubs, allLeagueTeams,
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>('practices')
  const pendingCount = pendingLeagueClubs.length + pendingLeagueTeams.length + pendingLeaguePlayers.length

  // Lifted up from LeagueDivisions/LeaguePendingQueue so a newly-created
  // division or newly-approved team reaches LeagueFixturesAdmin's props
  // without a page reload.
  const [divisions, setDivisions] = useState(leagueDivisions)
  const [approvedTeams, setApprovedTeams] = useState(approvedLeagueTeams)
  // Bumped after a schedule generation, which bulk-inserts fixtures that
  // only LeagueFixturesAdmin's own fetch knows how to load — remounting it
  // (via key) re-triggers that fetch without touching that file.
  const [fixturesRefreshKey, setFixturesRefreshKey] = useState(0)

  const subTabs: { key: SubTab; label: string }[] = [
    { key: 'practices', label: 'Practices' },
    { key: 'approvals', label: pendingCount > 0 ? `Approvals (${pendingCount})` : 'Approvals' },
    { key: 'divisions', label: 'Divisions & Fixtures' },
    { key: 'clubsTeams', label: 'Clubs & Teams' },
    { key: 'banner', label: 'Homepage Banner' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {subTabs.map(st => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            className={`rounded text-xs font-bold uppercase tracking-wider px-3 py-1.5 transition ${
              subTab === st.key
                ? 'bg-brand-primary text-white'
                : 'border border-brand-line text-brand-muted hover:border-brand-primary hover:text-brand-primary'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {subTab === 'practices' && <PracticesAdmin practices={practices} />}

      {subTab === 'approvals' && (
        pendingCount > 0
          ? (
            <LeaguePendingQueue
              clubs={pendingLeagueClubs}
              teams={pendingLeagueTeams}
              players={pendingLeaguePlayers}
              onTeamApproved={team => setApprovedTeams(prev => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)))}
            />
          )
          : <p className="text-brand-muted text-sm">No pending approvals.</p>
      )}

      {subTab === 'divisions' && (
        <div className="space-y-8">
          <LeagueDivisions
            divisions={divisions}
            onDivisionCreated={d => setDivisions(prev => [...prev, d])}
            onScheduleGenerated={() => setFixturesRefreshKey(k => k + 1)}
          />
          <LeagueFixturesAdmin key={fixturesRefreshKey} divisions={divisions} teams={approvedTeams} />
        </div>
      )}

      {subTab === 'clubsTeams' && (
        <div className="space-y-8">
          <ManageLeagueClubs clubs={allLeagueClubs} />
          <ManageLeagueTeams teams={allLeagueTeams} divisions={divisions} />
        </div>
      )}

      {subTab === 'banner' && <LeagueBannerAdmin />}
    </div>
  )
}
