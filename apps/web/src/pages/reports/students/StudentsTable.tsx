import { Badge } from 'react-bootstrap'
import { DataTable, type Column } from '../../../components/DataTable'
import { organizationPaths } from '../../../config/paths'
import type { Organization } from '../../../types/organization'
import type { StudentReportRow } from '../../../types/reports'
import { formatDate } from '../../../utils/formatDate'
import { formatDateTime } from '../../../utils/formatDateTime'
import { formatMinutes } from '../../../utils/formatMinutes'
import { AGENDA, ARCHIVE, BALANCE, INSTRUCTOR_SOURCE, SITUATION, STALL, type ColumnKey } from './config'

const dash = <span className="text-secondary">—</span>

export function StudentsTable({ rows, organization, columns }: { rows: StudentReportRow[]; organization: Organization; columns: ColumnKey[] }) {
  const links = organizationPaths(organization.id)
  const tz = organization.timezone

  const all: Record<ColumnKey, Column<StudentReportRow>> = {
    situation: { header: 'Situação', cell: (r) => <Badge bg={SITUATION[r.situation].bg}>{SITUATION[r.situation].label}</Badge> },
    agenda: {
      header: 'Agenda',
      cell: (r) =>
        r.agenda ? (
          <>
            <Badge bg={AGENDA[r.agenda].bg} text={AGENDA[r.agenda].bg === 'warning' ? 'dark' : undefined}>{AGENDA[r.agenda].label}</Badge>
            {r.stall && <div className="small text-secondary mt-1">{STALL[r.stall].label}</div>}
          </>
        ) : (
          dash
        ),
    },
    instructor: {
      header: 'Instrutor',
      cell: (r) => (r.instructor ? <span title={r.instructor_source ? INSTRUCTOR_SOURCE[r.instructor_source] : undefined}>{r.instructor}</span> : <span className="text-secondary">Sem instrutor</span>),
    },
    categories: { header: 'Categoria', cell: (r) => (r.categories.length ? r.categories.join(', ') : dash) },
    next_lesson: { header: 'Próxima aula', cell: (r) => (r.next_lesson_at ? <span className="tabular-nums">{formatDateTime(r.next_lesson_at, tz)}</span> : dash) },
    last_lesson: { header: 'Última aula', cell: (r) => (r.last_lesson_at ? <span className="tabular-nums">{formatDate(r.last_lesson_at, tz)}</span> : dash) },
    idle: {
      header: 'Parado há',
      cell: (r) => (r.idle_days === null ? dash : <span className={`tabular-nums ${r.idle_days >= 15 ? 'text-warning-emphasis fw-semibold' : ''}`}>{r.idle_days === 0 ? 'Hoje' : `${r.idle_days} ${r.idle_days === 1 ? 'dia' : 'dias'}`}</span>),
    },
    lessons: {
      header: 'Aulas feitas',
      cell: (r) => (r.completed_lessons + r.missed_lessons === 0 ? dash : <span className="tabular-nums">{r.completed_lessons} <span className="text-secondary">· {r.missed_lessons} {r.missed_lessons === 1 ? 'falta' : 'faltas'}</span></span>),
    },
    balance: {
      header: 'Saldo',
      cell: (r) =>
        r.balance_state === null ? (
          dash
        ) : r.available_minutes === null ? (
          <Badge bg={BALANCE.none.bg}>{BALANCE.none.label}</Badge>
        ) : (
          <>
            <span className="tabular-nums me-2">{formatMinutes(Math.max(0, r.available_minutes))}</span>
            {(r.balance_state === 'exhausted' || r.balance_state === 'low') && <Badge bg={BALANCE[r.balance_state].bg} text={r.balance_state === 'low' ? 'dark' : undefined}>{BALANCE[r.balance_state].label}</Badge>}
          </>
        ),
    },
    exam: {
      header: 'Exame',
      cell: (r) => (r.next_exam_at ? <span className="tabular-nums">{formatDateTime(r.next_exam_at, tz)}</span> : r.exam_retry ? <Badge bg="warning" text="dark">Refazer</Badge> : dash),
    },
    archive: {
      header: 'Arquivamento',
      cell: (r) => (r.archive ? <Badge bg={ARCHIVE[r.archive].bg} text={ARCHIVE[r.archive].bg === 'warning' ? 'dark' : undefined} title={ARCHIVE[r.archive].hint}>{ARCHIVE[r.archive].label}</Badge> : dash),
    },
    partner: { header: 'Autoescola', cell: (r) => r.partner ?? 'Próprio espaço' },
    created: { header: 'Cadastro', cell: (r) => <span className="tabular-nums">{formatDate(r.created_at, tz)}</span> },
  }

  const primary: Column<StudentReportRow> = {
    header: 'Aluno',
    primary: true,
    cell: (r) => (
      <>
        <span className="fw-semibold">{r.name}</span>
        {r.phone && <div className="small text-secondary tabular-nums">{r.phone}</div>}
      </>
    ),
  }

  return (
    <DataTable
      rows={rows}
      getKey={(r) => r.id}
      open={{ to: (r) => links.student(r.id), label: (r) => `Abrir ficha de ${r.name}` }}
      columns={[primary, ...columns.map((key) => all[key])]}
    />
  )
}
