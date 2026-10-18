import { Alert, Button, Dropdown, Form } from 'react-bootstrap'
import { Pagination } from '../../../components/Pagination'
import { QueryState } from '../../../components/QueryState'
import { useInstructors } from '../../../hooks/useInstructors'
import { usePartners } from '../../../hooks/usePartners'
import { useExportReport, useStudentsDetail, useStudentsReport } from '../../../hooks/useReports'
import { useUrlSearch } from '../../../hooks/useUrlFilters'
import type { Organization } from '../../../types/organization'
import { COLUMN_KEYS, COLUMNS, DEFAULT_COLUMNS, DEFAULT_PANELS, FOCUS_KEYS, PANEL_KEYS, percent, SORTS, splitList, toggleItem, usePersistedList, type ColumnKey, type Focus, type PanelKey } from './config'
import { StudentFilters } from './StudentFilters'
import { StudentsTable } from './StudentsTable'
import { SummaryPanels } from './SummaryPanels'

const PER_PAGE = 15

type Props = {
  organization: Organization
  values: Record<string, string>
  set: (key: string, value: string) => void
  setMany: (patch: Record<string, string>) => void
  page: number
  setPage: (page: number) => void
  from: string
  to: string
}

// Relatório de alunos: resumo em cima, alunos um a um embaixo. Tudo (resumo, lista e CSV) usa os mesmos filtros.
export function StudentsTab({ organization, values, set, setMany, page, setPage, from, to }: Props) {
  const independent = organization.type === 'independent'
  const [text, setText, search] = useUrlSearch()
  const [panels, setPanels] = usePersistedList<PanelKey>('reports.students.panels', PANEL_KEYS, DEFAULT_PANELS)
  const [columns, setColumns] = usePersistedList<ColumnKey>('reports.students.columns', COLUMN_KEYS, DEFAULT_COLUMNS)

  const instructorsQuery = useInstructors(organization.id, { page: 1, all: true })
  const partnersQuery = usePartners(organization.id, { page: 1, all: true }, independent)
  const instructors = (instructorsQuery.data?.data ?? []).map((i) => ({ value: String(i.id), label: i.full_name }))
  const partners = (partnersQuery.data?.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))

  const filters = {
    from,
    to,
    search,
    situation: values.sit,
    agenda: values.agenda,
    stall: values.motivo,
    instructor: values.instrutor,
    partner: values.parceiro,
    category: values.categoria,
    archive: values.arquivar,
    exam: values.exame,
    idle_days: values.parado,
  }
  const sort = values.ordem || 'name'
  const dir = values.dir === 'desc' ? 'desc' : 'asc'

  const summary = useStudentsReport(organization.id, filters)
  const detail = useStudentsDetail(organization.id, { ...filters, sort, dir, page, per_page: PER_PAGE })
  const exportCsv = useExportReport(organization.id, 'students')
  const rangeInvalid = from !== '' && to !== '' && to < from

  // Uma vista rápida troca situação/agenda/motivo etc., mas mantém instrutor, categoria e busca
  const focus = (next: Focus) => setMany(Object.fromEntries(FOCUS_KEYS.map((k) => [k, next[k] ?? ''])))
  const selectedInstructors = splitList(values.instrutor)
  const toggleInstructor = (key: string) => set('instrutor', toggleItem(selectedInstructors, key).join(','))

  return (
    <>
      <StudentFilters
        values={values}
        set={set}
        setMany={setMany}
        onFocus={focus}
        text={text}
        setText={setText}
        instructors={instructors}
        partners={partners}
        independent={independent}
        panels={panels}
        setPanels={setPanels}
      />

      {rangeInvalid ? (
        <Alert variant="warning">A data final do período não pode ser anterior à inicial.</Alert>
      ) : (
        <>
          <QueryState query={summary} isEmpty={() => false} empty={null}>
            {(data) => (
              <>
                {selectedInstructors.length > 0 && (
                  <Alert variant="primary" className="d-flex flex-wrap align-items-center gap-2">
                    <i className="bi bi-people-fill" aria-hidden="true" />
                    <span>
                      <strong>{selectedInstructors.length === 1 ? 'O instrutor selecionado' : `Os ${selectedInstructors.length} instrutores juntos`}</strong> têm {data.totals.count} {data.totals.count === 1 ? 'aluno' : 'alunos'} ={' '}
                      <strong>{percent(data.share.students)}</strong> do total · <strong>{percent(data.share.in_progress)}</strong> de quem está em habilitação · {data.totals.with_lesson} de {data.overview.with_lesson} com aula agendada
                      {data.share.with_lesson !== null && <> (<strong>{percent(data.share.with_lesson)}</strong>)</>}.
                    </span>
                    <Button size="sm" variant="outline-primary" className="ms-auto" onClick={() => set('instrutor', '')}>
                      Ver todos os instrutores
                    </Button>
                  </Alert>
                )}
                <SummaryPanels
                  data={data}
                  panels={panels}
                  focus={Object.fromEntries(FOCUS_KEYS.map((k) => [k, values[k] ?? '']))}
                  onFocus={focus}
                  selectedInstructors={selectedInstructors}
                  onToggleInstructor={toggleInstructor}
                  onCategory={(category) => set('categoria', category)}
                  onPartner={(key) => set('parceiro', key)}
                  independent={independent}
                  period={{ timezone: organization.timezone, from, to, onChange: (start, end) => setMany({ de: start, ate: end }) }}
                />
                <p className="small text-secondary">{data.basis}</p>
              </>
            )}
          </QueryState>

          <section aria-labelledby="students-detail-title" className="mt-4">
            <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-2">
              <h2 id="students-detail-title" className="h5 mb-0">
                Alunos{detail.data ? ` (${detail.data.meta.total})` : ''}
              </h2>
              <div className="d-flex flex-wrap align-items-end gap-2">
                <Form.Group controlId="students-sort">
                  <Form.Label className="small mb-1">Ordenar por</Form.Label>
                  <div className="d-flex gap-1">
                    <Form.Select size="sm" value={sort} onChange={(event) => set('ordem', event.target.value === 'name' ? '' : event.target.value)}>
                      {SORTS.map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </Form.Select>
                    <Button size="sm" variant="outline-secondary" onClick={() => set('dir', dir === 'asc' ? 'desc' : '')} aria-label={dir === 'asc' ? 'Ordem crescente. Trocar para decrescente' : 'Ordem decrescente. Trocar para crescente'}>
                      <i className={`bi ${dir === 'asc' ? 'bi-sort-up' : 'bi-sort-down'}`} aria-hidden="true" />
                    </Button>
                  </div>
                </Form.Group>
                <Dropdown align="end" autoClose="outside">
                  <Dropdown.Toggle size="sm" variant="outline-secondary" id="students-columns">
                    <i className="bi bi-layout-three-columns me-1" aria-hidden="true" />
                    Colunas
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="p-3">
                    {COLUMN_KEYS.filter((k) => independent || k !== 'partner').map((k) => (
                      <Form.Check key={k} type="checkbox" id={`col-${k}`} label={COLUMNS[k]} checked={columns.includes(k)} onChange={() => setColumns(COLUMN_KEYS.filter((x) => (x === k ? !columns.includes(k) : columns.includes(x))))} />
                    ))}
                    <Button size="sm" variant="link" className="px-0 mt-2" onClick={() => setColumns([...DEFAULT_COLUMNS])}>Voltar ao padrão</Button>
                  </Dropdown.Menu>
                </Dropdown>
                <Button size="sm" variant="outline-secondary" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate({ ...filters, sort, dir })}>
                  <i className="bi bi-filetype-csv me-1" aria-hidden="true" />
                  Exportar CSV
                </Button>
              </div>
            </div>
            <QueryState query={detail} isEmpty={(d) => d.data.length === 0} empty="Nenhum aluno com esses filtros. Tire um filtro ou escolha “Todos”.">
              {(data) => (
                <>
                  <p className="small text-secondary">Clique em um aluno para abrir a ficha. A exportação traz exatamente esta lista, com todas as colunas.</p>
                  <StudentsTable rows={data.data} organization={organization} columns={columns} />
                  <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PER_PAGE} onPageChange={setPage} />
                </>
              )}
            </QueryState>
          </section>
        </>
      )}
    </>
  )
}
