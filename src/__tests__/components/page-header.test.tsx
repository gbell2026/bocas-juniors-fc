import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/page-header'

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="Gallery" />)
    expect(screen.getByRole('heading', { name: /gallery/i })).toBeInTheDocument()
  })

  it('renders the subtitle when provided', () => {
    render(<PageHeader title="Gallery" subtitle="Photos from the pitch" />)
    expect(screen.getByText(/photos from the pitch/i)).toBeInTheDocument()
  })

  it('does not render subtitle element when not provided', () => {
    render(<PageHeader title="Gallery" />)
    expect(screen.queryByText(/photos/i)).not.toBeInTheDocument()
  })
})
