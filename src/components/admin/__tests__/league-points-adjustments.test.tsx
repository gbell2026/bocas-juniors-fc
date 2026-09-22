import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeaguePointsAdjustments } from '@/components/admin/league-points-adjustments'
import { getPointsAdjustments, addPointsAdjustment, deletePointsAdjustment } from '@/app/actions/league-admin'

jest.mock('@/app/actions/league-admin', () => ({
  getPointsAdjustments: jest.fn(),
  addPointsAdjustment: jest.fn(),
  deletePointsAdjustment: jest.fn(),
}))

const divisions = [{ id: 'd1', name: 'U14' }]
const teams = [
  { id: 't1', name: 'New Generation FC', divisionId: 'd1' },
  { id: 't2', name: 'Tangerine Toucans FC', divisionId: 'd1' },
]

beforeEach(() => {
  jest.clearAllMocks()
  ;(getPointsAdjustments as jest.Mock).mockResolvedValue([])
})

it('lists existing adjustments with the team name resolved and lets you remove one', async () => {
  (getPointsAdjustments as jest.Mock).mockResolvedValueOnce([
    { id: 'adj-1', teamId: 't1', points: -3, reason: 'Fielded an overage player', createdAt: '2026-09-20' },
  ])
  ;(deletePointsAdjustment as jest.Mock).mockResolvedValue({})
  const user = userEvent.setup()
  render(<LeaguePointsAdjustments divisions={divisions} teams={teams} />)

  // "New Generation FC" also exists as a dropdown option below, so scope to
  // the list entry via its (unique) reason text.
  const entry = (await screen.findByText('Fielded an overage player')).closest('div') as HTMLElement
  expect(entry).toHaveTextContent('New Generation FC')
  expect(entry).toHaveTextContent('-3 pts')

  await user.click(screen.getByRole('button', { name: /remove/i }))
  expect(deletePointsAdjustment).toHaveBeenCalledWith('adj-1')
  expect(await screen.findByText('No points adjustments for this division.')).toBeInTheDocument()
})

it('adds a new adjustment and prepends it to the list', async () => {
  (addPointsAdjustment as jest.Mock).mockResolvedValue({
    adjustment: { id: 'adj-2', teamId: 't2', points: -1, reason: 'Started more than 5 minutes late', createdAt: '2026-09-20' },
  })
  const user = userEvent.setup()
  render(<LeaguePointsAdjustments divisions={divisions} teams={teams} />)
  await screen.findByText('No points adjustments for this division.')

  // comboboxes[0] = division picker, comboboxes[1] = the Add Adjustment form's team picker
  await user.selectOptions(screen.getAllByRole('combobox')[1], 't2')
  await user.type(screen.getByPlaceholderText('Points (e.g. -3)'), '-1')
  await user.type(screen.getByPlaceholderText('Reason (e.g. Fielded an overage player)'), 'Started more than 5 minutes late')
  await user.click(screen.getByRole('button', { name: /^add adjustment$/i }))

  expect(addPointsAdjustment).toHaveBeenCalledWith({ teamId: 't2', points: -1, reason: 'Started more than 5 minutes late' })
  // "Tangerine Toucans FC" now appears both in the new list entry and as a
  // dropdown option — assert on the reason text, which is unique, to confirm
  // the entry actually rendered.
  const entry = (await screen.findByText('Started more than 5 minutes late')).closest('div') as HTMLElement
  expect(entry).toHaveTextContent('Tangerine Toucans FC')
  expect(entry).toHaveTextContent('-1 pts')
})

it('blocks submitting without a reason', async () => {
  const user = userEvent.setup()
  render(<LeaguePointsAdjustments divisions={divisions} teams={teams} />)
  await screen.findByText('No points adjustments for this division.')

  await user.selectOptions(screen.getAllByRole('combobox')[1], 't1')
  await user.type(screen.getByPlaceholderText('Points (e.g. -3)'), '-1')
  await user.click(screen.getByRole('button', { name: /^add adjustment$/i }))

  expect(await screen.findByText(/pick a team, a non-zero points value, and a reason/i)).toBeInTheDocument()
  expect(addPointsAdjustment).not.toHaveBeenCalled()
})
