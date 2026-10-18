import { fireEvent, render, screen } from '@testing-library/react'
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
  render(<DataTable rows={[{ id: 1, name: 'Ana' }]} getKey={(row) => row.id} columns={columns} expansion={expansion} />)

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
    <DataTable
      rows={rows}
      getKey={(row) => row.id}
      columns={columns}
      selection={{ selected: new Set([1]), canSelect: (row) => row.id === 1, onToggle }}
    />,
  )

  // Uma vez na tabela e outra no cartão; Bruno não é selecionável, então não tem checkbox
  const checkboxes = screen.getAllByRole('checkbox', { name: 'Selecionar aula' })
  expect(checkboxes).toHaveLength(2)
  expect(checkboxes[0]).toBeChecked()
  expect(screen.getAllByText('Bruno')).toHaveLength(2)
  fireEvent.click(checkboxes[0])
  expect(onToggle).toHaveBeenCalledWith(rows[0])
})

it('com resumo, tocar em qualquer célula da linha abre e fecha os detalhes', () => {
  const preview = { label: (row: Row) => row.name, render: (row: Row) => `Resumo de ${row.name}` }
  render(<DataTable rows={[{ id: 1, name: 'Ana' }]} getKey={(row) => row.id} columns={columns} preview={preview} />)

  expect(screen.queryByText('Resumo de Ana')).toBeNull()
  fireEvent.click(screen.getAllByText('Ana')[0])
  expect(screen.getAllByText('Resumo de Ana').length).toBeGreaterThan(0)

  fireEvent.click(screen.getAllByRole('button', { name: 'Fechar resumo de Ana' })[0])
  expect(screen.queryByText('Resumo de Ana')).toBeNull()
})
