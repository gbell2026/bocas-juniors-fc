import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GetInvolvedSubmissions } from '@/components/admin/get-involved-submissions'
import * as actions from '@/app/actions/admin'
import type { GetInvolvedSubmission } from '@/lib/supabase/types'

jest.mock('@/app/actions/admin', () => ({
  markSubmissionHandled: jest.fn().mockResolvedValue(undefined),
}))

const submission: GetInvolvedSubmission = {
  id: '1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  organisation: 'Acme Corp',
  interests: ['Sponsoring the kit', 'Donating equipment'],
  message: 'Happy to help!',
  submitted_at: '2026-04-05T10:00:00Z',
  handled: false,
}

describe('GetInvolvedSubmissions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when there are no submissions', () => {
    const { container } = render(<GetInvolvedSubmissions submissions={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the heading with unhandled count', () => {
    render(<GetInvolvedSubmissions submissions={[submission]} />)
    expect(screen.getByText(/get involved submissions \(1 unhandled\)/i)).toBeInTheDocument()
  })

  it('shows submission details', () => {
    render(<GetInvolvedSubmissions submissions={[submission]} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Sponsoring the kit')).toBeInTheDocument()
    expect(screen.getByText('Donating equipment')).toBeInTheDocument()
    expect(screen.getByText('Happy to help!')).toBeInTheDocument()
  })

  it('calls markSubmissionHandled and dims row on Mark as Handled click', async () => {
    render(<GetInvolvedSubmissions submissions={[submission]} />)
    fireEvent.click(screen.getByRole('button', { name: /mark as handled/i }))
    await waitFor(() => {
      expect(actions.markSubmissionHandled).toHaveBeenCalledWith('1')
      expect(screen.getByText('Handled')).toBeInTheDocument()
    })
  })

  it('shows Handled text instead of button for already-handled submissions', () => {
    render(<GetInvolvedSubmissions submissions={[{ ...submission, handled: true }]} />)
    expect(screen.queryByRole('button', { name: /mark as handled/i })).not.toBeInTheDocument()
    expect(screen.getByText('Handled')).toBeInTheDocument()
  })
})
