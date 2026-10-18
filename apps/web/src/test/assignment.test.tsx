import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AssignmentPanel } from '../pages/enrollments/AssignmentPanel'
import type { Enrollment } from '../types/enrollment'

const { assign } = vi.hoisted(() => ({ assign: vi.fn().mockResolvedValue({}) }))
vi.mock('../api/assignments', () => ({ assignEnrollment: assign }))
vi.mock('../hooks/useInstructors', () => ({ useInstructors: () => ({ data: { data: [
  { id: 4, full_name: 'Instrutor B', categories: ['B'], has_account: true },
  { id: 5, full_name: 'Instrutor A', categories: ['A'], has_account: true },
] }, isPending: false }) }))
const enrollment = { id: 9, category: 'B', status: 'contracted', assignment: null } as Enrollment
function setup(operate: boolean) {
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AssignmentPanel organizationId={1} enrollment={enrollment} operate={operate} /></MemoryRouter></QueryClientProvider>)
}
describe('encaminhamento', () => {
  it('oferece somente instrutor da categoria e envia o responsável sem agendar aula', async () => {
    setup(true)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Encaminhar ao instrutor' }))
    expect(screen.queryByRole('option', { name: 'Instrutor A' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Responsável · categoria B'), '4')
    await user.click(screen.getByRole('button', { name: 'Salvar encaminhamento' }))
    expect(assign).toHaveBeenCalledWith(1, enrollment, 4)
    expect(await screen.findByRole('button', { name: 'Encaminhar ao instrutor' })).toBeInTheDocument()
  })
  it('não oferece ao instrutor a ação de encaminhar ou trocar responsável', () => {
    setup(false)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Ainda não encaminhado')).toBeInTheDocument()
  })
})
