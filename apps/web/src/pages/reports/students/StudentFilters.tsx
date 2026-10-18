import { useState } from 'react'
import { Badge, Button, Col, Dropdown, Form, Row } from 'react-bootstrap'
import { LICENSE_CATEGORIES } from '../../../config/domain'
import { AGENDA, ARCHIVE, FOCUS_KEYS, IDLE_OPTIONS, PANEL_KEYS, PANELS, PRESETS, SITUATION, splitList, STALL, toggleItem, type Focus, type PanelKey } from './config'

export type Option = { value: string; label: string }

type Props = {
  values: Record<string, string>
  set: (key: string, value: string) => void
  setMany: (patch: Record<string, string>) => void
  onFocus: (focus: Focus) => void
  text: string
  setText: (text: string) => void
  instructors: Option[]
  partners: Option[]
  independent: boolean
  panels: PanelKey[]
  setPanels: (panels: PanelKey[]) => void
}

function CheckGroup({ legend, options, selected, onChange }: { legend: string; options: Option[]; selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <fieldset>
      <legend className="small fw-semibold mb-1">{legend}</legend>
      {options.map((o) => (
        <Form.Check key={o.value} type="checkbox" id={`flt-${legend}-${o.value}`} label={o.label} checked={selected.includes(o.value)} onChange={() => onChange(toggleItem(selected, o.value))} />
      ))}
    </fieldset>
  )
}

const entries = <T extends string>(map: Record<T, { label: string }>): Option[] => (Object.entries(map) as Array<[T, { label: string }]>).map(([value, { label }]) => ({ value, label }))

// Vista rápida (um clique) + filtros avançados + escolha do que mostrar
export function StudentFilters({ values, set, setMany, onFocus, text, setText, instructors, partners, independent, panels, setPanels }: Props) {
  const [open, setOpen] = useState(false)
  const current: Focus = Object.fromEntries(FOCUS_KEYS.map((k) => [k, values[k] ?? '']))
  const activePreset = PRESETS.find((p) => FOCUS_KEYS.every((k) => (current[k] ?? '') === (p.focus[k] ?? '')))?.id

  const chips = activeChips(values, text, instructors, partners)
  const advancedCount = chips.filter((c) => c.advanced).length
  const clearAll = () => {
    setText('')
    setMany(Object.fromEntries(['sit', 'agenda', 'motivo', 'arquivar', 'exame', 'parado', 'instrutor', 'categoria', 'parceiro', 'ordem', 'dir'].map((k) => [k, ''])))
  }

  return (
    <section aria-label="Filtros dos alunos" className="mb-3">
      <div className="d-flex flex-wrap gap-2 mb-2" role="group" aria-label="Vistas rápidas">
        {PRESETS.map((p) => (
          <Button key={p.id} size="sm" variant={activePreset === p.id ? 'primary' : 'outline-secondary'} aria-pressed={activePreset === p.id} onClick={() => onFocus(p.focus)}>
            <i className={`bi ${p.icon} me-1`} aria-hidden="true" />
            {p.label}
          </Button>
        ))}
      </div>

      <div className="d-flex flex-wrap align-items-end gap-2">
        <Form.Group controlId="students-search" className="flex-grow-1 form-narrow">
          <Form.Label className="visually-hidden">Buscar aluno por nome</Form.Label>
          <Form.Control type="search" placeholder="Buscar aluno por nome" value={text} onChange={(event) => setText(event.target.value)} />
        </Form.Group>
        <Button variant={open ? 'secondary' : 'outline-secondary'} aria-expanded={open} aria-controls="students-advanced" onClick={() => setOpen(!open)}>
          <i className="bi bi-funnel me-1" aria-hidden="true" />
          Filtros
          {advancedCount > 0 && <Badge bg="primary" className="ms-2">{advancedCount}</Badge>}
        </Button>
        <Dropdown align="end" autoClose="outside">
          <Dropdown.Toggle variant="outline-secondary" id="students-panels">
            <i className="bi bi-layout-text-window me-1" aria-hidden="true" />
            O que mostrar
          </Dropdown.Toggle>
          <Dropdown.Menu className="p-3" style={{ minWidth: '18rem' }}>
            <p className="small text-secondary mb-2">Escolha os blocos do resumo. Sua escolha fica salva neste navegador.</p>
            {PANEL_KEYS.filter((k) => independent || k !== 'partners').map((k) => (
              <Form.Check key={k} type="switch" id={`panel-${k}`} label={PANELS[k]} checked={panels.includes(k)} onChange={() => setPanels(PANEL_KEYS.filter((x) => (x === k ? !panels.includes(k) : panels.includes(x))))} />
            ))}
          </Dropdown.Menu>
        </Dropdown>
      </div>

      {open && (
        <div id="students-advanced" className="border rounded p-3 mt-2 bg-body">
          <Row className="g-3">
            <Col xs={6} md={3}>
              <CheckGroup legend="Situação" options={entries(SITUATION)} selected={splitList(values.sit)} onChange={(next) => set('sit', next.join(','))} />
            </Col>
            <Col xs={6} md={3}>
              <CheckGroup legend="Agenda" options={entries(AGENDA)} selected={splitList(values.agenda)} onChange={(next) => set('agenda', next.join(','))} />
              <div className="mt-3">
                <CheckGroup legend="Por que está parado" options={entries(STALL)} selected={splitList(values.motivo)} onChange={(next) => set('motivo', next.join(','))} />
              </div>
            </Col>
            <Col xs={12} md={3}>
              <CheckGroup legend="Instrutor responsável" options={[...instructors, { value: 'none', label: 'Sem instrutor' }]} selected={splitList(values.instrutor)} onChange={(next) => set('instrutor', next.join(','))} />
            </Col>
            <Col xs={12} md={3}>
              <Form.Label htmlFor="flt-category" className="small fw-semibold mb-1">Categoria</Form.Label>
              <Form.Select id="flt-category" size="sm" value={values.categoria} onChange={(event) => set('categoria', event.target.value)}>
                <option value="">Todas</option>
                {LICENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Form.Select>
              <Form.Label htmlFor="flt-idle" className="small fw-semibold mb-1 mt-3">Sem aula há</Form.Label>
              <Form.Select id="flt-idle" size="sm" value={values.parado} onChange={(event) => set('parado', event.target.value)}>
                <option value="">Qualquer tempo</option>
                {IDLE_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} dias ou mais</option>
                ))}
              </Form.Select>
              <Form.Label htmlFor="flt-archive" className="small fw-semibold mb-1 mt-3">Arquivamento</Form.Label>
              <Form.Select id="flt-archive" size="sm" value={values.arquivar} onChange={(event) => set('arquivar', event.target.value)}>
                <option value="">Todos</option>
                <option value="ready">{ARCHIVE.ready.label}</option>
                <option value="blocked">Quase: falta encerrar matrícula ou agenda</option>
              </Form.Select>
              <Form.Label htmlFor="flt-exam" className="small fw-semibold mb-1 mt-3">Exame</Form.Label>
              <Form.Select id="flt-exam" size="sm" value={values.exame} onChange={(event) => set('exame', event.target.value)}>
                <option value="">Todos</option>
                <option value="scheduled">Com exame agendado</option>
                <option value="retry">Para refazer o exame</option>
              </Form.Select>
              {independent && partners.length > 0 && (
                <div className="mt-3">
                  <CheckGroup legend="Autoescola" options={[{ value: 'space', label: 'Próprio espaço' }, ...partners]} selected={splitList(values.parceiro)} onChange={(next) => set('parceiro', next.join(','))} />
                </div>
              )}
            </Col>
          </Row>
        </div>
      )}

      {chips.length > 0 && (
        <div className="d-flex flex-wrap align-items-center gap-2 mt-2" aria-label="Filtros ativos">
          <span className="small text-secondary">Filtrando por:</span>
          {chips.map((c) => (
            <Button key={c.id} size="sm" variant="outline-primary" className="rounded-pill" onClick={() => c.remove(set, setText)} aria-label={`Remover filtro ${c.label}`}>
              {c.label}
              <i className="bi bi-x-lg ms-2" aria-hidden="true" />
            </Button>
          ))}
          <Button size="sm" variant="link" onClick={clearAll}>Limpar tudo</Button>
        </div>
      )}
    </section>
  )
}

