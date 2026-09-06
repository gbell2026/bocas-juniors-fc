import { render, screen } from '@testing-library/react'
import { LeaguePostponedBanner } from '@/components/league-postponed-banner'

describe('LeaguePostponedBanner', () => {
  it('shows the admin message when active', () => {
    render(
      <LeaguePostponedBanner
        banner={{ active: true, message: "Today's league fixtures are postponed due to bad weather." }}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      /today's league fixtures are postponed due to bad weather/i
    )
  })

  it('renders nothing when not active', () => {
    const { container } = render(
      <LeaguePostponedBanner banner={{ active: false, message: 'Postponed' }} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when active but the message is blank', () => {
    const { container } = render(
      <LeaguePostponedBanner banner={{ active: true, message: '   ' }} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
