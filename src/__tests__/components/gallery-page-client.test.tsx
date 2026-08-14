import { screen, fireEvent } from '@testing-library/react'
import { GalleryPageClient } from '@/components/gallery/gallery-page-client'
import { renderWithLocale as render } from '@/lib/i18n/test-utils'

// Mock heavy dependencies
jest.mock('@/components/gallery/gallery-client', () => ({
  GalleryClient: () => <div data-testid="gallery-client" />,
}))
jest.mock('@/components/gallery/upload-modal', () => ({
  UploadModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="upload-modal"><button onClick={onClose}>close</button></div> : null,
}))

describe('GalleryPageClient', () => {
  it('renders the gallery and submit button', () => {
    render(<GalleryPageClient items={[]} />)
    expect(screen.getByTestId('gallery-client')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit a photo/i })).toBeInTheDocument()
  })

  it('opens the modal when submit button is clicked', () => {
    render(<GalleryPageClient items={[]} />)
    expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /submit a photo/i }))
    expect(screen.getByTestId('upload-modal')).toBeInTheDocument()
  })

  it('closes the modal when onClose is called', () => {
    render(<GalleryPageClient items={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /submit a photo/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument()
  })
})
