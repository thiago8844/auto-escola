import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { SlotSuggestions } from '../components/SlotSuggestions'

const { get } = vi.hoisted(() => ({ get: vi.fn().mockResolvedValue({ data: { data: [{ starts_at: '2026-10-20T14:00:00Z', ends_at: '2026-10-20T14:50:00Z' }], meta: { message: 'Sem reserva.' } } }) }))
vi.mock('../api/client', () => ({ http: { get } }))

describe('sugestão de horário', () => {
  it('consulta somente a pedido e preenche o horário sem criar uma aula', async () => {
    const choose = vi.fn()
    render(<QueryClientProvider client={new QueryClient()}><SlotSuggestions organizationId={1} timezone="America/Sao_Paulo" enrollmentId="9" instructorId="4" vehicleId="6" date="2026-10-20" duration="50" category="B" fromTime="09:00" onChoose={choose} /></QueryClientProvider>)
    expect(get).not.toHaveBeenCalled()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Encontrar horário livre neste dia' }))
    await user.click(await screen.findByRole('button', { name: '11:00–11:50' }))
    expect(get).toHaveBeenCalledWith('/organizations/1/lesson-slots', expect.objectContaining({ params: expect.objectContaining({ instructor_id: '4', vehicle_id: '6', from_time: '09:00' }) }))
    expect(choose).toHaveBeenCalledWith({ starts_at: '2026-10-20T14:00:00Z', ends_at: '2026-10-20T14:50:00Z' })
  })
})
