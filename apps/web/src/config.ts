export const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'Rota Certa Gestão'

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8010').replace(/\/$/, '')

// Prefixo da versão da API (as rotas ficam em /api/v1/*); o health e o csrf-cookie ficam na raiz
export const API_BASE_URL = `${API_URL}/api/v1`

// Política de senha: a mesma regra da API (mínimo 3). Ajustável com VITE_PASSWORD_MIN.
export const PASSWORD_MIN = Number(import.meta.env.VITE_PASSWORD_MIN ?? 3)

// Canal de suporte mostrado no primeiro acesso e no menu (defina VITE_SUPPORT_EMAIL antes de publicar)
export const SUPPORT_EMAIL: string | undefined = import.meta.env.VITE_SUPPORT_EMAIL || undefined
