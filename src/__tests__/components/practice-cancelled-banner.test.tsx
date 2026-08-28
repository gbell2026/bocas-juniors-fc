import { render, screen } from '@testing-library/react'
import { PracticeCancelledBanner } from '@/components/practice-cancelled-banner'
import type { HomeSchedule } from '@/app/actions/schedule'

const TODAY = '2026-08-28'

function scheduleWith(practices: HomeSchedule['practices']): HomeSchedule {
  return { practices, matches: [] }
}

function practice(overrides: Partial<HomeSchedule['practices'][number]> = {}): HomeSchedule['practices'][number] {
  return {
    id: 'p1',
    date: TODAY,
    time: '17:00',
    location: 'Airport Field',
    notes: null,
    cancelled: true,
    cancellationReason: 'heavy rain',
    ...overrides,
  }
}

describe('PracticeCancelledBanner', () => {
  it("announces today's cancelled practice with the reason", () => {
    render(<PracticeCancelledBanner schedule={scheduleWith([practice()])} locale="en" todayIso={TODAY} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/today's practice .* is CANCELLED/i)
    expect(alert).toHaveTextContent(/due to heavy rain/i)
  })

  it('omits the reason line when there is no reason', () => {
    render(
      <PracticeCancelledBanner
        schedule={scheduleWith([practice({ cancellationReason: null })])}
        locale="en"
        todayIso={TODAY}
      />
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/due to/i)).not.toBeInTheDocument()
  })

  it('renders nothing when today has no cancelled practice', () => {
    const { container } = render(
      <PracticeCancelledBanner
        schedule={scheduleWith([
          practice({ cancelled: false }),
          practice({ id: 'p2', date: '2026-08-30' }),
        ])}
        locale="en"
        todayIso={TODAY}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
