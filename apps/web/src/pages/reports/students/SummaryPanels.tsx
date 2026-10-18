import type { ReactNode } from 'react'
import { Button, Col, Row } from 'react-bootstrap'
import { DataTable } from '../../../components/DataTable'
import type { StudentAgenda, StudentSituation, StudentsReport, StudentStall } from '../../../types/reports'
import { PeriodFilter } from '../ReportFilters'
import { AGENDA, FOCUS_KEYS, IDLE_LABELS, percent, SITUATION, STALL, type Focus, type PanelKey } from './config'
import { StackBar } from './StackBar'

type Props = {
  data: StudentsReport
  panels: PanelKey[]
  focus: Focus
  onFocus: (focus: Focus) => void
  selectedInstructors: string[]
  onToggleInstructor: (key: string) => void
  onCategory: (category: string) => void
  onPartner: (key: string) => void
  independent: boolean
  period: { timezone: string; from: string; to: string; onChange: (from: string, to: string) => void }
}

const sameFocus = (current: Focus, wanted: Focus) => FOCUS_KEYS.every((key) => (current[key] ?? '') === (wanted[key] ?? ''))
const ratio = (part: number, whole: number) => (whole > 0 ? percent(Math.round((part / whole) * 1000) / 10) : '—')

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border rounded p-3 h-100 bg-body">
      <h2 className="h6 mb-1">{title}</h2>
      {hint && <p className="small text-secondary mb-3">{hint}</p>}
      {!hint && <div className="mb-2" />}
      {children}
    </section>
  )
}

