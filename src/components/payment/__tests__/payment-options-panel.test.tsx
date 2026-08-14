import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithLocale as render } from '@/lib/i18n/test-utils'

jest.mock('@/app/actions/payment', () => ({
  getPaymentSettings: jest.fn().mockResolvedValue({
    paypalMeUrl: 'https://paypal.me/bocasjuniorsfc',
    monzoDetails: 'https://monzo.me/bocasjuniorsfc',
    revolutDetails: 'https://revolut.me/bocasjuniorsfc',
  }),
  requestPayment: jest.fn().mockResolvedValue({}),
  getPaymentSchedule: jest.fn().mockResolvedValue([
    { label: 'registration', amountCents: 3000, status: 'outstanding' },
    { label: 'full', amountCents: 21000, status: 'outstanding' },
  ]),
}))

import { PaymentOptionsPanel } from '../payment-options-panel'
import { getPaymentSchedule } from '@/app/actions/payment'

// Both the mobile-card layout and the desktop table are always mounted —
// CSS (`sm:hidden` / `hidden sm:block`) toggles which one is visible, but
// jsdom doesn't evaluate media queries, so both are present in every test.
// Tests scope into one layout via its data-testid to avoid duplicate-match
// errors, matching how a real browser only ever shows one at a time.
function desktopSchedule() {
  return within(screen.getByTestId('desktop-schedule'))
}

function mobileSchedule() {
  return within(screen.getByTestId('mobile-schedule'))
}

it('renders a loading state before data arrives', async () => {
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
})

it('shows the registration fee as Outstanding when nothing has been paid yet', async () => {
  ;(getPaymentSchedule as jest.Mock).mockResolvedValueOnce([
    { label: 'registration', amountCents: 3000, status: 'outstanding' },
    { label: 'full', amountCents: 21000, status: 'outstanding' },
  ])
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  expect(await screen.findByText(/Registration fee: Outstanding/i)).toBeInTheDocument()
})

it('shows a single compact table with a row per item, both outstanding items actionable at once', async () => {
  ;(getPaymentSchedule as jest.Mock).mockResolvedValueOnce([
    { label: 'registration', amountCents: 3000, status: 'outstanding' },
    { label: 'full', amountCents: 21000, status: 'outstanding' },
  ])
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  // Regression test: a parent should never be stuck seeing only the
  // registration fee's payment options while the season fee is also
  // outstanding — both rows must have their own action controls.
  await screen.findByTestId('desktop-schedule')
  const table = desktopSchedule()
  expect(table.getByText('Registration Fee')).toBeInTheDocument()
  expect(table.getByText('Season Fee (Full)')).toBeInTheDocument()
  expect(table.getAllByLabelText(/Payment method for/i).length).toBe(2)
})

it('also shows both items with their own action controls in the mobile card layout', async () => {
  ;(getPaymentSchedule as jest.Mock).mockResolvedValueOnce([
    { label: 'registration', amountCents: 3000, status: 'outstanding' },
    { label: 'full', amountCents: 21000, status: 'outstanding' },
  ])
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  await screen.findByTestId('mobile-schedule')
  const cards = mobileSchedule()
  expect(cards.getByText('Registration Fee')).toBeInTheDocument()
  expect(cards.getByText('Season Fee (Full)')).toBeInTheDocument()
  expect(cards.getAllByLabelText(/Payment method for/i).length).toBe(2)
})

it('shows a method dropdown and a PayPal link by default for an outstanding item', async () => {
  ;(getPaymentSchedule as jest.Mock).mockResolvedValueOnce([
    { label: 'registration', amountCents: 3000, status: 'outstanding' },
  ])
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  await screen.findByTestId('desktop-schedule')
  expect(desktopSchedule().getByText(/Pay \$30\.00/i)).toBeInTheDocument()
})

it('shows Copy link and confirm controls when Monzo is selected', async () => {
  ;(getPaymentSchedule as jest.Mock).mockResolvedValueOnce([
    { label: 'registration', amountCents: 3000, status: 'outstanding' },
  ])
  const user = userEvent.setup()
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  await screen.findByTestId('desktop-schedule')
  const table = desktopSchedule()
  const select = table.getByLabelText(/Payment method for registration/i)
  await user.selectOptions(select, 'monzo')
  expect(table.getByText(/Copy link/i)).toBeInTheDocument()
  expect(table.getByRole('button', { name: /I've sent it/i })).toBeInTheDocument()
})

it('shows a plain confirm button when Cash is selected', async () => {
  ;(getPaymentSchedule as jest.Mock).mockResolvedValueOnce([
    { label: 'registration', amountCents: 3000, status: 'outstanding' },
  ])
  const user = userEvent.setup()
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  await screen.findByTestId('desktop-schedule')
  const table = desktopSchedule()
  const select = table.getByLabelText(/Payment method for registration/i)
  await user.selectOptions(select, 'cash')
  expect(table.getByRole('button', { name: /I'll pay cash/i })).toBeInTheDocument()
})

it('shows "Reported" and removes the action controls after a successful report', async () => {
  ;(getPaymentSchedule as jest.Mock).mockResolvedValueOnce([
    { label: 'registration', amountCents: 3000, status: 'outstanding' },
  ])
  const user = userEvent.setup()
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  await screen.findByTestId('desktop-schedule')
  const table = desktopSchedule()
  const select = table.getByLabelText(/Payment method for registration/i)
  await user.selectOptions(select, 'cash')
  await user.click(table.getByRole('button', { name: /I'll pay cash/i }))
  expect(await table.findByText(/Reported/i)).toBeInTheDocument()
})

it('leaves the action cell empty for items that are Paid or Pending Review', async () => {
  ;(getPaymentSchedule as jest.Mock).mockResolvedValueOnce([
    { label: 'registration', amountCents: 3000, status: 'paid' },
    { label: 'full', amountCents: 21000, status: 'pending' },
  ])
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  await screen.findByTestId('desktop-schedule')
  const table = desktopSchedule()
  expect(table.getByText('Paid')).toBeInTheDocument()
  expect(table.getByText('Pending Review')).toBeInTheDocument()
  expect(table.queryByLabelText(/Payment method for/i)).not.toBeInTheDocument()
})

it('shows the fully-paid-up message and no schedule table when everything has been paid', async () => {
  ;(getPaymentSchedule as jest.Mock).mockResolvedValueOnce([
    { label: 'registration', amountCents: 3000, status: 'paid' },
    { label: 'full', amountCents: 21000, status: 'paid' },
  ])
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  expect(await screen.findByText(/Registration fee: Paid/i)).toBeInTheDocument()
  expect(screen.getByText(/all paid up/i)).toBeInTheDocument()
  expect(screen.queryByTestId('desktop-schedule')).not.toBeInTheDocument()
  expect(screen.queryByTestId('mobile-schedule')).not.toBeInTheDocument()
})
