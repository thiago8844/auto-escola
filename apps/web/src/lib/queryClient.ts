import { MutationCache, QueryClient } from '@tanstack/react-query'
import { notify } from '../stores/toastStore'

export const SESSION_QUERY_KEY = ['session'] as const

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Avisos repetidos (ex.: 403 já mostrado pelo cliente HTTP) são descartados pelo toastStore
      if (mutation.meta?.toastOnError) notify.error(error.message)
    },
  }),
  defaultOptions: {
    queries: {
      // Erros da API são decisões (401, 403, 422), não falhas de rede: repetir não ajuda
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
})

// Descarta os dados do usuário anterior ao sair ou ao expirar a sessão
export function resetServerCache() {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0] })
}
