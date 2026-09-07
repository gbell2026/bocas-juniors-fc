import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnnouncementsAdmin } from '@/components/admin/announcements-admin'
import { createAnnouncement } from '@/app/actions/announcements'

jest.mock('@/app/actions/announcements', () => ({
  createAnnouncement: jest.fn(),
  updateAnnouncement: jest.fn(),
  deleteAnnouncement: jest.fn(),
  deleteComment: jest.fn(),
}))

const announcements = [
  { id: 'a1', title: 'Games off today', body: 'Pitch is waterlogged. Rescheduled for Saturday.', createdAt: '2026-09-06', comments: [] },
] as any

describe('AnnouncementsAdmin', () => {
  it('offers a WhatsApp share link carrying the announcement title and body', () => {
    render(<AnnouncementsAdmin announcements={announcements} />)
    const link = screen.getByRole('link', { name: /share on whatsapp/i })
    expect(link).toHaveAttribute('target', '_blank')

    const text = decodeURIComponent(link.getAttribute('href')!.split('text=')[1])
    expect(text).toContain('*Games off today*')
    expect(text).toContain('Pitch is waterlogged. Rescheduled for Saturday.')
  })

  it('passes the "email all parents" choice through and reports the result', async () => {
    const user = userEvent.setup()
    ;(createAnnouncement as jest.Mock).mockResolvedValueOnce({
      announcement: { id: 'a2', title: 'Kit day', body: 'Bring $10.', createdAt: '2026-09-07' },
      email: { sent: 12, failed: 0 },
    })

    render(<AnnouncementsAdmin announcements={[]} />)
    await user.type(screen.getByPlaceholderText('Title'), 'Kit day')
    await user.type(screen.getByPlaceholderText('Body'), 'Bring $10.')
    await user.click(screen.getByLabelText(/email all parents/i))
    await user.click(screen.getByRole('button', { name: /create announcement/i }))

    expect(createAnnouncement).toHaveBeenCalledWith({ title: 'Kit day', body: 'Bring $10.', emailParents: true })
    expect(await screen.findByText(/emailed 12 parents/i)).toBeInTheDocument()
  })
})
