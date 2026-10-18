import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { FormNavigationGuard } from '../components/FormNavigationGuard'
import { MoneyInput } from '../components/MoneyInput'
import { useFormChanges, useFormProtection } from '../hooks/useFormProtection'
import { loadLastUsed, saveLastUsed } from '../utils/financeLastUsed'
import { useAuthStore } from '../stores/authStore'
import type { User } from '../types/auth'

function Editor() {
  const [value, setValue] = useState('')
  useFormProtection(value !== '')
  return <><label>Nome<input value={value} onChange={(e) => setValue(e.target.value)} /></label><Link to="/outro">Sair</Link></>
}
afterEach(() => { act(() => { useFormChanges.getState().clear(); useAuthStore.getState().setAnonymous() }); localStorage.clear() })

describe('proteção do preenchimento', () => {
  it('mantém o texto ao cancelar a saída e só descarta após confirmação', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter([{ element: <><FormNavigationGuard /><Outlet /></>, children: [{ path: '/', element: <Editor /> }, { path: '/outro', element: <h1>Outro destino</h1> }] }])
    render(<RouterProvider router={router} />)
    await user.type(screen.getByLabelText('Nome'), 'Maria')
    await user.click(screen.getByText('Sair'))
    await user.click(screen.getByRole('button', { name: 'Continuar editando' }))
    expect(screen.getByLabelText('Nome')).toHaveValue('Maria')
    await user.click(screen.getByText('Sair'))
    await user.click(screen.getByRole('button', { name: 'Descartar e sair' }))
    expect(await screen.findByRole('heading', { name: 'Outro destino' })).toBeInTheDocument()
  })

  it('exibe parcelas com moeda e casas decimais brasileiras', () => {
    render(<MoneyInput aria-label="Valor" value="1250.5" onValueChange={() => {}} />)
    expect(screen.getByLabelText('Valor')).toHaveValue('R$ 1.250,50')
  })

  it('isola a sugestão financeira entre usuários do mesmo espaço', () => {
    useAuthStore.getState().setUser({ id: 1 } as User)
    saveLastUsed(5, 'receivable', { account_id: 4, method_id: 2 })
    useAuthStore.getState().setUser({ id: 2 } as User)
    expect(loadLastUsed(5, 'receivable')).toEqual({})
    useAuthStore.getState().setUser({ id: 1 } as User)
    expect(loadLastUsed(5, 'receivable')).toEqual({ account_id: 4, method_id: 2 })
  })
})
