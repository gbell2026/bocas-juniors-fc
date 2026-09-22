import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeagueFixturesAdmin } from '@/components/admin/league-fixtures-admin'
import { getFixturesForAdmin, bulkUpdateFixtures, addFixture, setFixtureCancelled } from '@/app/actions/league-admin'

jest.mock('@/app/actions/league-admin', () => ({
  getFixturesForAdmin: jest.fn(),
  bulkUpdateFixtures: jest.fn(),
  addFixture: jest.fn(),
  setFixtureCancelled: jest.fn(),
}))

const divisions = [{ id: 'd1', name: 'U10' }]
const teams = [
  { id: 't1', name: 'Toucans', divisionId: 'd1' },
  { id: 't2', name: 'Isla Verde', divisionId: 'd1' },
  { id: 't3', name: 'Bastimentos', divisionId: 'd1' },
  { id: 't4', name: 'Caranero', divisionId: 'd1' },
]
const fixture1 = {
  id: 'fx1', matchDate: '2026-09-06', homeTeamId: 't1', awayTeamId: 't2',
  homeTeamName: 'Toucans', awayTeamName: 'Isla Verde',
  homeScore: null, awayScore: null, cancelled: false, kickoff: '09:00', location: null,
}
const fixture2 = {
  id: 'fx2', matchDate: '2026-09-13', homeTeamId: 't3', awayTeamId: 't4',
  homeTeamName: 'Bastimentos', awayTeamName: 'Caranero',
  homeScore: null, awayScore: null, cancelled: false, kickoff: '10:00', location: null,
}

function row(dateValue: string): HTMLElement {
  return screen.getByDisplayValue(dateValue).closest('.bg-brand-tint') as HTMLElement
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getFixturesForAdmin as jest.Mock).mockResolvedValue([fixture1, fixture2])
  ;(bulkUpdateFixtures as jest.Mock).mockResolvedValue({ errors: {} })
})

describe('LeagueFixturesAdmin — Save All', () => {
  it('has no Save All bar until a row is edited', async () => {
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)
    await screen.findByDisplayValue('2026-09-06')
    expect(screen.queryByRole('button', { name: /save all changes/i })).not.toBeInTheDocument()
  })

  it('queues an edited row and sends its full patch via bulkUpdateFixtures', async () => {
    const user = userEvent.setup()
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)
    await screen.findByDisplayValue('2026-09-06')

    const r = row('2026-09-06')
    fireEvent.change(within(r).getByDisplayValue('2026-09-06'), { target: { value: '2026-09-20' } })
    await user.type(within(r).getByPlaceholderText('Location (leave blank for the usual ground)'), 'Bastimentos pitch')
    await user.type(within(r).getByPlaceholderText('H'), '3')
    await user.type(within(r).getByPlaceholderText('A'), '1')

    await user.click(screen.getByRole('button', { name: /save all changes \(1\)/i }))

    await waitFor(() => expect(bulkUpdateFixtures).toHaveBeenCalledTimes(1))
    expect(bulkUpdateFixtures).toHaveBeenCalledWith([{
      id: 'fx1',
      patch: {
        matchDate: '2026-09-20',
        homeTeamId: 't1',
        awayTeamId: 't2',
        kickoff: '09:00',
        location: 'Bastimentos pitch',
        homeScore: 3,
        awayScore: 1,
      },
    }])
  })

  it('blocks a row with only one score filled in, without calling bulkUpdateFixtures', async () => {
    const user = userEvent.setup()
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)
    await screen.findByDisplayValue('2026-09-06')

    await user.type(within(row('2026-09-06')).getByPlaceholderText('H'), '2')
    await user.click(screen.getByRole('button', { name: /save all changes \(1\)/i }))

    expect(await screen.findByText(/enter both scores or neither/i)).toBeInTheDocument()
    expect(bulkUpdateFixtures).not.toHaveBeenCalled()
  })

  it('regression: a row that fails to save keeps its draft and error while a different row in the same click succeeds', async () => {
    const user = userEvent.setup()
    ;(bulkUpdateFixtures as jest.Mock).mockResolvedValueOnce({
      errors: { fx2: 'Check the fixture — two different teams, and scores can’t be negative.' },
    })
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)
    await screen.findByDisplayValue('2026-09-06')

    await user.type(within(row('2026-09-06')).getByPlaceholderText('H'), '2')
    await user.type(within(row('2026-09-06')).getByPlaceholderText('A'), '0')
    await user.type(within(row('2026-09-13')).getByPlaceholderText('H'), '1')
    await user.type(within(row('2026-09-13')).getByPlaceholderText('A'), '1')

    await user.click(screen.getByRole('button', { name: /save all changes \(2\)/i }))
    await waitFor(() => expect(bulkUpdateFixtures).toHaveBeenCalledTimes(1))

    // fx1 succeeded: committed, its Reset button is gone
    const fx1Row = row('2026-09-06')
    expect(within(fx1Row).queryByRole('button', { name: /reset/i })).not.toBeInTheDocument()

    // fx2 failed: draft (unsaved score) still showing, its own error visible, still counted as dirty
    const fx2Row = row('2026-09-13')
    expect(within(fx2Row).getByPlaceholderText('H')).toHaveValue(1)
    expect(within(fx2Row).getByText(/two different teams/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save all changes \(1\)/i })).toBeInTheDocument()
  })

  it('editing two rows without saving keeps their drafts independent', async () => {
    const user = userEvent.setup()
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)
    await screen.findByDisplayValue('2026-09-06')

    await user.type(within(row('2026-09-06')).getByPlaceholderText('H'), '4')
    await user.type(within(row('2026-09-13')).getByPlaceholderText('H'), '2')

    expect(within(row('2026-09-06')).getByPlaceholderText('H')).toHaveValue(4)
    expect(within(row('2026-09-13')).getByPlaceholderText('H')).toHaveValue(2)
    expect(screen.getByRole('button', { name: /save all changes \(2\)/i })).toBeInTheDocument()
  })

  it('Reset discards just that row’s edit', async () => {
    const user = userEvent.setup()
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)
    await screen.findByDisplayValue('2026-09-06')

    await user.type(within(row('2026-09-06')).getByPlaceholderText('H'), '4')
    await user.click(within(row('2026-09-06')).getByRole('button', { name: /reset/i }))

    expect(within(row('2026-09-06')).getByPlaceholderText('H')).toHaveValue(null)
    expect(screen.queryByRole('button', { name: /save all changes/i })).not.toBeInTheDocument()
  })

  it('disables row inputs, the division select and Add Fixture while a save is in flight', async () => {
    let resolveSave: (v: { errors: Record<string, string> }) => void = () => {}
    ;(bulkUpdateFixtures as jest.Mock).mockReturnValueOnce(new Promise(res => { resolveSave = res }))
    const user = userEvent.setup()
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)
    await screen.findByDisplayValue('2026-09-06')

    await user.type(within(row('2026-09-06')).getByPlaceholderText('H'), '2')
    await user.type(within(row('2026-09-06')).getByPlaceholderText('A'), '0')
    await user.click(screen.getByRole('button', { name: /save all changes/i }))

    expect(screen.getByText(/saving all changes/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /division/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^add fixture$/i })).toBeDisabled()
    within(row('2026-09-06')).getAllByPlaceholderText(/^(H|A)$/).forEach(el => expect(el).toBeDisabled())

    resolveSave!({ errors: {} })
    await waitFor(() => expect(screen.queryByText(/saving all changes/i)).not.toBeInTheDocument())
  })
})

