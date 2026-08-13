import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UrgencyBadge } from './UrgencyBadge'
import { StatusBadge } from './StatusBadge'

describe('UrgencyBadge', () => {
  it('nombra la urgencia con palabras, no solo con color', () => {
    render(<UrgencyBadge urgency="alta" />)
    expect(screen.getByText(/urgencia alta/i)).toBeInTheDocument()
  })

  it('distingue las tres urgencias', () => {
    const { rerender } = render(<UrgencyBadge urgency="media" />)
    expect(screen.getByText(/urgencia media/i)).toBeInTheDocument()
    rerender(<UrgencyBadge urgency="baja" />)
    expect(screen.getByText(/urgencia baja/i)).toBeInTheDocument()
  })

  it('marca el icono como decorativo para lectores de pantalla', () => {
    const { container } = render(<UrgencyBadge urgency="alta" />)
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('StatusBadge', () => {
  it('describe el estado abierto', () => {
    render(<StatusBadge status="abierta" />)
    expect(screen.getByText(/sin atender/i)).toBeInTheDocument()
  })

  it('dice quién va en camino cuando se conoce', () => {
    render(<StatusBadge status="en_atencion" claimedBy="Luis Pérez" />)
    expect(screen.getByText(/luis pérez va en camino/i)).toBeInTheDocument()
  })

  it('no inventa un nombre cuando no lo hay', () => {
    render(<StatusBadge status="en_atencion" />)
    expect(screen.getByText(/alguien va en camino/i)).toBeInTheDocument()
  })

  it('describe el estado atendido', () => {
    render(<StatusBadge status="atendida" />)
    expect(screen.getByText(/atendida/i)).toBeInTheDocument()
  })
})
