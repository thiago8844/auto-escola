import { useState } from 'react'
import type { StudentAgenda, StudentArchive, StudentBalanceState, StudentSituation, StudentStall } from '../../../types/reports'

type Tone = { label: string; bg: string; hint: string }

export const SITUATION: Record<StudentSituation, Tone> = {
  in_progress: { label: 'Em habilitação', bg: 'primary', hint: 'Matrícula contratada ou em atendimento, com processo ainda aberto.' },
  prospect: { label: 'Interessado', bg: 'info', hint: 'Só matrícula de interessado, ainda sem contrato.' },
  qualified: { label: 'Habilitado', bg: 'success', hint: 'Processo concluído.' },
  dropped: { label: 'Encerrado sem habilitação', bg: 'warning', hint: 'Matrícula ou processo encerrado sem concluir (desistência, rescisão ou outro motivo).' },
  registered: { label: 'Só cadastro', bg: 'secondary', hint: 'Está cadastrado, mas nunca teve matrícula.' },
  archived: { label: 'Arquivado', bg: 'dark', hint: 'Fora da operação; o histórico continua guardado.' },
}

export const AGENDA: Record<StudentAgenda, Tone> = {
  with_lesson: { label: 'Com aula agendada', bg: 'success', hint: 'Tem aula marcada daqui para frente.' },
  exam_only: { label: 'Só com exame', bg: 'info', hint: 'Sem aula, mas com exame agendado: está aguardando a prova.' },
  finishing: { label: 'Finalizando', bg: 'secondary', hint: 'Já aprovado, aguardando emissão ou entrega do documento.' },
  no_schedule: { label: 'Sem nada agendado', bg: 'warning', hint: 'Em habilitação, sem aula nem exame marcado.' },
}

export const STALL: Record<StudentStall, Tone & { action: string }> = {
  practice_blocked: { label: 'Prática não liberada', bg: 'danger', hint: 'Há documentos obrigatórios sem conferência no processo.', action: 'Conferir os documentos pendentes' },
  no_package: { label: 'Sem pacote de aulas', bg: 'warning', hint: 'A matrícula não tem aulas contratadas registradas.', action: 'Registrar a contratação de aulas' },
  no_balance: { label: 'Saldo esgotado', bg: 'warning', hint: 'Acabaram os minutos contratados.', action: 'Oferecer um acréscimo de aulas' },
  ready_to_schedule: { label: 'Liberado: falta agendar', bg: 'primary', hint: 'Está liberado e tem saldo; só falta marcar a aula.', action: 'Entrar em contato e agendar' },
}

export const ARCHIVE: Record<StudentArchive, Tone> = {
  ready: { label: 'Pode arquivar', bg: 'success', hint: 'Sem aula ou exame agendado e sem matrícula em andamento.' },
  blocked_enrollment: { label: 'Encerrar matrícula', bg: 'warning', hint: 'O processo acabou, mas a matrícula ainda está aberta. Encerre-a para poder arquivar.' },
  blocked_agenda: { label: 'Tem agenda', bg: 'warning', hint: 'Ainda há aula ou exame agendado. Conclua ou cancele antes de arquivar.' },
}

export const BALANCE: Record<StudentBalanceState, { label: string; bg: string }> = {
  exhausted: { label: 'Esgotado', bg: 'danger' },
  low: { label: 'Baixo', bg: 'warning' },
  ok: { label: 'Ok', bg: 'success' },
  none: { label: 'Sem pacote', bg: 'secondary' },
}

export const IDLE_LABELS = { d7: '7 dias ou mais', d15: '15 dias ou mais', d30: '30 dias ou mais', d60: '60 dias ou mais' } as const
export const IDLE_OPTIONS = ['7', '15', '30', '60'] as const

export const INSTRUCTOR_SOURCE = { assigned: 'Encaminhado à matrícula', next_lesson: 'Pela próxima aula', last_lesson: 'Pela última aula' } as const

