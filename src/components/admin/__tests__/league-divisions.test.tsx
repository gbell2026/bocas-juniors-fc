import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeagueDivisions } from '@/components/admin/league-divisions'
import { createDivision, generateSchedule } from '@/app/actions/league-admin'

jest.mock('@/app/actions/league-admin', () => ({
  createDivision: jest.fn(),
  updateDivision: jest.fn(),
  generateSchedule: jest.fn(),
  generateAlignedSchedule: jest.fn(),
}))

const division = { id: 'd1', name: 'U10', season_start_date: '2026-08-01', season_end_date: '2026-11-01', created_at: '2026-01-01' }

beforeEach(() => {
  jest.clearAllMocks()
})

it('appends a newly created division locally and reports it via onDivisionCreated', async () => {
  const newDivision = { id: 'd2', name: 'U14', season_start_date: '2026-08-01', season_end_date: '2026-11-01', created_at: '2026-02-01' }
  ;(createDivision as jest.Mock).mockResolvedValue({ division: newDivision })
  const onDivisionCreated = jest.fn()
  const user = userEvent.setup()
  render(<LeagueDivisions divisions={[division]} onDivisionCreated={onDivisionCreated} />)

  await user.type(screen.getByPlaceholderText('Division name (e.g. U12)'), 'U14')
  const dateInputs = document.querySelectorAll('input[type="date"]')
  await user.type(dateInputs[dateInputs.length - 2] as HTMLElement, '2026-08-01')
  await user.type(dateInputs[dateInputs.length - 1] as HTMLElement, '2026-11-01')
  await user.click(screen.getByRole('button', { name: /^create division$/i }))

  expect(await screen.findByText('U14')).toBeInTheDocument()
  expect(onDivisionCreated).toHaveBeenCalledWith(newDivision)
})

it('calls onScheduleGenerated after a successful schedule generation, without a page reload', async () => {
  (generateSchedule as jest.Mock).mockResolvedValue({})
  const onScheduleGenerated = jest.fn()
  const user = userEvent.setup()
  render(<LeagueDivisions divisions={[division]} onScheduleGenerated={onScheduleGenerated} />)

  const row = screen.getByText('U10').closest('div') as HTMLElement
  await user.click(within(row.parentElement as HTMLElement).getByRole('button', { name: /generate schedule/i }))

  expect(generateSchedule).toHaveBeenCalledWith('d1')
  expect(onScheduleGenerated).toHaveBeenCalledTimes(1)
})
