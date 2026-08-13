import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ClaimButton } from './ClaimButton'
import { claimAction } from '@/app/actions'

vi.mock('@/app/actions', () => ({ claimAction: vi.fn() }))

beforeEach(() => {
  vi.mocked(claimAction).mockReset()
  localStorage.clear()
})

function open() {
  render(<ClaimButton code="ABC123" />)
  fireEvent.click(screen.getByRole('button', { name: /voy en camino/i }))
  fireEvent.change(screen.getByLabelText(/tu nombre/i), { target: { value: 'Luis Pérez' } })
}

describe('ClaimButton', () => {
  it('guarda el token del claim y cierra el formulario cuando el servidor responde bien', async () => {
    vi.mocked(claimAction).mockResolvedValue({ ok: true, claimToken: 'tok-123' })
    open()

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    await waitFor(() => expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument())
    expect(JSON.parse(localStorage.getItem('reporta-cali:claims')!)).toEqual({ ABC123: 'tok-123' })
  })

  it('muestra el error del servidor sin dejar el botón deshabilitado', async () => {
    vi.mocked(claimAction).mockResolvedValue({ ok: false, error: 'Esta solicitud ya está siendo atendida' })
    open()

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/ya está siendo atendida/i))
    expect(screen.getByRole('button', { name: /confirmar/i })).not.toBeDisabled()
  })

  // Sin try/catch/finally alrededor de claimAction, una promesa rechazada por
  // un corte de red deja "saving" en true para siempre: el botón se congela
  // en "Guardando…" y, peor, el servidor puede haber creado el claim sin que
  // la respuesta llegara, así que el token nunca se guarda y nadie puede
  // cancelarlo. Esta prueba falla contra ese código roto porque nunca
  // aparecería el alert ni se reactivaría el botón.
  it('no deja el botón congelado si un corte de red rechaza la promesa', async () => {
    vi.mocked(claimAction).mockRejectedValue(new TypeError('Failed to fetch'))
    open()

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos guardar/i))
    expect(screen.getByRole('button', { name: /confirmar/i })).not.toBeDisabled()
    expect(localStorage.getItem('reporta-cali:claims')).toBeNull()
  })
})
