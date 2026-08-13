import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OwnerActions } from './OwnerActions'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const fulfill = vi.fn(async () => ({ ok: true as const }))
const cancel = vi.fn(async () => ({ ok: true as const }))

describe('OwnerActions', () => {
  it('ofrece marcar como atendida cuando sigue abierta', () => {
    render(<OwnerActions code="ABC123" token="t" status="abierta" onFulfill={fulfill} onCancel={cancel} />)
    expect(screen.getByRole('button', { name: /ya recibí la ayuda/i })).toBeInTheDocument()
  })

  it('pide confirmación antes de marcar como atendida', async () => {
    render(<OwnerActions code="ABC123" token="t" status="abierta" onFulfill={fulfill} onCancel={cancel} />)
    fireEvent.click(screen.getByRole('button', { name: /ya recibí la ayuda/i }))
    expect(screen.getByText(/¿confirmas/i)).toBeInTheDocument()
    expect(fulfill).not.toHaveBeenCalled()
  })

  it('marca como atendida al confirmar', async () => {
    render(<OwnerActions code="ABC123" token="t" status="abierta" onFulfill={fulfill} onCancel={cancel} />)
    fireEvent.click(screen.getByRole('button', { name: /ya recibí la ayuda/i }))
    fireEvent.click(screen.getByRole('button', { name: /^sí, confirmar$/i }))
    await waitFor(() => expect(fulfill).toHaveBeenCalledWith('ABC123', 't'))
  })

  it('no ofrece acciones cuando ya está atendida', () => {
    render(<OwnerActions code="ABC123" token="t" status="atendida" onFulfill={fulfill} onCancel={cancel} />)
    expect(screen.queryByRole('button', { name: /ya recibí la ayuda/i })).not.toBeInTheDocument()
  })
})
