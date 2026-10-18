import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { DataTable, type Column } from '../components/DataTable'

type Row = { id: number; name: string }

const columns: Column<Row>[] = [
  { header: 'Nome', primary: true, cell: (row) => row.name },
  { header: 'Ações', actions: true, cell: () => <button type="button">Remarcar</button> },
]

it('abre os detalhes ao tocar no cartão, mas não ao tocar num botão dentro dele', () => {
  const onToggle = vi.fn()
  const expansion = { isOpen: () => false, onToggle, render: (row: Row) => `Detalhes de ${row.name}` }
  render(<MemoryRouter><DataTable rows={[{ id: 1, name: 'Ana' }]} getKey={(row) => row.id} columns={columns} expansion={expansion} /></MemoryRouter>)

  fireEvent.click(screen.getAllByRole('button', { name: 'Remarcar' })[0])
  expect(onToggle).not.toHaveBeenCalled()

  // O cartão do celular (a tabela da largura de desktop vem antes no DOM e não abre por toque)
  fireEvent.click(screen.getAllByText('Ana')[1].closest('.card') as HTMLElement)
  expect(onToggle).toHaveBeenCalledWith({ id: 1, name: 'Ana' })
})

it('mostra o checkbox só nas linhas selecionáveis e avisa a troca', () => {
  const onToggle = vi.fn()
  const rows = [
    { id: 1, name: 'Ana' },
    { id: 2, name: 'Bruno' },
  ]
  render(
    <MemoryRouter>
      <DataTable
      rows={rows}
      getKey={(row) => row.id}
      columns={columns}
      selection={{ selected: new Set([1]), canSelect: (row) => row.id === 1, onToggle }}
      />
    </MemoryRouter>,
  )

  // Uma vez na tabela e outra no cartão; Bruno não é selecionável, então não tem checkbox
  const checkboxes = screen.getAllByRole('checkbox', { name: 'Selecionar aula' })
  expect(checkboxes).toHaveLength(2)
  expect(checkboxes[0]).toBeChecked()
  expect(screen.getAllByText('Bruno')).toHaveLength(2)
  fireEvent.click(checkboxes[0])
  expect(onToggle).toHaveBeenCalledWith(rows[0])
})

function Where() {
  return <output>{useLocation().pathname}</output>
}

it('com `open`, tocar em qualquer célula da linha abre a ficha, mas não ao tocar num botão', () => {
  render(
    <MemoryRouter>
      <DataTable rows={[{ id: 1, name: 'Ana' }]} getKey={(row) => row.id} columns={columns} open={{ to: (row) => `/alunos/${row.id}`, label: (row) => row.name }} />
      <Where />
    </MemoryRouter>,
  )

  fireEvent.click(screen.getAllByRole('button', { name: 'Remarcar' })[0])
  expect(screen.getByRole('status').textContent).toBe('/')

  fireEvent.click(screen.getAllByText('Ana')[0])
  expect(screen.getByRole('status').textContent).toBe('/alunos/1')
})
