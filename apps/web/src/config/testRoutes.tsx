import type { RouteObject } from 'react-router-dom'
import ToastsTestPage from '../pages/_testes/ToastsTestPage'

// ÁREA DE TESTES (temporária). Só existe em desenvolvimento (npm run dev), nunca no build de produção.
// Acesso: /_testes/toasts. Para remover: apague este arquivo, src/pages/_testes e a linha de testRoutes em routes.tsx.
export const testRoutes: RouteObject[] = import.meta.env.DEV ? [{ path: '/_testes/toasts', element: <ToastsTestPage /> }] : []
