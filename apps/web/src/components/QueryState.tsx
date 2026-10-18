import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Alert, Spinner } from 'react-bootstrap'
import type { ApiError } from '../api/errors'
import { QueryErrorAlert } from './QueryErrorAlert'

type QueryStateProps<T> = {
  query: UseQueryResult<T, ApiError>
  isEmpty: (data: T) => boolean
  // Mensagem do estado vazio
  empty: ReactNode
  children: (data: T) => ReactNode
}

// Carregando, erro com "tentar novamente", vazio ou conteúdo: o mesmo padrão em toda lista
export function QueryState<T>({ query, isEmpty, empty, children }: QueryStateProps<T>) {
  if (query.error && !query.data) return <QueryErrorAlert error={query.error} onRetry={() => void query.refetch()} />
  if (query.data === undefined) return <Spinner animation="border" role="status" variant="primary" aria-label="Carregando" />
  return (
    <div aria-busy={query.isFetching}>
      {query.error && (
        <>
          <p className="small text-warning-emphasis mb-2">Não foi possível atualizar. Os dados abaixo podem estar desatualizados.</p>
          <QueryErrorAlert error={query.error} onRetry={() => void query.refetch()} />
        </>
      )}
      {query.isFetching && <p role="status" className="small text-secondary mb-2"><Spinner size="sm" animation="border" className="me-2" />Atualizando…</p>}
      <div inert={query.isPlaceholderData || undefined} className={query.isPlaceholderData ? 'opacity-50' : undefined}>
        {isEmpty(query.data) ? <Alert variant="info">{empty}</Alert> : children(query.data)}
      </div>
    </div>
  )
}
