'use client'
import { useState } from 'react'
import { PlayersTable } from '@/components/admin/players-table'
import { PendingPayments } from '@/components/admin/pending-payments'
import { MediaUploader } from '@/components/admin/media-uploader'
import { PendingSubmissions } from '@/components/admin/pending-submissions'
import { GetInvolvedSubmissions } from '@/components/admin/get-involved-submissions'
import { LeaguePendingQueue } from '@/components/admin/league-pending-queue'
import { LeagueDivisions } from '@/components/admin/league-divisions'
import { LeagueFixturesAdmin } from '@/components/admin/league-fixtures-admin'
import { PracticesAdmin } from '@/components/admin/practices-admin'
import { AnnouncementsAdmin } from '@/components/admin/announcements-admin'
import { StaffAdmin } from '@/components/admin/staff-admin'
import type { getAllPlayers, getPendingPayments, getPendingSubmissions, getGetInvolvedSubmissions } from '@/app/actions/admin'
import type { getPendingLeagueClubs, getPendingLeagueTeams, getPendingLeaguePlayers, getLeagueDivisionsAdmin } from '@/app/actions/league-admin'
import type { getApprovedTeams } from '@/app/actions/league'
import type { getAnnouncements } from '@/app/actions/announcements'
import type { getStaffMembers } from '@/app/actions/staff'
import type { getAllPractices } from '@/app/actions/practices'

type Tab = 'overview' | 'players' | 'submissions' | 'league' | 'content'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'players', label: 'Players & Payments' },
  { key: 'submissions', label: 'Submissions' },
  { key: 'league', label: 'Schedule' },
  { key: 'content', label: 'Content' },
]

type Props = {
  totalRevenueCents: number
  players: Awaited<ReturnType<typeof getAllPlayers>>
  pendingPayments: Awaited<ReturnType<typeof getPendingPayments>>
  pendingSubmissions: Awaited<ReturnType<typeof getPendingSubmissions>>
  getInvolvedSubmissions: Awaited<ReturnType<typeof getGetInvolvedSubmissions>>
  pendingLeagueClubs: Awaited<ReturnType<typeof getPendingLeagueClubs>>
  pendingLeagueTeams: Awaited<ReturnType<typeof getPendingLeagueTeams>>
  pendingLeaguePlayers: Awaited<ReturnType<typeof getPendingLeaguePlayers>>
  leagueDivisions: Awaited<ReturnType<typeof getLeagueDivisionsAdmin>>
  approvedLeagueTeams: Awaited<ReturnType<typeof getApprovedTeams>>
  announcements: Awaited<ReturnType<typeof getAnnouncements>>
  staffMembers: Awaited<ReturnType<typeof getStaffMembers>>
  practices: Awaited<ReturnType<typeof getAllPractices>>
  userId: string
}

export function AdminDashboard({
  totalRevenueCents, players, pendingPayments, pendingSubmissions, getInvolvedSubmissions,
  pendingLeagueClubs, pendingLeagueTeams, pendingLeaguePlayers, leagueDivisions, approvedLeagueTeams,
  announcements, staffMembers, practices, userId,
}: Props) {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <main className="bg-brand-cream min-h-screen max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl uppercase tracking-wide text-brand-ink">Admin Dashboard</h1>
        <p className="text-lg font-semibold text-brand-primary">
          Total Revenue: ${(totalRevenueCents / 100).toFixed(2)}
        </p>
      </div>

      <div className="flex border-b border-brand-line overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap px-4 ${
              tab === t.key ? 'bg-brand-primary text-white' : 'bg-brand-tint text-brand-mutedWarm'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-8">
          <PendingPayments payments={pendingPayments as any} />
        </div>
      )}

      {tab === 'players' && (
        <section>
          <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Players ({players.length})</h2>
          <PlayersTable players={players as any} />
        </section>
      )}

      {tab === 'submissions' && (
        <div className="space-y-8">
          <GetInvolvedSubmissions submissions={getInvolvedSubmissions} />
          <PendingSubmissions submissions={pendingSubmissions} />
        </div>
      )}

      {tab === 'league' && (
        <div className="space-y-8">
          <PracticesAdmin practices={practices} />
          <LeaguePendingQueue clubs={pendingLeagueClubs} teams={pendingLeagueTeams} players={pendingLeaguePlayers} />
          <LeagueDivisions divisions={leagueDivisions} />
          <LeagueFixturesAdmin divisions={leagueDivisions} teams={approvedLeagueTeams} />
        </div>
      )}

      {tab === 'content' && (
        <div className="space-y-8">
          <AnnouncementsAdmin announcements={announcements} />
          <StaffAdmin staff={staffMembers} />
          <section>
            <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Upload Media</h2>
            <MediaUploader uploadedBy={userId} />
          </section>
        </div>
      )}
    </main>
  )
}
