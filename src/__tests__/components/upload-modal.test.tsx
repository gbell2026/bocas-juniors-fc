import { render, screen, fireEvent } from '@testing-library/react'
import { UploadModal } from '@/components/gallery/upload-modal'

// Suppress XMLHttpRequest not implemented warnings in jsdom
global.XMLHttpRequest = jest.fn(() => ({
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  upload: { onprogress: null },
  onload: null,
  onerror: null,
  status: 200,
  responseText: '{}',
})) as any

describe('UploadModal', () => {
  const onClose = jest.fn()

  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when open is false', () => {
    const { container } = render(<UploadModal open={false} onClose={onClose} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the drop zone when open', () => {
    render(<UploadModal open={true} onClose={onClose} />)
    expect(screen.getByText(/tap to add photos/i)).toBeInTheDocument()
  })

  it('upload button is disabled when no files are selected', () => {
    render(<UploadModal open={true} onClose={onClose} />)
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled()
  })

  it('shows error for files over 50MB and does not add them', () => {
    render(<UploadModal open={true} onClose={onClose} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const bigFile = new File(['x'.repeat(1)], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(bigFile, 'size', { value: 51 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [bigFile] } })
    expect(screen.getByText(/too large/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled()
  })

  it('calls onClose when the × button is clicked', () => {
    render(<UploadModal open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
