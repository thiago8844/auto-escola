import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import EntriesPage from '../pages/finance/EntriesPage'

vi.mock('../hooks/useActiveOrganization', () => ({ useActiveOrganization: () => ({ id: 1, role: 'owner', timezone: 'America/Sao_Paulo' }) }))
vi.mock('../pages/finance/EntryDetailModal', () => ({ EntryDetailModal: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Fechar detalhe</button> }))
vi.mock('../hooks/useFinance', () => ({
  useCategories: () => ({ data: [] }), useAccounts: () => ({ data: [] }), useMethods: () => ({ data: [] }), useExportCsv: () => ({ mutate: vi.fn() }),
  useFinanceInstallments: () => ({ data: {
    data: [{ id: 11, entry_id: 8, number: 1, due_date: '2026-10-20', amount_cents: 10000, outstanding_cents: 0, situation: 'paid', awaiting_settlement_cents: 0, entry: { id: 8, description: 'Pacote Maria', installments_count: 1, category: { name: 'Aulas' } } }],
    meta: { total: 31, current_page: 3, last_page: 3, per_page: 15 },
    totals: { amount_cents: 10000, outstanding_cents: 0, by_situation: Object.fromEntries(['forecast', 'overdue', 'partial', 'paid', 'cancelled'].map(s => [s, { count: 0, outstanding_cents: 0 }])) },
  } }),
}))
it('abrir e fechar lançamento preserva a página e a busca da lista', async () => {
  const router = createMemoryRouter([{ path: '/', element: <EntriesPage type="receivable" /> }], { initialEntries: ['/?page=3&q=Maria'] })
  render(<RouterProvider router={router} />)
  const user = userEvent.setup()
  await user.click(screen.getAllByRole('button', { name: 'Detalhes' })[0])
  expect(new URLSearchParams(router.state.location.search).get('page')).toBe('3')
  expect(new URLSearchParams(router.state.location.search).get('lancamento')).toBe('8')
  await user.click(screen.getByRole('button', { name: 'Fechar detalhe' }))
  expect(new URLSearchParams(router.state.location.search).get('page')).toBe('3')
  expect(new URLSearchParams(router.state.location.search).get('q')).toBe('Maria')
  expect(new URLSearchParams(router.state.location.search).has('lancamento')).toBe(false)
})