// Cada visão responde a uma pergunta do dia a dia com um clique
export type Focus = Partial<Record<'sit' | 'agenda' | 'motivo' | 'arquivar' | 'exame' | 'parado', string>>
export const FOCUS_KEYS = ['sit', 'agenda', 'motivo', 'arquivar', 'exame', 'parado'] as const

export const PRESETS: Array<{ id: string; label: string; icon: string; focus: Focus }> = [
  { id: 'all', label: 'Todos', icon: 'bi-people', focus: {} },
  { id: 'progress', label: 'Em habilitação', icon: 'bi-person-workspace', focus: { sit: 'in_progress' } },
  { id: 'lesson', label: 'Com aula agendada', icon: 'bi-calendar-check', focus: { sit: 'in_progress', agenda: 'with_lesson' } },
  { id: 'idle', label: 'Sem nada agendado', icon: 'bi-hourglass-split', focus: { sit: 'in_progress', agenda: 'no_schedule' } },
  { id: 'retry', label: 'Exame para refazer', icon: 'bi-arrow-repeat', focus: { exame: 'retry' } },
  { id: 'qualified', label: 'Habilitados', icon: 'bi-patch-check', focus: { sit: 'qualified' } },
  { id: 'archive', label: 'Podem arquivar', icon: 'bi-archive', focus: { arquivar: 'ready' } },
  { id: 'archived', label: 'Arquivados', icon: 'bi-box-seam', focus: { sit: 'archived' } },
]

export const COLUMNS = {
  situation: 'Situação',
  agenda: 'Agenda',
  instructor: 'Instrutor',
  categories: 'Categoria',
  next_lesson: 'Próxima aula',
  last_lesson: 'Última aula',
  idle: 'Parado há',
  lessons: 'Aulas feitas',
  balance: 'Saldo',
  exam: 'Exame',
  archive: 'Arquivamento',
  partner: 'Autoescola',
  created: 'Cadastro',
} as const
export type ColumnKey = keyof typeof COLUMNS
export const COLUMN_KEYS = Object.keys(COLUMNS) as ColumnKey[]
export const DEFAULT_COLUMNS: ColumnKey[] = ['situation', 'agenda', 'instructor', 'next_lesson', 'idle', 'balance', 'archive']

export const PANELS = {
  kpis: 'Números principais',
  funnel: 'Situação dos alunos',
  agenda: 'Agenda de quem está em habilitação',
  instructors: 'Por instrutor',
  movement: 'Movimento do período',
  exams: 'Exames e saldo de aulas',
  categories: 'Categorias',
  partners: 'Por autoescola',
} as const
export type PanelKey = keyof typeof PANELS
export const PANEL_KEYS = Object.keys(PANELS) as PanelKey[]
export const DEFAULT_PANELS: PanelKey[] = ['kpis', 'funnel', 'agenda', 'instructors', 'movement']

export const SORTS: Array<[string, string]> = [
  ['name', 'Nome'],
  ['idle_days', 'Tempo parado'],
  ['next_lesson_at', 'Próxima aula'],
  ['last_lesson_at', 'Última aula'],
  ['available_minutes', 'Saldo de aulas'],
  ['created_at', 'Data de cadastro'],
]

// Preferência de tela guardada no navegador; se o armazenamento falhar, vale o padrão
export function usePersistedList<T extends string>(storageKey: string, all: readonly T[], fallback: readonly T[]) {
  const [list, setList] = useState<T[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if (Array.isArray(parsed)) return all.filter((item) => parsed.includes(item))
    } catch {
      /* usa o padrão */
    }
    return [...fallback]
  })
  const update = (next: T[]) => {
    setList(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      /* sem armazenamento: a escolha vale só nesta visita */
    }
  }
  return [list, update] as const
}

export const splitList = (value: string | undefined) => (value ? value.split(',').filter(Boolean) : [])
export const toggleItem = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
export const percent = (value: number | null) => (value === null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
