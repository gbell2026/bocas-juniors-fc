import { screen } from '@testing-library/react'
import { RegistrationForm } from '../registration-form'
import { renderWithLocale as render } from '@/lib/i18n/test-utils'

jest.mock('@/app/actions/register', () => ({
  registerParentAndPlayer: jest.fn().mockResolvedValue({ playerId: 'p1', parentId: 'pa1', userId: 'u1' }),
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
