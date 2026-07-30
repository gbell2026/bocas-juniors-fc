import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterTeamForm } from '../register-team-form'

jest.mock('@/app/actions/league', () => ({
  registerLeagueTeam: jest.fn().mockResolvedValue({ clubId: 'c1', teamId: 't1' }),
  addLeaguePlayer: jest.fn().mockResolvedValue({}),
  getOpenDivisions: jest.fn().mockResolvedValue([
    { id: 'div-1', name: 'U12', season_start_date: '2026-08-01', season_end_date: '2026-11-01' },
  ]),
  getApprovedTeams: jest.fn().mockResolvedValue([
    { id: 'team-1', name: 'U12', clubName: 'Isla FC', divisionId: 'div-1', divisionName: 'U12', badgeCloudinaryPublicId: null },
  ]),
}))

it('defaults to New Team mode and renders its fields', async () => {
  render(<RegisterTeamForm />)
  expect(await screen.findByLabelText(/club name/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/team name/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /submit registration/i })).toBeInTheDocument()
})

it('switches to Add a Player mode and renders its fields', async () => {
  const user = userEvent.setup()
  render(<RegisterTeamForm />)
  await user.click(screen.getByRole('button', { name: /add a player/i }))
  expect(await screen.findByLabelText(/your team/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /submit player/i })).toBeInTheDocument()
})

it('adds and removes extra player rows in New Team mode', async () => {
  const user = userEvent.setup()
  render(<RegisterTeamForm />)
  expect(await screen.findAllByPlaceholderText(/player name/i)).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: /add another player/i }))
  expect(screen.getAllByPlaceholderText(/player name/i)).toHaveLength(2)

  await user.click(screen.getAllByRole('button', { name: /remove player/i })[0])
  expect(screen.getAllByPlaceholderText(/player name/i)).toHaveLength(1)
})