function Kpi({ label, value, sub, extra, tone, active, onClick }: { label: string; value: number; sub: string; extra?: string; tone?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-100 h-100 text-start border rounded p-3 bg-body ${active ? 'border-primary border-2' : ''}`}
      style={{ cursor: 'pointer' }}
    >
      <div className="small text-secondary">{label}</div>
      <div className={`fs-2 fw-semibold tabular-nums lh-1 my-1 ${tone ? `text-${tone}` : ''}`}>{value}</div>
      <div className="small text-secondary">{sub}</div>
      {extra && <div className="small fw-semibold text-primary-emphasis mt-1">{extra}</div>}
    </button>
  )
}

export function SummaryPanels({ data, panels, focus, onFocus, selectedInstructors, onToggleInstructor, onCategory, onPartner, independent, period }: Props) {
  const show = (key: PanelKey) => panels.includes(key)
  const t = data.totals
  const o = data.overview
  const filtered = data.filtered
  const of = (value: number | null) => (filtered ? `= ${percent(value)} do total` : undefined)

  const stallCounts = data.stall.filter((s) => s.count > 0)
  const hasInstructors = data.instructors.length > 1 || selectedInstructors.length > 0

  return (
    <>
      {show('kpis') && (
        <Row className="g-3 mb-3" as="section" aria-label="Números principais">
          <Col xs={6} md={4} xl={2}>
            <Kpi label="Alunos" value={t.count} sub={`${o.archived} arquivados no espaço`} extra={of(data.share.students)} active={sameFocus(focus, {})} onClick={() => onFocus({})} />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <Kpi label="Em habilitação" value={t.in_progress} sub={`${ratio(t.in_progress, t.count)} dos alunos`} extra={of(data.share.in_progress)} active={sameFocus(focus, { sit: 'in_progress' })} onClick={() => onFocus({ sit: 'in_progress' })} />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <Kpi label="Com aula agendada" value={t.with_lesson} sub={`${ratio(t.with_lesson, t.in_progress)} de quem está em habilitação`} extra={of(data.share.with_lesson)} tone="success" active={sameFocus(focus, { sit: 'in_progress', agenda: 'with_lesson' })} onClick={() => onFocus({ sit: 'in_progress', agenda: 'with_lesson' })} />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <Kpi label="Sem nada agendado" value={t.no_schedule} sub={`${ratio(t.no_schedule, t.in_progress)} de quem está em habilitação`} extra={of(data.share.no_schedule)} tone={t.no_schedule > 0 ? 'warning-emphasis' : undefined} active={sameFocus(focus, { sit: 'in_progress', agenda: 'no_schedule' })} onClick={() => onFocus({ sit: 'in_progress', agenda: 'no_schedule' })} />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <Kpi label="Habilitados" value={t.qualified} sub={`${data.movement.qualified} no período`} extra={of(data.share.qualified)} active={sameFocus(focus, { sit: 'qualified' })} onClick={() => onFocus({ sit: 'qualified' })} />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <Kpi label="Podem arquivar" value={t.archive_ready} sub={t.archive_blocked > 0 ? `+${t.archive_blocked} quase, falta encerrar` : 'prontos para sair da operação'} extra={of(data.share.archive_ready)} active={sameFocus(focus, { arquivar: 'ready' })} onClick={() => onFocus({ arquivar: 'ready' })} />
          </Col>
        </Row>
      )}

      {show('funnel') && (
        <div className="mb-3">
          <Panel title="Situação dos alunos" hint="Cada aluno aparece em uma única situação. Clique para ver só os alunos dela.">
            <StackBar
              ariaLabel="Alunos por situação"
              activeKey={focus.sit}
              onPick={(key) => onFocus({ sit: key })}
              segments={data.situations.filter((s) => s.key !== 'archived' || s.count > 0).map((s) => ({ key: s.key, label: SITUATION[s.key as StudentSituation].label, count: s.count, bg: SITUATION[s.key as StudentSituation].bg }))}
            />
          </Panel>
        </div>
      )}

      <Row className="g-3 mb-3">
        {show('agenda') && (
          <Col xs={12} xl={show('instructors') && hasInstructors ? 5 : 12}>
            <Panel title="Agenda de quem está em habilitação" hint="Quem tem aula marcada e quem está parado, e por quê.">
              {t.in_progress === 0 ? (
                <p className="text-secondary mb-0">Ninguém em habilitação neste recorte.</p>
              ) : (
                <>
                  <StackBar
                    ariaLabel="Agenda dos alunos em habilitação"
                    activeKey={focus.agenda}
                    onPick={(key) => onFocus({ sit: 'in_progress', agenda: key })}
                    segments={data.agenda.map((a) => ({ key: a.key, label: AGENDA[a.key as StudentAgenda].label, count: a.count, bg: AGENDA[a.key as StudentAgenda].bg }))}
                  />
                  {stallCounts.length > 0 && (
                    <div className="mt-3">
                      <h3 className="small fw-semibold mb-2">Por que {t.no_schedule === 1 ? 'está parado' : 'estão parados'}?</h3>
                      <ul className="list-unstyled mb-0">
                        {stallCounts.map((s) => {
                          const info = STALL[s.key as StudentStall]
                          return (
                            <li key={s.key} className="d-flex align-items-center gap-2 py-1 border-top">
                              <span className="flex-grow-1">
                                <span className="fw-semibold">{info.label}</span>
                                <span className="d-block small text-secondary">{info.action}</span>
                              </span>
                              <span className="tabular-nums fw-semibold">{s.count}</span>
                              <Button size="sm" variant="outline-primary" onClick={() => onFocus({ sit: 'in_progress', agenda: 'no_schedule', motivo: s.key })}>
                                Ver
                              </Button>
                            </li>
                          )
                        })}
                      </ul>
                      <h3 className="small fw-semibold mt-3 mb-2">Parados há</h3>
                      <div className="d-flex flex-wrap gap-2">
                        {data.idle.map((b) => (
                          <Button key={b.key} size="sm" variant={focus.parado === b.key.slice(1) ? 'secondary' : 'outline-secondary'} disabled={b.count === 0} onClick={() => onFocus({ sit: 'in_progress', agenda: 'no_schedule', parado: b.key.slice(1) })}>
                            {IDLE_LABELS[b.key]} <strong className="tabular-nums ms-1">{b.count}</strong>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Panel>
          </Col>
        )}

        {show('instructors') && hasInstructors && (
          <Col xs={12} xl={show('agenda') ? 7 : 12}>
            <Panel title="Por instrutor" hint="Marque um ou mais instrutores para juntar os alunos deles. O resumo e a lista passam a mostrar só essa seleção.">
              <DataTable
                rows={data.instructors}
                getKey={(r) => r.key}
                selection={{
                  selected: new Set(selectedInstructors),
                  label: (r) => `Juntar ${r.name} à seleção`,
                  onToggle: (r) => onToggleInstructor(r.key),
                }}
                columns={[
                  { header: 'Instrutor', primary: true, cell: (r) => <span className={r.id === null ? 'text-secondary' : 'fw-semibold'}>{r.name}</span> },
                  { header: 'Alunos', cell: (r) => <span className="tabular-nums">{r.students} <span className="text-secondary">({percent(r.share_students)})</span></span> },
                  { header: 'Em habilitação', cell: (r) => <span className="tabular-nums">{r.in_progress}</span> },
                  { header: 'Com aula', cell: (r) => <span className="tabular-nums">{r.with_lesson}</span> },
                  { header: 'Sem agenda', cell: (r) => <span className={`tabular-nums ${r.no_schedule > 0 ? 'text-warning-emphasis fw-semibold' : ''}`}>{r.no_schedule}</span> },
                  { header: 'Habilitados', cell: (r) => <span className="tabular-nums">{r.qualified}</span> },
                  { header: 'Podem arquivar', cell: (r) => <span className="tabular-nums">{r.archive_ready}</span> },
                ]}
              />
            </Panel>
          </Col>
        )}
      </Row>

      <Row className="g-3 mb-3">
        {show('movement') && (
          <Col xs={12} lg={6}>
            <Panel title="Movimento do período" hint="Entradas e saídas de alunos no período escolhido (não muda a lista abaixo).">
              <PeriodFilter timezone={period.timezone} from={period.from} to={period.to} onChange={period.onChange} />
              <Row className="g-2 text-center">
                {[
                  ['Novos cadastros', data.movement.new],
                  ['Habilitados', data.movement.qualified],
                  ['Arquivados', data.movement.archived],
                ].map(([label, value]) => (
                  <Col key={label} xs={4}>
                    <div className="border rounded p-2">
                      <div className="fs-4 fw-semibold tabular-nums">{value}</div>
                      <div className="small text-secondary">{label}</div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Panel>
          </Col>
        )}

        {show('exams') && (
          <Col xs={12} lg={6}>
            <Panel title="Exames e saldo de aulas" hint="Só de quem está em habilitação.">
              <Row className="g-2 mb-3">
                <Col xs={6}>
                  <div className="border rounded p-2 h-100">
                    <div className="fs-4 fw-semibold tabular-nums">{data.exams.scheduled}</div>
                    <div className="small text-secondary">com exame agendado</div>
                  </div>
                </Col>
                <Col xs={6}>
                  <button type="button" className="w-100 h-100 text-start border rounded p-2 bg-body" disabled={data.exams.retry === 0} onClick={() => onFocus({ exame: 'retry' })}>
                    <div className="fs-4 fw-semibold tabular-nums">{data.exams.retry}</div>
                    <div className="small text-secondary">para refazer o exame</div>
                  </button>
                </Col>
              </Row>
              <StackBar
                ariaLabel="Saldo de aulas"
                segments={[
                  { key: 'exhausted', label: 'Saldo esgotado', bg: 'danger' },
                  { key: 'low', label: 'Saldo baixo', bg: 'warning' },
                  { key: 'ok', label: 'Saldo ok', bg: 'success' },
                  { key: 'none', label: 'Sem pacote', bg: 'secondary' },
                ].map((s) => ({ ...s, count: data.balance.find((b) => b.key === s.key)?.count ?? 0 }))}
              />
            </Panel>
          </Col>
        )}

        {show('categories') && (
          <Col xs={12} lg={6}>
            <Panel title="Categorias" hint="Alunos por categoria da matrícula. Clique para filtrar.">
              {data.categories.length === 0 ? (
                <p className="text-secondary mb-0">Nenhuma matrícula neste recorte.</p>
              ) : (
                <div className="d-flex flex-wrap gap-2">
                  {data.categories.map((c) => (
                    <Button key={c.key} size="sm" variant="outline-secondary" onClick={() => onCategory(c.key)}>
                      {c.key} <strong className="tabular-nums ms-1">{c.count}</strong>
                    </Button>
                  ))}
                </div>
              )}
            </Panel>
          </Col>
        )}

        {show('partners') && independent && (
          <Col xs={12} lg={6}>
            <Panel title="Por autoescola" hint="A autoescola de cada aluno. Clique para filtrar.">
              {data.partners.length === 0 ? (
                <p className="text-secondary mb-0">Nenhum aluno neste recorte.</p>
              ) : (
                <DataTable
                  rows={data.partners}
                  getKey={(r) => r.key}
                  columns={[
                    { header: 'Autoescola', primary: true, cell: (r) => r.name },
                    { header: 'Alunos', cell: (r) => <span className="tabular-nums">{r.students}</span> },
                    { header: 'Em habilitação', cell: (r) => <span className="tabular-nums">{r.in_progress}</span> },
                    { header: 'Sem agenda', cell: (r) => <span className="tabular-nums">{r.no_schedule}</span> },
                    { header: 'Ver', actions: true, cell: (r) => <Button size="sm" variant="outline-primary" onClick={() => onPartner(r.key)}>Ver alunos</Button> },
                  ]}
                />
              )}
            </Panel>
          </Col>
        )}
      </Row>
    </>
  )
}