type Chip = { id: string; label: string; advanced: boolean; remove: (set: (k: string, v: string) => void, setText: (t: string) => void) => void }

function activeChips(values: Record<string, string>, text: string, instructors: Option[], partners: Option[]): Chip[] {
  const out: Chip[] = []
  const lists: Array<[string, string, (v: string) => string]> = [
    ['sit', 'Situação', (v) => SITUATION[v as keyof typeof SITUATION]?.label ?? v],
    ['agenda', 'Agenda', (v) => AGENDA[v as keyof typeof AGENDA]?.label ?? v],
    ['motivo', 'Parado por', (v) => STALL[v as keyof typeof STALL]?.label ?? v],
    ['instrutor', 'Instrutor', (v) => (v === 'none' ? 'Sem instrutor' : (instructors.find((i) => i.value === v)?.label ?? `#${v}`))],
    ['parceiro', 'Autoescola', (v) => (v === 'space' ? 'Próprio espaço' : (partners.find((p) => p.value === v)?.label ?? `#${v}`))],
  ]
  for (const [key, title, name] of lists) {
    for (const v of splitList(values[key])) {
      out.push({ id: `${key}-${v}`, label: `${title}: ${name(v)}`, advanced: true, remove: (set) => set(key, splitList(values[key]).filter((x) => x !== v).join(',')) })
    }
  }
  if (values.categoria) out.push({ id: 'cat', label: `Categoria ${values.categoria}`, advanced: true, remove: (set) => set('categoria', '') })
  if (values.parado) out.push({ id: 'idle', label: `Sem aula há ${values.parado}+ dias`, advanced: true, remove: (set) => set('parado', '') })
  if (values.arquivar) out.push({ id: 'arch', label: values.arquivar === 'ready' ? 'Podem arquivar' : 'Quase podem arquivar', advanced: true, remove: (set) => set('arquivar', '') })
  if (values.exame) out.push({ id: 'exam', label: values.exame === 'retry' ? 'Exame para refazer' : 'Com exame agendado', advanced: true, remove: (set) => set('exame', '') })
  if (text.trim()) out.push({ id: 'q', label: `Nome: “${text.trim()}”`, advanced: false, remove: (_set, setText) => setText('') })
  return out
}
