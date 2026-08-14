import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterTeamForm } from '../register-team-form'
import { LocaleProvider } from '@/lib/i18n/locale-context'

function renderForm() {
  return render(<LocaleProvider initialLocale="en"><RegisterTeamForm /></LocaleProvider>)
}

jest.mock('@/app/actions/league', () => ({
  registerLeagueTeam: jest.fn().mockResolvedValue({ clubId: 'c1', teamId: 't1' }),
  addLeagueTeam: jest.fn().mockResolvedValue({ teamId: 't2' }),
  addLeaguePlayer: jest.fn().mockResolvedValue({}),
  getOpenDivisions: jest.fn().mockResolvedValue([
    { id: 'div-1', name: 'U12', season_start_date: '2026-08-01', season_end_date: '2026-11-01' },
  ]),
  getApprovedTeams: jest.fn().mockResolvedValue([
    { id: 'team-1', name: 'U12', clubName: 'Isla FC', divisionId: 'div-1', divisionName: 'U12', badgeCloudinaryPublicId: null },
  ]),
  getApprovedClubs: jest.fn().mockResolvedValue([
    { id: 'club-1', name: 'Isla FC' },
  ]),
}))

it('defaults to New Club mode, requires only Club Name/Team Name/Division, and has no roster fields', async () => {
  renderForm()
  expect(await screen.findByLabelText(/club name/i)).toBeRequired()
  expect(screen.getByLabelText(/team name/i)).toBeRequired()
  expect(screen.getByLabelText(/division/i)).toBeRequired()
  expect(screen.getByLabelText(/contact name/i)).not.toBeRequired()
  expect(screen.getByLabelText(/contact email/i)).not.toBeRequired()
  expect(screen.getByLabelText(/contact phone/i)).not.toBeRequired()
  expect(screen.queryByPlaceholderText(/player name/i)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /submit registration/i })).toBeInTheDocument()
})

it('switches to Add a Team mode and renders a club picker instead of club details', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.click(screen.getByRole('button', { name: /add a team/i }))
  expect(await screen.findByLabelText(/your club/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/team name/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/division/i)).toBeInTheDocument()
  expect(screen.queryByLabelText(/^club name$/i)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /submit team/i })).toBeInTheDocument()
})

it('switches to Add a Player mode and renders its fields', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.click(screen.getByRole('button', { name: /add a player/i }))
  expect(await screen.findByLabelText(/your team/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /submit player/i })).toBeInTheDocument()
})
