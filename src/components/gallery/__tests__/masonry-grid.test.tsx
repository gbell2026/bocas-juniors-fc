import { render, screen } from '@testing-library/react'
import { MasonryGrid } from '../masonry-grid'
import type { Media } from '@/lib/supabase/types'

const photos: Media[] = [
  { id: '1', cloudinary_public_id: 'bocas/photo1', type: 'photo',
    caption: 'Training day', pinned: false, uploaded_by: 'u1',
    uploaded_at: '2026-03-01T00:00:00Z', published: true },
]

it('renders media items', () => {
  render(<MasonryGrid items={photos} onSelect={jest.fn()} />)
  expect(screen.getByAltText('Training day')).toBeInTheDocument()
})
