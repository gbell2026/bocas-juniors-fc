import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { getPendingPayments, getAllPlayers, getTotalRevenue, getPendingSubmissions, getGetInvolvedSubmissions } from '@/app/actions/admin'
import { getPendingLeagueClubs, getPendingLeagueTeams, getPendingLeaguePlayers, getLeagueDivisionsAdmin, getAllLeagueClubs, getAllLeagueTeams } from '@/app/actions/league-admin'
import { getApprovedTeams } from '@/app/actions/league'
import { getAnnouncements } from '@/app/actions/announcements'
import { getStaffMembers } from '@/app/actions/staff'
import { getAllPractices } from '@/app/actions/practices'

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    players, pendingPayments, totalRevenueCents, pendingSubmissions, getInvolvedSubmissions,
    pendingLeagueClubs, pendingLeagueTeams, pendingLeaguePlayers, leagueDivisions, approvedLeagueTeams,
    allLeagueClubs, allLeagueTeams,
    announcements, staffMembers, practices,
  ] = await Promise.all([
    getAllPlayers(),
    getPendingPayments(),
    getTotalRevenue(),
    getPendingSubmissions(),
    getGetInvolvedSubmissions(),
    getPendingLeagueClubs(),
    getPendingLeagueTeams(),
    getPendingLeaguePlayers(),
    getLeagueDivisionsAdmin(),
    getApprovedTeams(),
    getAllLeagueClubs(),
    getAllLeagueTeams(),
    getAnnouncements(),
    getStaffMembers(),
    getAllPractices(),
  ])

  return (
    <AdminDashboard
      totalRevenueCents={totalRevenueCents}
      players={players as any}
      pendingPayments={pendingPayments as any}
      pendingSubmissions={pendingSubmissions}
      getInvolvedSubmissions={getInvolvedSubmissions}
      pendingLeagueClubs={pendingLeagueClubs}
      pendingLeagueTeams={pendingLeagueTeams}
      pendingLeaguePlayers={pendingLeaguePlayers}
      leagueDivisions={leagueDivisions}
      approvedLeagueTeams={approvedLeagueTeams}
      allLeagueClubs={allLeagueClubs}
      allLeagueTeams={allLeagueTeams}
      announcements={announcements}
      staffMembers={staffMembers}
      practices={practices}
      userId={user.id}
    />
  )
}
