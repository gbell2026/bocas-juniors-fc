import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayersTable } from '@/components/admin/players-table'
import { deletePlayer, cancelPlayer, getPlayerById, bulkUpdatePlayerStatus } from '@/app/actions/admin'

jest.mock('@/app/actions/admin', () => ({
  updatePlayerStatus: jest.fn(),
  updatePlayerPaymentPlan: jest.fn(),
  updatePlayerAgeGroups: jest.fn(),
  cancelPlayer: jest.fn(),
  restorePlayer: jest.fn(),
  deletePlayer: jest.fn(),
  getPlayerById: jest.fn(),
  bulkUpdatePlayerStatus: jest.fn(),
  bulkUpdatePlayerPaymentPlan: jest.fn(),
  bulkSetAgeGroup: jest.fn(),
}))
jest.mock('@/app/actions/payment', () => ({
  adminMarkCashPaid: jest.fn(),
  bulkMarkCashPaid: jest.fn(),
}))

function mk(over: Record<string, unknown>) {
  return {
    id: 'x', name: 'Player X', status: 'active', position: 'Midfielder',
    age_groups: ['U10'], payment_plan: 'full', parent_id: 'par-x', date_of_birth: '2016-01-01',
    return_date: null, created_at: '2026-01-01', user_id: null,
    parents: { name: 'Parent X', email: 'x@example.com' },
    lastPaidAt: null, regFeePaid: true, hasPayments: false,
    paymentStatus: { kind: 'paidUp' }, monthlyStatus: [],
    ...over,
  }
}

const players = [
  mk({ id: 'gk', name: 'Gary Keeper', position: 'Goalkeeper', age_groups: ['U10'], paymentStatus: { kind: 'paidUp' } }),
  mk({ id: 'fw', name: 'Fiona Ward', position: 'Forward', age_groups: ['U14'], paymentStatus: { kind: 'owes', label: 'september', amountCents: 2500 } }),
  mk({ id: 'mf', name: 'Milo Field', position: 'Midfielder', age_groups: ['U10', 'U14'], paymentStatus: { kind: 'owes', label: 'october', amountCents: 2500 } }),
] as any

beforeEach(() => {
  jest.clearAllMocks()
})

describe('PlayersTable filters', () => {
  it('narrows rows by a single filter', async () => {
    const user = userEvent.setup()
    render(<PlayersTable players={players} />)
    expect(screen.getByText('Showing 3 of 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Goalkeeper' }))

    expect(screen.getByText('Showing 1 of 3')).toBeInTheDocument()
    expect(screen.getByText('Gary Keeper')).toBeInTheDocument()
    expect(screen.queryByText('Fiona Ward')).not.toBeInTheDocument()
  })

  it('combines filters with AND across groups', async () => {
    const user = userEvent.setup()
    render(<PlayersTable players={players} />)

    await user.click(screen.getByRole('button', { name: 'U14' }))
    await user.click(screen.getByRole('button', { name: 'Owes' }))

    // U14 ∩ owes → Fiona (U14, owes) and Milo (U10+U14, owes); not Gary (U10, paid up)
    expect(screen.getByText('Showing 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('Fiona Ward')).toBeInTheDocument()
    expect(screen.getByText('Milo Field')).toBeInTheDocument()
    expect(screen.queryByText('Gary Keeper')).not.toBeInTheDocument()
  })
})

describe('PlayersTable bulk selection', () => {
  it('shows the bulk bar once rows are selected and hides it on a filter change', async () => {
    const user = userEvent.setup()
    render(<PlayersTable players={players} />)

    await user.click(screen.getByRole('checkbox', { name: 'Select Gary Keeper' }))
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    // toggling a filter clears the selection
    await user.click(screen.getByRole('button', { name: 'Forward' }))
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
  })

  it('select-all picks every filtered row', async () => {
    const user = userEvent.setup()
    render(<PlayersTable players={players} />)

    await user.click(screen.getByRole('button', { name: 'U10' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))

    // U10 → Gary + Milo
    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })
})

describe('PlayersTable local updates (no reload)', () => {
  beforeEach(() => {
    window.confirm = jest.fn(() => true)
  })

  it('removes a player locally after delete, no server refetch needed', async () => {
    const user = userEvent.setup()
    ;(deletePlayer as jest.Mock).mockResolvedValueOnce({})
    const testPlayers = [mk({ id: 'del1', name: 'Danny Delete', hasPayments: false })] as any
    render(<PlayersTable players={testPlayers} />)

    const rowEl = screen.getByText('Danny Delete').closest('tr') as HTMLElement
    await user.click(within(rowEl).getByRole('button', { name: /expand row/i }))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(deletePlayer).toHaveBeenCalledWith('del1')
    expect(screen.queryByText('Danny Delete')).not.toBeInTheDocument()
  })

  it('re-fetches and merges a single player after Cancel, reflecting the server-confirmed status', async () => {
    const user = userEvent.setup()
    ;(cancelPlayer as jest.Mock).mockResolvedValueOnce(undefined)
    ;(getPlayerById as jest.Mock).mockResolvedValueOnce(
      mk({ id: 'can1', name: 'Cara Cancel', status: 'cancelled', hasPayments: true })
    )
    const testPlayers = [mk({ id: 'can1', name: 'Cara Cancel', status: 'active', hasPayments: true })] as any
    render(<PlayersTable players={testPlayers} />)

    const rowEl = screen.getByText('Cara Cancel').closest('tr') as HTMLElement
    await user.click(within(rowEl).getByRole('button', { name: /expand row/i }))
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(getPlayerById).toHaveBeenCalledWith('can1')
    await screen.findByText('cancelled')
  })

  it('bulk-applying re-fetches every affected player and merges without a page reload', async () => {
    const user = userEvent.setup()
    ;(bulkUpdatePlayerStatus as jest.Mock).mockResolvedValueOnce(undefined)
    ;(getPlayerById as jest.Mock)
      .mockResolvedValueOnce(mk({ id: 'b1', name: 'Bea One', status: 'inactive' }))
      .mockResolvedValueOnce(mk({ id: 'b2', name: 'Ben Two', status: 'inactive' }))
    const testPlayers = [mk({ id: 'b1', name: 'Bea One' }), mk({ id: 'b2', name: 'Ben Two' })] as any
    render(<PlayersTable players={testPlayers} />)

    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    await user.selectOptions(screen.getByRole('combobox'), 'status')
    await user.click(screen.getByRole('button', { name: /apply to 2/i }))

    await waitFor(() => expect(getPlayerById).toHaveBeenCalledTimes(2))
    expect(getPlayerById).toHaveBeenCalledWith('b1')
    expect(getPlayerById).toHaveBeenCalledWith('b2')
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
  })
})
