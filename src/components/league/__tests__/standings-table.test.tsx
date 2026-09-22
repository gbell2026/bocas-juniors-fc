import { render, screen } from '@testing-library/react'
import { StandingsTable } from '@/components/league/standings-table'
import { getStandings } from '@/app/actions/league'

jest.mock('@/app/actions/league', () => ({ getStandings: jest.fn() }))
jest.mock('@/lib/i18n/locale-context', () => ({
  useLocale: () => ({
    locale: 'en',
    t: {
      league: {
        standings: {
          loading: 'Loading table…', empty: 'No teams registered in this division yet.',
          team: 'Team', played: 'P', won: 'W', drawn: 'D', lost: 'L', goalDifference: 'GD', points: 'Pts',
        },
      },
    },
  }),
}))

function row(over: Record<string, unknown>) {
  return {
    teamId: 'x', teamName: 'Team X', badgeCloudinaryPublicId: null,
    played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 1, goalsAgainst: 0, goalDifference: 1,
    points: 3, adjustmentPoints: 0, adjustmentNotes: [],
    ...over,
  }
}

it('shows the adjustment reason as visible text below the table, not just a hover tooltip', async () => {
  (getStandings as jest.Mock).mockResolvedValue([
    row({ teamId: 't1', teamName: 'New Generation FC', points: 3, adjustmentPoints: -3, adjustmentNotes: ['-3: Fielded an overage player'] }),
    row({ teamId: 't2', teamName: 'Tangerine Toucans FC' }),
  ])

  render(<StandingsTable divisionId="div-1" />)

  // visible immediately in the DOM text, no hover/interaction needed
  expect(await screen.findByText(/Fielded an overage player/)).toBeInTheDocument()
  expect(screen.getByText('New Generation FC:')).toBeInTheDocument()

  // marker in the points cell matches the footnote marker
  expect(screen.getAllByText('*')).toHaveLength(2) // once next to the points, once in the footnote line
})

it('gives each adjusted team a different marker and colours a positive adjustment differently from a negative one', async () => {
  (getStandings as jest.Mock).mockResolvedValue([
    row({ teamId: 't1', teamName: 'Team A', adjustmentPoints: -1, adjustmentNotes: ['-1: Late kickoff'] }),
    row({ teamId: 't2', teamName: 'Team B', adjustmentPoints: 2, adjustmentNotes: ['+2: Fair play award'] }),
  ])

  render(<StandingsTable divisionId="div-1" />)
  await screen.findByText(/Late kickoff/)

  expect(screen.getByText('Team A:').closest('p')).toHaveTextContent('*')
  expect(screen.getByText('Team B:').closest('p')).toHaveTextContent('†')
})

it('shows a footnote for a zero-point note (e.g. a default-loss scoreline) in a neutral colour', async () => {
  (getStandings as jest.Mock).mockResolvedValue([
    row({ teamId: 't1', teamName: 'New Generation FC', adjustmentPoints: 0, adjustmentNotes: ['Fielded an ineligible player — default loss awarded'] }),
  ])

  render(<StandingsTable divisionId="div-1" />)
  expect(await screen.findByText(/Fielded an ineligible player/)).toBeInTheDocument()
  expect(screen.getByText('New Generation FC:')).toBeInTheDocument()
  for (const marker of screen.getAllByText('*')) {
    expect(marker).toHaveClass('text-amber-600')
  }
})

it('renders no footnotes section when nothing has been adjusted', async () => {
  (getStandings as jest.Mock).mockResolvedValue([row({ teamId: 't1' })])
  render(<StandingsTable divisionId="div-1" />)
  await screen.findByText('Team X')
  expect(screen.queryByText('Team X:')).not.toBeInTheDocument()
  expect(screen.queryByText('*')).not.toBeInTheDocument()
})
