import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

// Página atual na URL (?page=2): sobrevive a recarregar e ao botão voltar
export function usePageParam() {
  const [searchParams, setSearchParams] = useSearchParams()
  const parsed = Number(searchParams.get('page'))
  const page = Number.isInteger(parsed) && parsed >= 1 ? parsed : 1

  const setPage = useCallback(
    (next: number, replace = false) => {
      setSearchParams(
        (params) => {
          const updated = new URLSearchParams(params)
          if (next <= 1) updated.delete('page')
          else updated.set('page', String(next))
          return updated
        },
        { replace },
      )
    },
    [setSearchParams],
  )

  return [page, setPage] as const
}

// Recua para a última página quando a atual deixa de existir
// (ex.: removeu o último item da última página, ou a URL tem ?page=999)
export function useClampPage(page: number, lastPage: number | undefined, setPage: (page: number, replace?: boolean) => void) {
  useEffect(() => {
    if (lastPage !== undefined && lastPage >= 1 && page > lastPage) setPage(lastPage, true)
  }, [page, lastPage, setPage])
}
