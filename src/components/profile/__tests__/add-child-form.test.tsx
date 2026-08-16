import { screen, fireEvent } from '@testing-library/react'
import { AddChildForm } from '../add-child-form'
import { renderWithLocale as render } from '@/lib/i18n/test-utils'

const addChildToParent = jest.fn().mockResolvedValue({ playerId: 'p2' })
jest.mock('@/app/actions/register', () => ({
  addChildToParent: (...args: unknown[]) => addChildToParent(...args),
}))

it('defaults the join month to August, showing the discounted $105 season fee', () => {
  render(<AddChildForm onSuccess={jest.fn()} onCancel={jest.fn()} />)
  const joinMonth = screen.getByLabelText(/which month/i) as HTMLSelectElement
  expect(joinMonth.value).toBe('august')
  expect(screen.getAllByText(/\$105 season fee/).length).toBeGreaterThan(0)
})

it('reprices the plans when a later join month is selected', () => {
  render(<AddChildForm onSuccess={jest.fn()} onCancel={jest.fn()} />)
  fireEvent.change(screen.getByLabelText(/which month/i), { target: { value: 'october' } })
  expect(screen.getAllByText(/\$60 season fee/).length).toBeGreaterThan(0)
  expect(screen.queryByText(/\$105 season fee/)).not.toBeInTheDocument()
})

it('passes the selected join month through on submit', () => {
  render(<AddChildForm onSuccess={jest.fn()} onCancel={jest.fn()} />)
  fireEvent.change(screen.getByLabelText(/which month/i), { target: { value: 'november' } })
  fireEvent.change(screen.getByLabelText(/player name/i), { target: { value: 'Second Kid' } })
  fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: '2017-01-01' } })
  fireEvent.change(screen.getByLabelText(/position/i), { target: { value: 'Midfielder' } })
  fireEvent.click(screen.getByLabelText(/pay in full/i))
  fireEvent.click(screen.getByRole('button', { name: /add child/i }))
  expect(addChildToParent).toHaveBeenCalledWith(expect.objectContaining({ joinMonth: 'november' }))
})
