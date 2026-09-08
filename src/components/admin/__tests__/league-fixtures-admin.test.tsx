import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeagueFixturesAdmin } from '@/components/admin/league-fixtures-admin'
import { getFixturesForAdmin, updateFixture } from '@/app/actions/league-admin'

jest.mock('@/app/actions/league-admin', () => ({
  getFixturesForAdmin: jest.fn(),
  updateFixture: jest.fn(),
  addFixture: jest.fn(),
  setFixtureCancelled: jest.fn(),
}))

const divisions = [{ id: 'd1', name: 'U10' }]
const teams = [
  { id: 't1', name: 'Toucans', divisionId: 'd1' },
  { id: 't2', name: 'Isla Verde', divisionId: 'd1' },
]
const fixture = {
  id: 'fx1', matchDate: '2026-09-06', homeTeamId: 't1', awayTeamId: 't2',
  homeTeamName: 'Toucans', awayTeamName: 'Isla Verde',
  homeScore: null, awayScore: null, cancelled: false, kickoff: '09:00', location: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getFixturesForAdmin as jest.Mock).mockResolvedValue([fixture])
  ;(updateFixture as jest.Mock).mockResolvedValue({})
})

describe('LeagueFixturesAdmin', () => {
  it('saves several edits in a single updateFixture call', async () => {
    const user = userEvent.setup()
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)

    const dateInput = await screen.findByDisplayValue('2026-09-06')
    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    expect(saveBtn).toBeDisabled()

    fireEvent.change(dateInput, { target: { value: '2026-09-13' } })
    await user.type(screen.getByPlaceholderText('Location (leave blank for the usual ground)'), 'Bastimentos pitch')
    await user.type(screen.getByPlaceholderText('H'), '3')
    await user.type(screen.getByPlaceholderText('A'), '1')

    expect(saveBtn).toBeEnabled()
    await user.click(saveBtn)

    await waitFor(() => expect(updateFixture).toHaveBeenCalledTimes(1))
    expect(updateFixture).toHaveBeenCalledWith('fx1', {
      matchDate: '2026-09-13',
      homeTeamId: 't1',
      awayTeamId: 't2',
      kickoff: '09:00',
      location: 'Bastimentos pitch',
      homeScore: 3,
      awayScore: 1,
    })
  })

  it('blocks saving when only one score is filled in', async () => {
    const user = userEvent.setup()
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)
    await screen.findByDisplayValue('2026-09-06')

    await user.type(screen.getByPlaceholderText('H'), '2')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/enter both scores or neither/i)).toBeInTheDocument()
    expect(updateFixture).not.toHaveBeenCalled()
  })
})
