import { screen, fireEvent, waitFor } from '@testing-library/react'
import { GetInvolvedForm } from '@/components/get-involved/get-involved-form'
import { renderWithLocale as render } from '@/lib/i18n/test-utils'

jest.mock('@/app/actions/get-involved', () => ({
  submitGetInvolved: jest.fn().mockResolvedValue({ error: null }),
}))

describe('GetInvolvedForm', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders all form fields', () => {
    render(<GetInvolvedForm />)
    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/business/i)).toBeInTheDocument()
    expect(screen.getByText(/sponsoring the website/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/anything else/i)).toBeInTheDocument()
  })

  it('submit button is disabled when required fields are empty', () => {
    render(<GetInvolvedForm />)
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('submit button is enabled when name, email, and at least one interest are filled', () => {
    render(<GetInvolvedForm />)
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'jane@test.com' } })
    fireEvent.click(screen.getByText(/sponsoring the website/i))
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled()
  })

  it('shows thank-you message on successful submit', async () => {
    const { submitGetInvolved } = require('@/app/actions/get-involved')
    submitGetInvolved.mockResolvedValue({ error: null })

    render(<GetInvolvedForm />)
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'jane@test.com' } })
    fireEvent.click(screen.getByText(/sponsoring the website/i))
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText(/thanks for getting in touch/i)).toBeInTheDocument()
    })
  })

  it('shows error message on failed submit', async () => {
    const { submitGetInvolved } = require('@/app/actions/get-involved')
    submitGetInvolved.mockResolvedValue({ error: 'Something went wrong' })

    render(<GetInvolvedForm />)
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'jane@test.com' } })
    fireEvent.click(screen.getByText(/sponsoring the website/i))
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })
})
