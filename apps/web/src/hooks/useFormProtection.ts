import { useEffect, useId, useRef, useState } from 'react'
import { create } from 'zustand'

type FormChanges = { dirty: Record<string, true>; mark: (id: string, dirty: boolean) => void; clear: () => void }
export const useFormChanges = create<FormChanges>((set) => ({
  dirty: {},
  mark: (id, dirty) => set((s) => ({ dirty: dirty ? { ...s.dirty, [id]: true } : Object.fromEntries(Object.entries(s.dirty).filter(([key]) => key !== id)) })),
  clear: () => set({ dirty: {} }),
}))

export function useFormProtection(dirty: boolean, onClose?: () => void, pending = false) {
  const id = useId()
  const committed = useRef(false)
  const mark = useFormChanges((s) => s.mark)
  useEffect(() => { mark(id, dirty); return () => mark(id, false) }, [dirty, id, mark])
  const saved = () => { committed.current = true; mark(id, false) }
  const close = () => {
    if (pending) return
    if (dirty && !committed.current && !window.confirm('Descartar o que foi preenchido? Escolha Cancelar para continuar editando.')) return
    saved()
    onClose?.()
  }
  return { saved, close }
}

export function useDraftProtection(value: unknown, onClose: () => void, pending = false) {
  const snapshot = JSON.stringify(value)
  const [initial] = useState(snapshot)
  return useFormProtection(snapshot !== initial, onClose, pending)
}
