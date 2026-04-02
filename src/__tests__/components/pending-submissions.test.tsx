import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PendingSubmissions } from '@/components/admin/pending-submissions'
import * as actions from '@/app/actions/admin'
import type { Media } from '@/lib/supabase/types'

jest.mock('@/app/actions/admin', () => ({
  approveSubmission: jest.fn().mockResolvedValue(undefined),
  rejectSubmission: jest.fn().mockResolvedValue(undefined),
}))

const submission: Media = {
  id: '1',
  cloudinary_public_id: 'bocas-juniors/test-photo',
  type: 'photo',
  caption: 'A great shot',
  published: false,
  pinned: false,
  uploaded_at: '2026-04-01T10:00:00Z',
  uploaded_by: null,
  submitter_name: 'Jane Doe',
}

describe('PendingSubmissions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when there are no submissions', () => {
    const { container } = render(<PendingSubmissions submissions={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the submission count heading', () => {
    render(<PendingSubmissions submissions={[submission]} />)
    expect(screen.getByText(/pending submissions \(1\)/i)).toBeInTheDocument()
  })

  it('shows submitter name, caption, and date', () => {
    render(<PendingSubmissions submissions={[submission]} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('A great shot')).toBeInTheDocument()
  })

  it('shows "Anonymous" when submitter_name is null', () => {
    render(<PendingSubmissions submissions={[{ ...submission, submitter_name: null }]} />)
    expect(screen.getByText('Anonymous')).toBeInTheDocument()
  })

  it('calls approveSubmission and removes item on Approve click', async () => {
    render(<PendingSubmissions submissions={[submission]} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => {
      expect(actions.approveSubmission).toHaveBeenCalledWith('1')
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
    })
  })

  it('calls rejectSubmission with confirm and removes item on Reject click', async () => {
    window.confirm = jest.fn().mockReturnValue(true)
    render(<PendingSubmissions submissions={[submission]} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() => {
      expect(actions.rejectSubmission).toHaveBeenCalledWith('1', 'bocas-juniors/test-photo', 'image')
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
    })
  })

  it('does not call rejectSubmission when confirm is cancelled', async () => {
    window.confirm = jest.fn().mockReturnValue(false)
    render(<PendingSubmissions submissions={[submission]} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() => {
      expect(actions.rejectSubmission).not.toHaveBeenCalled()
    })
  })

  it('shows error message and keeps item when approveSubmission throws', async () => {
    ;(actions.approveSubmission as jest.Mock).mockRejectedValueOnce(new Error('DB error'))
    render(<PendingSubmissions submissions={[submission]} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => {
      expect(screen.getByText(/approval failed/i)).toBeInTheDocument()
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })
  })

  it('shows error message and keeps item when rejectSubmission throws', async () => {
    window.confirm = jest.fn().mockReturnValue(true)
    ;(actions.rejectSubmission as jest.Mock).mockRejectedValueOnce(new Error('DB error'))
    render(<PendingSubmissions submissions={[submission]} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() => {
      expect(screen.getByText(/rejection failed/i)).toBeInTheDocument()
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })
  })
})
