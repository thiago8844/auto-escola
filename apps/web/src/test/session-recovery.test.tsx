import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import { useSessionFormRecovery } from '../hooks/useSessionFormRecovery'
import { useAuthStore } from '../stores/authStore'
import type { User } from '../types/auth'

function Editor() {
  const { register, getValues, reset } = useForm({ defaultValues: { name: '' } })
  useSessionFormRecovery('student:1:new', getValues, reset)
  return <label>Nome<input {...register('name')} /></label>
}

describe('retomada da sessão', () => {
  it('recupera o preenchimento após entrar novamente e o isola entre contas', async () => {
    const user = userEvent.setup()
    act(() => useAuthStore.getState().setUser({ id: 101 } as User))
    const first = render(<Editor />)
    await user.type(screen.getByLabelText('Nome'), 'Maria')
    act(() => useAuthStore.getState().expireSession())
    first.unmount()
    act(() => useAuthStore.getState().setUser({ id: 202 } as User))
    const other = render(<Editor />)
    expect(screen.getByLabelText('Nome')).toHaveValue('')
    other.unmount()
    act(() => useAuthStore.getState().setUser({ id: 101 } as User))
    render(<Editor />)
    expect(screen.getByLabelText('Nome')).toHaveValue('Maria')
    act(() => useAuthStore.getState().setAnonymous())
  })
})
