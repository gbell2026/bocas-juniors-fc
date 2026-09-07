import { render, screen } from '@testing-library/react'
import { AnnouncementsAdmin } from '@/components/admin/announcements-admin'

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
})
