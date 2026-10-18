import type { ReactNode } from 'react'
import { Card, Table } from 'react-bootstrap'

export type Column<T> = {
  header: string
  // `mobile` é verdadeiro na versão em cartões (use para botões e campos em tamanho confortável ao toque)
  cell: (row: T, ctx: { mobile: boolean }) => ReactNode
  // Vira o título do cartão no mobile (a primeira coluna, se nenhuma for marcada)
  primary?: boolean
  // Coluna de ações: alinhada à direita na tabela e no rodapé do cartão
  actions?: boolean
}

type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  getKey: (row: T) => string | number
}

// Tabela a partir de 768px; abaixo disso, uma lista de cartões (sem rolagem horizontal)
export function DataTable<T>({ columns, rows, getKey }: DataTableProps<T>) {
  const primary = columns.find((c) => c.primary) ?? columns[0]
  const details = columns.filter((c) => c !== primary && !c.actions)
  const actions = columns.filter((c) => c.actions)

  return (
    <>
      <div className="d-none d-md-block">
        <Table hover className="align-middle">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.header} scope="col" className={column.actions ? 'text-end' : undefined}>
                  {column.actions ? <span className="visually-hidden">{column.header}</span> : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getKey(row)}>
                {columns.map((column) => (
                  <td key={column.header} className={column.actions ? 'text-end' : undefined}>
                    {column.cell(row, { mobile: false })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <ul className="d-md-none list-unstyled d-grid gap-3 mb-3">
        {rows.map((row) => (
          <li key={getKey(row)}>
            <Card>
              <Card.Body>
                <div className="fw-semibold text-break mb-2">{primary.cell(row, { mobile: true })}</div>
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
              </Card.Body>
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}
