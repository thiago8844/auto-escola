import { Pagination as BsPagination } from 'react-bootstrap'

type PaginationProps = {
  page: number
  lastPage: number
  total: number
  perPage: number
  onPageChange: (page: number) => void
}

// Números de página com reticências: 1 … 4 5 [6] 7 8 … 20
function visiblePages(page: number, lastPage: number): Array<number | 'gap-start' | 'gap-end'> {
  const pages = new Set([1, lastPage, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= lastPage).sort((a, b) => a - b)

  const result: Array<number | 'gap-start' | 'gap-end'> = []
  sorted.forEach((p, index) => {
    const previous = sorted[index - 1]
    if (previous !== undefined && p - previous > 1) {
      // Um salto de uma página só vira o próprio número, sem reticências
      result.push(p - previous === 2 ? previous + 1 : index === 1 ? 'gap-start' : 'gap-end')
    }
    result.push(p)
  })
  return result
}

// Paginação compartilhada das listagens (resumo + controles). Some quando há uma página só.
export function Pagination({ page, lastPage, total, perPage, onPageChange }: PaginationProps) {
  if (total === 0) return null

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <nav aria-label="Paginação" className="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2">
      <span className="small text-secondary tabular-nums">
        {from}–{to} de {total}
      </span>

      {lastPage > 1 && (
        <BsPagination className="mb-0">
          <BsPagination.Prev disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <span className="visually-hidden">Página anterior</span>
            <span aria-hidden="true">‹</span>
          </BsPagination.Prev>
          {visiblePages(page, lastPage).map((item) =>
            typeof item === 'number' ? (
              <BsPagination.Item key={item} active={item === page} onClick={() => onPageChange(item)} aria-label={`Página ${item}`}>
                {item}
              </BsPagination.Item>
            ) : (
              <BsPagination.Ellipsis key={item} disabled />
            ),
          )}
          <BsPagination.Next disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
            <span className="visually-hidden">Próxima página</span>
            <span aria-hidden="true">›</span>
          </BsPagination.Next>
        </BsPagination>
      )}
    </nav>
  )
}
