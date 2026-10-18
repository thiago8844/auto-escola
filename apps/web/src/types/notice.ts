// Tipos do sistema de avisos. Veja docs/notificacoes.md.

// Define ícone, cor e urgência de qualquer aviso (toast, item do sino ou alerta máximo)
export type NoticeType = 'success' | 'info' | 'warning' | 'error' | 'reminder'

export type NoticeAction = {
  label: string
  // Rota interna do app
  to?: string
  onClick?: () => void
}

// auto: fecha sozinho depois de `duration`. sticky: só fecha no X.
export type ToastMode = 'auto' | 'sticky'

export type ToastOptions = {
  type: NoticeType
  message: string
  title?: string
  mode?: ToastMode
  // Só para mode 'auto'. Padrão por tipo em config/notices.ts
  duration?: number
  // Mesma chave = o toast novo substitui o antigo (em vez de empilhar outro igual)
  key?: string
  // Oferece "Não mostrar novamente"; a escolha fica nas preferências do usuário
  muteKey?: string
  action?: NoticeAction
}

export type ToastData = Required<Pick<ToastOptions, 'type' | 'message' | 'mode' | 'duration' | 'key'>> &
  Pick<ToastOptions, 'title' | 'muteKey' | 'action'> & { id: number }

// Item da central de notificações (o sino). São avisos para quem usa o sistema, não para os clientes.
export type AppNotification = {
  id: string
  type: NoticeType
  title: string
  message?: string
  createdAt: string
  readAt: string | null
  action?: NoticeAction
}

export type CriticalSeverity = 'danger' | 'warning'

// Alerta máximo: modal que bloqueia a tela até o usuário confirmar
export type CriticalAlert = {
  id: string
  title: string
  message: string
  // Lista de pontos importantes (ex.: "Vence em 5 dias", "O acesso será bloqueado")
  details?: string[]
  severity?: CriticalSeverity
  confirmLabel?: string
  action?: NoticeAction
  // Oferece "Não mostrar novamente". Não use em avisos que o usuário não pode ignorar.
  muteKey?: string
}
