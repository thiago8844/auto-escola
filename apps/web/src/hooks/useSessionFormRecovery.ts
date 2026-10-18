import { useEffect, useState } from 'react'
import type { FieldValues, UseFormGetValues, UseFormReset } from 'react-hook-form'
import { useAuthStore } from '../stores/authStore'
import { notify } from '../stores/toastStore'

// Só memória desta aba, separada por conta e formulário. Não grava dados pessoais no navegador.
const expiredDrafts = new Map<string, FieldValues>()
export function useSessionFormRecovery<T extends FieldValues>(formId: string, getValues: UseFormGetValues<T>, reset: UseFormReset<T>) {
  const [key] = useState(() => `${useAuthStore.getState().user?.id ?? 'anonymous'}:${formId}`)
  useEffect(() => {
    const draft = expiredDrafts.get(key)
    if (draft) {
      expiredDrafts.delete(key)
      reset(draft as T, { keepDefaultValues: true })
      notify.info('Recuperamos o preenchimento anterior à expiração da sessão. Confira os dados antes de salvar.')
    }
    return () => {
      if (useAuthStore.getState().sessionExpired && !key.startsWith('anonymous:')) expiredDrafts.set(key, getValues())
    }
  }, [key, getValues, reset])
}
