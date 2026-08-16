import { screen, fireEvent } from '@testing-library/react'
import { RegistrationForm } from '../registration-form'
import { renderWithLocale as render } from '@/lib/i18n/test-utils'

const registerParentAndPlayer = jest.fn().mockResolvedValue({ playerId: 'p1', parentId: 'pa1', userId: 'u1' })
jest.mock('@/app/actions/register', () => ({
  registerParentAndPlayer: (...args: unknown[]) => registerParentAndPlayer(...args),
}))

it('renders all required fields', () => {
  render(<RegistrationForm onSuccess={jest.fn<void, [string, string, string, string]>()} />)
  expect(screen.getByLabelText(/player name/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/parent name/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/position/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
})

it('defaults the join month to August, showing the full $210 season fee', () => {
  render(<RegistrationForm onSuccess={jest.fn<void, [string, string, string, string]>()} />)
  const joinMonth = screen.getByLabelText(/which month/i) as HTMLSelectElement
  expect(joinMonth.value).toBe('august')
  expect(screen.getAllByText(/\$210 season fee/).length).toBeGreaterThan(0)
})

it('reprices the plans when a later join month is selected', () => {
  render(<RegistrationForm onSuccess={jest.fn<void, [string, string, string, string]>()} />)
  fireEvent.change(screen.getByLabelText(/which month/i), { target: { value: 'october' } })
  expect(screen.getAllByText(/\$120 season fee/).length).toBeGreaterThan(0)
  expect(screen.queryByText(/\$210 season fee/)).not.toBeInTheDocument()
})

it('passes the selected join month through on submit', () => {
  render(<RegistrationForm onSuccess={jest.fn<void, [string, string, string, string]>()} />)
  fireEvent.change(screen.getByLabelText(/which month/i), { target: { value: 'november' } })
  fireEvent.change(screen.getByLabelText(/player name/i), { target: { value: 'Junior' } })
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '2015-06-01' } })
  fireEvent.change(screen.getByLabelText(/position/i), { target: { value: 'Forward' } })
  fireEvent.change(screen.getByLabelText(/parent name/i), { target: { value: 'Jane' } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@test.com' } })
  fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '555-1234' } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass1234' } })
  fireEvent.click(screen.getByLabelText(/pay in full/i))
  fireEvent.click(screen.getByLabelText(/i understand/i))
  fireEvent.click(screen.getByRole('button', { name: /register/i }))
  expect(registerParentAndPlayer).toHaveBeenCalledWith(expect.objectContaining({ joinMonth: 'november' }))
})
