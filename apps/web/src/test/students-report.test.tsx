import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { DEFAULT_PANELS } from '../pages/reports/students/config'
import { SummaryPanels } from '../pages/reports/students/SummaryPanels'
import type { StudentsReport } from '../types/reports'

const totals = { count: 10, in_progress: 5, prospect: 1, qualified: 2, dropped: 1, registered: 1, with_lesson: 1, exam_only: 0, finishing: 0, no_schedule: 4, archive_ready: 3, archive_blocked: 1 }

const report: StudentsReport = {
  as_of: '2026-10-18T12:00:00Z',
  timezone: 'America/Sao_Paulo',
  filtered: false,
  overview: { ...totals, archived: 1 },
  totals,
  share: { students: 100, in_progress: 100, with_lesson: 100, no_schedule: 100, qualified: 100, archive_ready: 100 },
  situations: [
    { key: 'in_progress', count: 5 },
    { key: 'prospect', count: 1 },
    { key: 'qualified', count: 2 },
    { key: 'dropped', count: 1 },
    { key: 'registered', count: 1 },
    { key: 'archived', count: 0 },
  ],
  agenda: [
    { key: 'with_lesson', count: 1 },
    { key: 'exam_only', count: 0 },
    { key: 'finishing', count: 0 },
    { key: 'no_schedule', count: 4 },
  ],
  stall: [
    { key: 'practice_blocked', count: 1 },
    { key: 'no_package', count: 1 },
    { key: 'no_balance', count: 0 },
    { key: 'ready_to_schedule', count: 2 },
  ],
  archive: [],
  idle: [
    { key: 'd7', count: 1 },
    { key: 'd15', count: 1 },
    { key: 'd30', count: 0 },
    { key: 'd60', count: 0 },
  ],
  balance: [],
  exams: { scheduled: 0, retry: 0 },
  categories: [],
  instructors: [
    { id: 1, key: '1', name: 'Ana', selected: false, students: 4, in_progress: 2, with_lesson: 1, no_schedule: 1, qualified: 2, archive_ready: 1, share_students: 40, share_in_progress: 40, share_with_lesson: 100 },
    { id: 2, key: '2', name: 'Beto', selected: false, students: 3, in_progress: 3, with_lesson: 0, no_schedule: 3, qualified: 0, archive_ready: 0, share_students: 30, share_in_progress: 60, share_with_lesson: 0 },
  ],
  partners: [],
  movement: { new: 2, qualified: 1, archived: 0 },
  basis: 'Retrato de hoje.',
}

function setup(overrides: Partial<React.ComponentProps<typeof SummaryPanels>> = {}) {
  const props = {
    data: report,
    panels: DEFAULT_PANELS,
    focus: {},
    onFocus: vi.fn(),
    selectedInstructors: [] as string[],
    onToggleInstructor: vi.fn(),
    onCategory: vi.fn(),
    onPartner: vi.fn(),
    independent: false,
    period: { timezone: 'America/Sao_Paulo', from: '2026-09-19', to: '2026-10-18', onChange: vi.fn() },
    ...overrides,
  }
  render(<MemoryRouter><SummaryPanels {...props} /></MemoryRouter>)
  return props
}

it('mostra os números principais e abre só os alunos sem nada agendado ao clicar', () => {
  const { onFocus } = setup()

  const kpis = within(screen.getByRole('region', { name: 'Números principais' }))
  expect(kpis.getByRole('button', { name: /Sem nada agendado\s*4/ })).toBeInTheDocument()
  expect(kpis.getByRole('button', { name: /Podem arquivar\s*3/ })).toHaveTextContent('+1 quase')

  fireEvent.click(kpis.getByRole('button', { name: /Sem nada agendado/ }))
  expect(onFocus).toHaveBeenCalledWith({ sit: 'in_progress', agenda: 'no_schedule' })
})

it('explica por que os alunos estão parados e leva ao grupo certo', () => {
  const { onFocus } = setup()

  expect(screen.getByText('Prática não liberada')).toBeInTheDocument()
  expect(screen.getByText('Entrar em contato e agendar')).toBeInTheDocument()
  // Motivo sem alunos não aparece
  expect(screen.queryByText('Saldo esgotado')).not.toBeInTheDocument()

  fireEvent.click(within(screen.getByText('Sem pacote de aulas').closest('li') as HTMLElement).getByRole('button', { name: 'Ver' }))
  expect(onFocus).toHaveBeenCalledWith({ sit: 'in_progress', agenda: 'no_schedule', motivo: 'no_package' })

  fireEvent.click(screen.getByRole('button', { name: /15 dias ou mais/ }))
  expect(onFocus).toHaveBeenCalledWith({ sit: 'in_progress', agenda: 'no_schedule', parado: '15' })
})

it('junta instrutores marcando a linha de cada um', () => {
  const { onToggleInstructor } = setup()

  fireEvent.click(screen.getAllByRole('checkbox', { name: 'Juntar Beto à seleção' })[0])
  expect(onToggleInstructor).toHaveBeenCalledWith('2')
})

it('respeita os blocos escolhidos e esconde os demais', () => {
  setup({ panels: ['kpis'] })

  expect(screen.getByRole('region', { name: 'Números principais' })).toBeInTheDocument()
  expect(screen.queryByText('Por instrutor')).not.toBeInTheDocument()
  expect(screen.queryByText('Movimento do período')).not.toBeInTheDocument()
})

it('mostra a fatia da seleção quando há filtro', () => {
  setup({ data: { ...report, filtered: true, share: { ...report.share, in_progress: 40 } } })

  expect(screen.getAllByText('= 40% do total').length).toBeGreaterThan(0)
})
