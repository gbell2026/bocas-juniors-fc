import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RosterList } from '../roster-list'
import { adminMarkCashPaid, getAmountDue } from '@/app/actions/payment'

jest.mock('@/app/actions/payment', () => ({
  adminMarkCashPaid: jest.fn(),
  getAmountDue: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

const player = {
  id: 'player-1',
  parentId: 'parent-1',
  name: 'Junior',
  position: 'Forward',
  ageGroups: ['U10'],
  hasOutstanding: true,
}

it('keeps showing Outstanding and Mark Paid when another installment is still due after marking cash paid', async () => {
  (adminMarkCashPaid as jest.Mock).mockResolvedValue({});
  (getAmountDue as jest.Mock).mockResolvedValue({ label: 'full', amountCents: 6000, isFirstInstallment: false })
  const user = userEvent.setup()
  render(<RosterList players={[player]} />)

  await user.click(screen.getByRole('button', { name: /mark paid/i }))

  await waitFor(() => expect(getAmountDue).toHaveBeenCalledWith('player-1'))
  expect(screen.getByText('Outstanding')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /mark paid/i })).toBeInTheDocument()
})

it('hides Outstanding and Mark Paid once nothing more is due after marking cash paid', async () => {
  (adminMarkCashPaid as jest.Mock).mockResolvedValue({});
  (getAmountDue as jest.Mock).mockResolvedValue(null)
  const user = userEvent.setup()
  render(<RosterList players={[player]} />)

  await user.click(screen.getByRole('button', { name: /mark paid/i }))

  await waitFor(() => expect(screen.queryByText('Outstanding')).not.toBeInTheDocument())
  expect(screen.queryByRole('button', { name: /mark paid/i })).not.toBeInTheDocument()
})
