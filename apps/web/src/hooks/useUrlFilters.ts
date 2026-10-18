import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDebouncedValue } from './useDebouncedValue'

// Filtros na URL: voltar do detalhe mantém busca, filtros e página (a URL é a única fonte da verdade)
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ''])) as Record<K, string>

  // Várias mudanças de uma vez (ex.: período + aba): uma única atualização da URL
  const setMany = (patch: Record<string, string>, keepPage = false) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!keepPage) next.delete('page')
        return next
      },
      { replace: true },
    )

  const set = (key: string, value: string) => setMany({ [key]: value })

  const clear = () => setParams({}, { replace: true })

  return { values, set, setMany, clear, active: keys.some((key) => values[key] !== '') }
}

// Campo de busca por texto: digitar atualiza `?busca=` com atraso, e o valor inicial vem da URL
export function useUrlSearch(param = 'busca') {
  const [params, setParams] = useSearchParams()
  const [text, setText] = useState(params.get(param) ?? '')
  const search = useDebouncedValue(text.trim())

  useEffect(() => {
    if ((params.get(param) ?? '') === search) return
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (search) next.set(param, search)
        else next.delete(param)
        next.delete('page')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return [text, setText, search] as const
}
