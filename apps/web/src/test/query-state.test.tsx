import type { UseQueryResult } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { QueryState } from '../components/QueryState'

it('informa falha ao atualizar sem apagar os dados e oferece nova tentativa', () => {
  const refetch = vi.fn()
  const query = { data: 'Valor anterior', error: new ApiError({ kind: 'network', message: 'Sem conexão' }), refetch } as unknown as UseQueryResult<string, ApiError>
  render(<QueryState query={query} isEmpty={() => false} empty="Vazio">{(value) => <p>{value}</p>}</QueryState>)
  expect(screen.getByText('Valor anterior')).toBeInTheDocument()
  expect(screen.getByText(/podem estar desatualizados/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(refetch).toHaveBeenCalledOnce()
})
