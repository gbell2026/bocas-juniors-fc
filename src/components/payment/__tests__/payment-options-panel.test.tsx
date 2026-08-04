import { render, screen } from '@testing-library/react'

jest.mock('@/app/actions/payment', () => ({
  getPaymentSettings: jest.fn().mockResolvedValue({
    paypalMeUrl: 'https://paypal.me/bocasjuniorsfc',
    monzoDetails: 'Sort: 04-00-04 / Acc: 12345678',
    revolutDetails: '@bocasjuniorsfc',
  }),
  requestPayment: jest.fn().mockResolvedValue({}),
  getAmountDue: jest.fn().mockResolvedValue({ label: 'full', amountCents: 21000, isFirstInstallment: true }),
  getPaymentSchedule: jest.fn().mockResolvedValue([
    { label: 'registration', amountCents: 3000, status: 'outstanding' },
    { label: 'full', amountCents: 21000, status: 'outstanding' },
  ]),
}))

import { PaymentOptionsPanel } from '../payment-options-panel'
import { getAmountDue, getPaymentSchedule } from '@/app/actions/payment'

it('renders all four payment method buttons', async () => {
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  // Loading state initially
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
})

it('shows the registration fee as Outstanding when nothing has been paid yet', async () => {
  ;(getAmountDue as jest.Mock).mockResolvedValueOnce({
    label: 'full', amountCents: 21000, isFirstInstallment: true,
  })
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  expect(await screen.findByText(/Registration fee: Outstanding/i)).toBeInTheDocument()
  expect(screen.getAllByText(/\$210\.00/).length).toBeGreaterThan(0)
})

it('shows a "Pay Registration Fee" heading when the registration installment is what is currently due', async () => {
  ;(getAmountDue as jest.Mock).mockResolvedValueOnce({
    label: 'registration', amountCents: 3000, isFirstInstallment: true,
  })
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  expect(await screen.findByText(/Pay Registration Fee — \$30\.00/i)).toBeInTheDocument()
})

it('shows a "Pay Membership Fee" heading once the registration fee is paid and a season installment is due', async () => {
  ;(getAmountDue as jest.Mock).mockResolvedValueOnce({
    label: 'full', amountCents: 21000, isFirstInstallment: false,
  })
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  expect(await screen.findByText(/Pay Membership Fee — \$210\.00/i)).toBeInTheDocument()
})

it('shows the registration fee as Paid but still shows the next installment due', async () => {
  ;(getAmountDue as jest.Mock).mockResolvedValueOnce({
    label: 'september', amountCents: 6000, isFirstInstallment: false,
  })
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  expect(await screen.findByText(/Registration fee: Paid/i)).toBeInTheDocument()
  expect(screen.getAllByText(/\$60\.00/).length).toBeGreaterThan(0)
})

it('shows the full payment schedule as a table, so paying the registration fee does not look like everything is done', async () => {
  ;(getAmountDue as jest.Mock).mockResolvedValueOnce({
    label: 'august', amountCents: 3000, isFirstInstallment: false,
  })
  ;(getPaymentSchedule as jest.Mock).mockResolvedValueOnce([
    { label: 'registration', amountCents: 3000, status: 'paid' },
    { label: 'august', amountCents: 3000, status: 'outstanding' },
    { label: 'september', amountCents: 6000, status: 'outstanding' },
    { label: 'october', amountCents: 6000, status: 'outstanding' },
    { label: 'november', amountCents: 6000, status: 'outstanding' },
  ])
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  expect(await screen.findByText('Registration Fee')).toBeInTheDocument()
  expect(screen.getByText('September')).toBeInTheDocument()
  expect(screen.getByText('November')).toBeInTheDocument()
  expect(screen.getAllByText('Paid').length).toBeGreaterThan(0)
  expect(screen.getAllByText('Outstanding').length).toBeGreaterThan(0)
})

it('marks a self-reported payment as "Pending Review" in the schedule table', async () => {
  ;(getPaymentSchedule as jest.Mock).mockResolvedValueOnce([
    { label: 'registration', amountCents: 3000, status: 'pending' },
    { label: 'full', amountCents: 21000, status: 'outstanding' },
  ])
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  expect(await screen.findByText('Pending Review')).toBeInTheDocument()
})

it('shows the fully-paid-up message when nothing more is due', async () => {
  ;(getAmountDue as jest.Mock).mockResolvedValueOnce(null)
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  expect(await screen.findByText(/Registration fee: Paid/i)).toBeInTheDocument()
  expect(screen.getByText(/all paid up/i)).toBeInTheDocument()
  expect(screen.queryByText(/PayPal/i)).not.toBeInTheDocument()
})
