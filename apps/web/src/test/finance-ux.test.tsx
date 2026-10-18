import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { EnrollmentFinancePanel } from '../pages/enrollments/EnrollmentFinancePanel'
import { SituationBadge } from '../pages/finance/shared'
import type { Enrollment } from '../types/enrollment'
import type { Organization } from '../types/organization'

const { charge } = vi.hoisted(() => ({ charge: vi.fn() }))
vi.mock('../hooks/useFinance', async (importOriginal) => ({
  ...await importOriginal<typeof import('../hooks/useFinance')>(),
  useEnrollmentFinance: () => ({ data: { charged_cents: 0, received_cents: 0, entries: [], packages: [
    { id: 11, description: 'Pacote inicial', price_cents: 100000, charged: false },
    { id: 22, description: 'Acréscimo', price_cents: 50000, charged: false },
  ] } }),
  useChargeFrom: () => ({ mutate: charge, isPending: false }),
  useParties: () => ({ data: [] }),
}))

describe('atendimento financeiro', () => {
  it('envia o pacote escolhido mesmo quando existe um acréscimo mais recente', async () => {
    render(<MemoryRouter><EnrollmentFinancePanel
      organization={{ id: 1, timezone: 'America/Sao_Paulo' } as Organization}
      enrollment={{ id: 9, student: { name: 'Ana' } } as Enrollment} canManage={false}
    /></MemoryRouter>)
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: 'Gerar cobrança' })[0])
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Gerar cobrança' }))
    expect(charge).toHaveBeenCalledWith(expect.objectContaining({ path: '/enrollments/9/finance/charge', body: expect.objectContaining({ package_id: 11, total_cents: 100000 }) }), expect.any(Object))
  })

  it('explica que a parcela quitada ainda aguarda liquidação', () => {
    render(<SituationBadge situation="paid" pendingCents={25000} />)
    expect(screen.getByText('Quitada')).toBeInTheDocument()
    expect(screen.getByText(/aguardando liquidação/)).toHaveTextContent('250,00')
    expect(screen.queryByText('Paga')).not.toBeInTheDocument()
  })
})
