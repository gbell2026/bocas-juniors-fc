import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeaguePendingQueue } from '../league-pending-queue'
import {
  approveLeagueClub, approveLeaguePlayer,
} from '@/app/actions/league-admin'

jest.mock('@/app/actions/league-admin', () => ({
  approveLeagueClub: jest.fn(),
  rejectLeagueClub: jest.fn(),
  approveLeagueTeam: jest.fn(),
  rejectLeagueTeam: jest.fn(),
  approveLeaguePlayer: jest.fn(),
  rejectLeaguePlayer: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

it('renders nothing when there is nothing pending', () => {
  const { container } = render(<LeaguePendingQueue clubs={[]} teams={[]} players={[]} />)
  expect(container).toBeEmptyDOMElement()
})

it('removes a club row after a successful approval', async () => {
  (approveLeagueClub as jest.Mock).mockResolvedValue({})
  const user = userEvent.setup()
  render(
    <LeaguePendingQueue
      clubs={[{ id: 'club-1', name: 'Isla FC', contact_name: 'Jane', contact_email: 'jane@islafc.com', contact_phone: '555' }]}
      teams={[]}
      players={[]}
    />
  )
  expect(screen.getByText('Isla FC')).toBeInTheDocument()

  await user.click(screen.getAllByRole('button', { name: /approve/i })[0])

  await waitFor(() => expect(screen.queryByText('Isla FC')).not.toBeInTheDocument())
})

it('keeps the player row and shows the error when approval reports a squad-number conflict', async () => {
  (approveLeaguePlayer as jest.Mock).mockResolvedValue({ error: 'That squad number is already taken on this team — ask the club for a different number.' })
  const user = userEvent.setup()
  render(
    <LeaguePendingQueue
      clubs={[]}
      teams={[]}
      players={[{ id: 'player-1', name: 'Junior', squadNumber: 7, teamName: 'U12', clubName: 'Isla FC' }]}
    />
  )

  await user.click(screen.getByRole('button', { name: /approve/i }))

  expect(await screen.findByText(/already taken/i)).toBeInTheDocument()
  expect(screen.getByText('Junior')).toBeInTheDocument()
})
