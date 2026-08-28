import { render, screen } from '@testing-library/react'
import { PracticeBannerView } from '@/components/practice-banner-view'

describe('PracticeBannerView', () => {
  it('shows the date and reason in the cancellation message', () => {
    render(<PracticeBannerView date="Saturday 30 August" reason="heavy rain" />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      /today's practice \(Saturday 30 August\) is Cancelled/i
    )
    expect(screen.getByText(/due to heavy rain/i)).toBeInTheDocument()
  })

  it('omits the parenthetical when no date is given', () => {
    render(<PracticeBannerView date="" reason="waterlogged pitch" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/today's practice is Cancelled/i)
    expect(screen.queryByText('()')).not.toBeInTheDocument()
  })

  it('omits the reason line when no reason is given', () => {
    render(<PracticeBannerView date="today" reason="" />)
    expect(screen.queryByText(/due to/i)).not.toBeInTheDocument()
  })
})
