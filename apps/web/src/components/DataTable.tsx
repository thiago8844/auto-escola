import { useState, type MouseEvent, type ReactNode } from 'react'
import { Card, Form, Table } from 'react-bootstrap'

export type Column<T> = {
  header: string
  // `mobile` é verdadeiro na versão em cartões (use para botões e campos em tamanho confortável ao toque)
  cell: (row: T, ctx: { mobile: boolean }) => ReactNode
  // Vira o título do cartão no mobile (a primeira coluna, se nenhuma for marcada)
  primary?: boolean
  // Coluna de ações: alinhada à direita na tabela e no rodapé do cartão
  actions?: boolean
}

type Key = string | number

// Seleção por linha (ex.: concluir várias de uma vez). Só linhas com `canSelect` ganham checkbox
export type TableSelection<T> = {
  selected: ReadonlySet<Key>
  canSelect?: (row: T) => boolean
  onToggle: (row: T) => void
}

// Detalhes expansíveis. Na tabela, abre por botão (coluna de ações); no celular, tocar no cartão também abre
export type TableExpansion<T> = {
  isOpen: (row: T) => boolean
  onToggle: (row: T) => void
  render: (row: T) => ReactNode
}

// Padrão das listagens de cadastros: tocar em qualquer parte da linha abre um resumo logo abaixo
// (com o botão que leva à ficha completa). A seta no fim da linha indica que ela abre
export type TablePreview<T> = {
  render: (row: T) => ReactNode
  // Nome do registro, usado no rótulo acessível da seta (ex.: "Maria")
  label: (row: T) => string
}

type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  getKey: (row: T) => Key
  selection?: TableSelection<T>
  expansion?: TableExpansion<T>
  preview?: TablePreview<T>
}

// Clique em controle interno (botão, link, campo) não deve abrir o cartão
const INTERACTIVE = 'button, a, input, select, textarea, label'

// Tabela a partir de 768px; abaixo disso, uma lista de cartões (sem rolagem horizontal)
export function DataTable<T>({ columns, rows, getKey, selection, expansion: customExpansion, preview }: DataTableProps<T>) {
  const [openKeys, setOpenKeys] = useState<ReadonlySet<Key>>(new Set())
  const expansion: TableExpansion<T> | undefined =
    customExpansion ??
    (preview && {
      isOpen: (row) => openKeys.has(getKey(row)),
      onToggle: (row) =>
        setOpenKeys((current) => {
          const next = new Set(current)
          if (!next.delete(getKey(row))) next.add(getKey(row))
          return next
        }),
      render: preview.render,
    })
  const primary = columns.find((c) => c.primary) ?? columns[0]
  const details = columns.filter((c) => c !== primary && !c.actions)
  const actions = columns.filter((c) => c.actions)
  const canSelect = (row: T) => selection !== undefined && (selection.canSelect?.(row) ?? true)
  const colSpan = columns.length + (selection ? 1 : 0) + (preview ? 1 : 0)

  const toggleCard = (event: MouseEvent<HTMLElement>, row: T) => {
    if (!expansion || (event.target as HTMLElement).closest(INTERACTIVE)) return
    expansion.onToggle(row)
  }

  const chevron = (row: T) => {
    const open = expansion?.isOpen(row) ?? false
    return (
      <button
        type="button"
        className="btn btn-link p-1 text-secondary"
        aria-expanded={open}
        aria-label={`${open ? 'Fechar' : 'Ver'} resumo de ${preview?.label(row)}`}
        onClick={() => expansion?.onToggle(row)}
      >
        <i className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
      </button>
    )
  }

  return (
    <>
      <div className="d-none d-md-block">
        <Table hover className="align-middle">
          <thead>
            <tr>
              {selection && <th scope="col"><span className="visually-hidden">Selecionar</span></th>}
              {columns.map((column) => (
                <th key={column.header} scope="col" className={column.actions ? 'text-end' : undefined}>
                  {column.actions ? <span className="visually-hidden">{column.header}</span> : column.header}
                </th>
              ))}
              {preview && <th scope="col"><span className="visually-hidden">Resumo</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <TableRow
                key={getKey(row)}
                colSpan={colSpan}
                open={expansion?.isOpen(row) ?? false}
                details={expansion?.render(row)}
                onActivate={preview ? (event) => toggleCard(event, row) : undefined}
              >
                {selection && (
                  <td>
                    {canSelect(row) && (
                      <Form.Check
                        aria-label="Selecionar aula"
                        checked={selection.selected.has(getKey(row))}
                        onChange={() => selection.onToggle(row)}
                      />
                    )}
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.header} className={column.actions ? 'text-end' : undefined}>
                    {column.cell(row, { mobile: false })}
                  </td>
                ))}
                {preview && <td className="text-end">{chevron(row)}</td>}
              </TableRow>
            ))}
          </tbody>
        </Table>
      </div>

      <ul className="d-md-none list-unstyled d-grid gap-3 mb-3">
        {rows.map((row) => (
          <li key={getKey(row)}>
            <Card onClick={(event) => toggleCard(event, row)} className={expansion ? 'cursor-pointer' : undefined}>
              <Card.Body>
                <div className="d-flex gap-2">
                  {selection && canSelect(row) && (
                    <Form.Check
                      className="mt-1"
                      aria-label="Selecionar aula"
                      checked={selection.selected.has(getKey(row))}
                      onChange={() => selection.onToggle(row)}
                    />
                  )}
                  <div className="fw-semibold text-break mb-2 min-w-0 flex-grow-1">{primary.cell(row, { mobile: true })}</div>
                  {preview && <i className={`bi ${expansion?.isOpen(row) ? 'bi-chevron-up' : 'bi-chevron-down'} text-secondary`} aria-hidden="true" />}
                </div>
                <dl className="data-card-list mb-0">
                  {details.map((column) => (
                    <div key={column.header} className="d-flex justify-content-between gap-3 py-1">
                      <dt className="fw-normal text-secondary">{column.header}</dt>
                      <dd className="mb-0 text-end text-break">{column.cell(row, { mobile: true })}</dd>
                    </div>
                  ))}
                </dl>
                {actions.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    {actions.map((column) => (
                      <div key={column.header} className="d-flex flex-wrap gap-2 w-100">
                        {column.cell(row, { mobile: true })}
                      </div>
                    ))}
                  </div>
                )}
                {expansion?.isOpen(row) && <div className="border-top mt-3 pt-3">{expansion.render(row)}</div>}
              </Card.Body>
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}

// Linha da tabela com detalhes logo abaixo, quando aberta
function TableRow({
  colSpan,
  open,
  details,
  onActivate,
  children,
}: {
  colSpan: number
  open: boolean
  details?: ReactNode
  onActivate?: (event: MouseEvent<HTMLElement>) => void
  children: ReactNode
}) {
  return (
    <>
      <tr className={[open ? 'table-active' : '', onActivate ? 'cursor-pointer' : ''].filter(Boolean).join(' ') || undefined} onClick={onActivate}>
        {children}
      </tr>
      {open && details && (
        <tr className="bg-body-tertiary">
          <td colSpan={colSpan} className="py-3">
            {details}
          </td>
        </tr>
      )}
    </>
  )
}
