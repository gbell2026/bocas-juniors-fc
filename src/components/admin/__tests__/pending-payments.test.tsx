import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PendingPayments } from '@/components/admin/pending-payments'
import { confirmPayment, denyPayment } from '@/app/actions/payment'

jest.mock('@/app/actions/payment', () => ({
  confirmPayment: jest.fn(),
  denyPayment: jest.fn(),
}))

const payments = [
  { id: 'pay-1', amount: 2500, payment_method: 'cash', notes: null, players: { name: 'Junior' }, parents: { name: 'Jane' } },
  { id: 'pay-2', amount: 2500, payment_method: 'monzo', notes: null, players: { name: 'Milo' }, parents: { name: 'Dan' } },
]

beforeEach(() => {
  jest.clearAllMocks()
})

it('removes a payment locally after confirming it, leaving the other row untouched', async () => {
  (confirmPayment as jest.Mock).mockResolvedValue({})
  const user = userEvent.setup()
  render(<PendingPayments payments={payments} />)

  await user.click(screen.getAllByRole('button', { name: /confirm/i })[0])

  expect(confirmPayment).toHaveBeenCalledWith('pay-1')
  expect(screen.queryByText('Junior')).not.toBeInTheDocument()
  expect(screen.getByText('Milo')).toBeInTheDocument()
})

it('removes a payment locally after denying it', async () => {
  (denyPayment as jest.Mock).mockResolvedValue({})
  const user = userEvent.setup()
  render(<PendingPayments payments={payments} />)

  await user.click(screen.getAllByRole('button', { name: /deny/i })[0])

  expect(denyPayment).toHaveBeenCalledWith('pay-1')
  expect(screen.queryByText('Junior')).not.toBeInTheDocument()
})

it('renders nothing once every payment has been handled', async () => {
  (confirmPayment as jest.Mock).mockResolvedValue({})
  const user = userEvent.setup()
  const { container } = render(<PendingPayments payments={[payments[0]]} />)

  await user.click(screen.getByRole('button', { name: /confirm/i }))

  expect(container).toBeEmptyDOMElement()
})
