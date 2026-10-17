export const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'Rota Certa Gestão'

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8010').replace(/\/$/, '')

// Prefixo da versão da API (as rotas ficam em /api/v1/*); o health e o csrf-cookie ficam na raiz
export const API_BASE_URL = `${API_URL}/api/v1`
