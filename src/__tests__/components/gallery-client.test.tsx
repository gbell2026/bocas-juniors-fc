import { screen, fireEvent } from '@testing-library/react'
import { GalleryClient } from '@/components/gallery/gallery-client'
import type { Media } from '@/lib/supabase/types'
import { renderWithLocale as render } from '@/lib/i18n/test-utils'

// Mock the lightbox — it's not what we're testing
jest.mock('yet-another-react-lightbox', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) => open ? <div data-testid="lightbox" /> : null,
}))
jest.mock('yet-another-react-lightbox/plugins/video', () => ({ __esModule: true, default: {} }))
jest.mock('yet-another-react-lightbox/styles.css', () => {})

const photo: Media = {
  id: '1', type: 'photo', cloudinary_public_id: 'test/photo1',
  caption: 'A photo', published: true, pinned: false,
  uploaded_at: '2024-01-01', uploaded_by: 'user1',
}
const video: Media = {
  id: '2', type: 'video', cloudinary_public_id: 'test/video1',
  caption: 'A video', published: true, pinned: false,
  uploaded_at: '2024-01-02', uploaded_by: 'user1',
}

describe('GalleryClient filter tabs', () => {
  it('shows all items by default', () => {
    render(<GalleryClient items={[photo, video]} />)
    expect(screen.getByAltText('A photo')).toBeInTheDocument()
    expect(screen.getByAltText('A video')).toBeInTheDocument()
  })

  it('filters to photos only', () => {
    render(<GalleryClient items={[photo, video]} />)
    fireEvent.click(screen.getByRole('button', { name: /photos/i }))
    expect(screen.getByAltText('A photo')).toBeInTheDocument()
    expect(screen.queryByAltText('A video')).not.toBeInTheDocument()
  })

  it('filters to videos only', () => {
    render(<GalleryClient items={[photo, video]} />)
    fireEvent.click(screen.getByRole('button', { name: /videos/i }))
    expect(screen.queryByAltText('A photo')).not.toBeInTheDocument()
    expect(screen.getByAltText('A video')).toBeInTheDocument()
  })

  it('returns to all items when All tab clicked', () => {
    render(<GalleryClient items={[photo, video]} />)
    fireEvent.click(screen.getByRole('button', { name: /photos/i }))
    fireEvent.click(screen.getByRole('button', { name: /all/i }))
    expect(screen.getByAltText('A photo')).toBeInTheDocument()
    expect(screen.getByAltText('A video')).toBeInTheDocument()
  })
})
