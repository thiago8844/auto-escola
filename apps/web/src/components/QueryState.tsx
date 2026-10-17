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
  if (isEmpty(query.data)) return <Alert variant="info">{empty}</Alert>
  return <>{children(query.data)}</>
}
