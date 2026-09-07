import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayersTable } from '@/components/admin/players-table'

jest.mock('@/app/actions/admin', () => ({
  updatePlayerStatus: jest.fn(),
  updatePlayerPaymentPlan: jest.fn(),
  updatePlayerAgeGroups: jest.fn(),
  cancelPlayer: jest.fn(),
  restorePlayer: jest.fn(),
  deletePlayer: jest.fn(),
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