describe('LeagueFixturesAdmin — leaving with unsaved changes', () => {
  it('warns before unload only while a row is dirty', async () => {
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)
    await screen.findByDisplayValue('2026-09-06')

    const cleanEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(cleanEvent)
    expect(cleanEvent.defaultPrevented).toBe(false)

    fireEvent.change(screen.getByDisplayValue('2026-09-06'), { target: { value: '2026-09-20' } })

    const dirtyEvent = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirtyEvent)
    expect(dirtyEvent.defaultPrevented).toBe(true)
  })
})

describe('LeagueFixturesAdmin — Cancel and Add Fixture stay local, no extra refetch', () => {
  it('toggling Cancel patches the row locally without a second getFixturesForAdmin call', async () => {
    const user = userEvent.setup()
    ;(setFixtureCancelled as jest.Mock).mockResolvedValue({})
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)
    await screen.findByDisplayValue('2026-09-06')

    await user.click(within(row('2026-09-06')).getByRole('button', { name: /^cancel$/i }))

    expect(await within(row('2026-09-06')).findByText('Cancelled')).toBeInTheDocument()
    expect(getFixturesForAdmin).toHaveBeenCalledTimes(1)
  })

  it('adding a fixture appends it locally (team names from the teams prop) without a second getFixturesForAdmin call', async () => {
    const user = userEvent.setup()
    ;(addFixture as jest.Mock).mockResolvedValue({
      fixture: {
        id: 'fx3', matchDate: '2026-09-27', homeTeamId: 't1', awayTeamId: 't3',
        homeScore: null, awayScore: null, cancelled: false, kickoff: null, location: null,
      },
    })
    render(<LeagueFixturesAdmin divisions={divisions} teams={teams} />)
    await screen.findByDisplayValue('2026-09-06')

    const form = screen.getByRole('button', { name: /^add fixture$/i }).closest('form') as HTMLElement
    const selects = within(form).getAllByRole('combobox')
    await user.selectOptions(selects[0], 't1')
    await user.selectOptions(selects[1], 't3')
    fireEvent.change(form.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-09-27' } })
    await user.click(within(form).getByRole('button', { name: /^add fixture$/i }))

    const newRow = (await screen.findByDisplayValue('2026-09-27')).closest('.bg-brand-tint') as HTMLElement
    const newRowSelects = within(newRow).getAllByRole('combobox')
    expect(newRowSelects[0]).toHaveValue('t1') // resolved via the teams prop, not a refetch
    expect(newRowSelects[1]).toHaveValue('t3')
    expect(getFixturesForAdmin).toHaveBeenCalledTimes(1)
  })
})
