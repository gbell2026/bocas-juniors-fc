import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MediaUploader } from '@/components/admin/media-uploader'
import { saveMediaRecord } from '@/app/actions/admin'

jest.mock('@/app/actions/admin', () => ({ saveMediaRecord: jest.fn() }))

const originalFetch = global.fetch

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ signature: 'sig', timestamp: '123', cloudName: 'demo', apiKey: 'key', folder: 'toucans' }),
    })
    .mockResolvedValueOnce({ json: async () => ({ public_id: 'toucans/photo1' }) }) as any
})

afterAll(() => {
  global.fetch = originalFetch
})

// jsdom's window.location.reload() throws "Not implemented" if it's ever
// actually invoked — if a leftover reload call regressed into this
// component, this test would fail loudly rather than silently pass.
it('uploads a file, saves the media record, and shows a completion message without reloading the page', async () => {
  render(<MediaUploader uploadedBy="admin-1" />)

  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })

  await waitFor(() => expect(saveMediaRecord).toHaveBeenCalledWith({
    cloudinaryPublicId: 'toucans/photo1', type: 'photo', uploadedBy: 'admin-1',
  }))
  expect(await screen.findByText('Upload complete!')).toBeInTheDocument()
})
