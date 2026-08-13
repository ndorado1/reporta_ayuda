import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OwnerActions } from './OwnerActions'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const fulfill = vi.fn(async () => ({ ok: true as const }))
const cancel = vi.fn(async () => ({ ok: true as const }))

const detail = {
  publicCode: 'ABC123', title: 'Agua', description: null, urgency: 'alta' as const,
  status: 'abierta' as const, neighborhood: null, addressText: null,
  requesterName: 'Ana', peopleCount: null, lat: 3.44, lng: -76.52,
  cityName: 'Cali', citySlug: 'cali', items: [{ name: 'Agua', quantity: null }],
  itemCount: 1, claimedBy: null, createdAt: new Date(), fulfilledAt: null, canManage: true,
}

describe('OwnerActions', () => {
  it('ofrece marcar como atendida cuando sigue abierta', () => {
    render(<OwnerActions code="ABC123" token="t" status="abierta" detail={detail} onFulfill={fulfill} onCancel={cancel} />)
    expect(screen.getByRole('button', { name: /ya recibí la ayuda/i })).toBeInTheDocument()
  })

  it('pide confirmación antes de marcar como atendida', async () => {
    render(<OwnerActions code="ABC123" token="t" status="abierta" detail={detail} onFulfill={fulfill} onCancel={cancel} />)
    fireEvent.click(screen.getByRole('button', { name: /ya recibí la ayuda/i }))
    expect(screen.getByText(/¿confirmas/i)).toBeInTheDocument()
    expect(fulfill).not.toHaveBeenCalled()
  })

  it('marca como atendida al confirmar', async () => {
    render(<OwnerActions code="ABC123" token="t" status="abierta" detail={detail} onFulfill={fulfill} onCancel={cancel} />)
    fireEvent.click(screen.getByRole('button', { name: /ya recibí la ayuda/i }))
    fireEvent.click(screen.getByRole('button', { name: /^sí, confirmar$/i }))
    await waitFor(() => expect(fulfill).toHaveBeenCalledWith('ABC123', 't'))
  })

  it('no ofrece acciones cuando ya está atendida', () => {
    render(<OwnerActions code="ABC123" token="t" status="atendida" detail={detail} onFulfill={fulfill} onCancel={cancel} />)
    expect(screen.queryByRole('button', { name: /ya recibí la ayuda/i })).not.toBeInTheDocument()
  })

  it('ofrece editar mientras la solicitud está abierta', () => {
    render(<OwnerActions code="ABC123" token="t" status="abierta" detail={detail} onFulfill={fulfill} onCancel={cancel} />)
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument()
  })

  it('muestra el formulario de edición al pulsar editar', () => {
    render(<OwnerActions code="ABC123" token="t" status="abierta" detail={detail} onFulfill={fulfill} onCancel={cancel} />)
    fireEvent.click(screen.getByRole('button', { name: /editar/i }))
    expect(screen.getByRole('heading', { name: /editar solicitud/i })).toBeInTheDocument()
  })

  it('no ofrece editar cuando ya está atendida', () => {
    render(<OwnerActions code="ABC123" token="t" status="atendida" detail={detail} onFulfill={fulfill} onCancel={cancel} />)
    expect(screen.queryByRole('button', { name: /^editar$/i })).not.toBeInTheDocument()
  })

  it('no deja el botón congelado si un corte de red rechaza la promesa', async () => {
    const flaky = vi.fn(async () => {
      throw new Error('network down')
    })
    render(<OwnerActions code="ABC123" token="t" status="abierta" detail={detail} onFulfill={flaky} onCancel={cancel} />)
    fireEvent.click(screen.getByRole('button', { name: /ya recibí la ayuda/i }))
    fireEvent.click(screen.getByRole('button', { name: /^sí, confirmar$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos guardar/i))
    expect(screen.getByRole('button', { name: /^sí, confirmar$/i })).not.toBeDisabled()
  })
})
