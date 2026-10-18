import type { NoticeType, ToastMode } from '../types/notice'

// Aparência e comportamento padrão de cada tipo de aviso
export const NOTICE_TYPES: Record<NoticeType, { label: string; icon: string; mode: ToastMode; duration: number }> = {
  success: { label: 'Sucesso', icon: 'bi-check-circle-fill', mode: 'auto', duration: 4000 },
  info: { label: 'Informação', icon: 'bi-info-circle-fill', mode: 'auto', duration: 5000 },
  reminder: { label: 'Lembrete', icon: 'bi-alarm-fill', mode: 'auto', duration: 6000 },
  warning: { label: 'Alerta', icon: 'bi-exclamation-triangle-fill', mode: 'auto', duration: 7000 },
  error: { label: 'Erro', icon: 'bi-x-octagon-fill', mode: 'auto', duration: 8000 },
}

export const CRITICAL_ICON = 'bi-exclamation-octagon-fill'

// Quantos toasts aparecem ao mesmo tempo; os demais esperam vaga (aviso com X nunca é descartado)
export const MAX_VISIBLE_TOASTS = 5

// Toast com X (sticky) que ninguém tocou fica mais transparente depois deste tempo
export const TOAST_FADE_AFTER_MS = 5000

// Avisos que o usuário pode silenciar com "Não mostrar novamente".
// Cadastre aqui a chave (muteKey) com um nome legível: ele aparece em Configurações > Avisos ocultos.
export const MUTABLE_NOTICES: Record<string, { label: string; description?: string }> = {
  // Exemplo:
  // 'billing.due-soon': { label: 'Mensalidade perto do vencimento', description: 'Lembrete dos dias antes do vencimento.' },
}
