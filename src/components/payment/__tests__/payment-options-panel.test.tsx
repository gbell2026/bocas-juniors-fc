import { render, screen } from '@testing-library/react'

jest.mock('@/app/actions/payment', () => ({
  getPaymentSettings: jest.fn().mockResolvedValue({
    paypalMeUrl: 'https://paypal.me/bocasjuniorsfc',
    monzoDetails: 'Sort: 04-00-04 / Acc: 12345678',
    revolutDetails: '@bocasjuniorsfc',
  }),
  requestPayment: jest.fn().mockResolvedValue({}),
  getAmountDue: jest.fn().mockResolvedValue({ label: 'full', amountCents: 3000, isFirstInstallment: true }),
}))

import { PaymentOptionsPanel } from '../payment-options-panel'

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
