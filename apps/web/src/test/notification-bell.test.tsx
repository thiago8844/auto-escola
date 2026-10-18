import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { refreshAlerts } from '../api/alerts'
import { NotificationBell } from '../components/NotificationBell'
import { organizationPaths } from '../config/paths'
import { useNotificationStore } from '../stores/notificationStore'
import { useToastStore } from '../stores/toastStore'

vi.mock('../api/alerts', () => ({
  listAlerts: vi.fn().mockResolvedValue({ data: [], meta: { total: 0, unread: 0 } }),
  getAlertSummary: vi.fn().mockResolvedValue({ open: 0, unread: 0 }),
  refreshAlerts: vi.fn().mockResolvedValue(undefined),
  markAlertRead: vi.fn(),
  markAllAlertsRead: vi.fn(),
  archiveAlert: vi.fn(),
  unarchiveAlert: vi.fn(),
  getAlertSettings: vi.fn(),
  updateAlertSettings: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  useNotificationStore.getState().clear()
  useToastStore.getState().clear()
})

it('atualiza ao abrir o sino repetidamente sem exibir aviso de sucesso', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/espacos/1']}>
        <Routes><Route path="/espacos/:organizationId" element={<NotificationBell />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  const bell = screen.getByRole('button', { name: 'Notificações' })
  await user.click(bell)
  await waitFor(() => expect(refreshAlerts).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('heading', { name: 'Notificações' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Ver todas as notificações' })).toHaveAttribute('href', organizationPaths(1).alerts)
  expect(useToastStore.getState().toasts).toEqual([])

  await user.click(bell)
  await user.click(bell)
  await waitFor(() => expect(refreshAlerts).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(4))
  expect(useToastStore.getState().toasts).toEqual([])
  client.clear()
})
