import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RequestCard } from './RequestCard'

const item = {
  publicCode: 'ABC123',
  title: 'Familia sin agua ni alimentos',
  urgency: 'alta' as const,
  status: 'abierta' as const,
  neighborhood: 'El Diamante',
  cityName: 'Cali',
  citySlug: 'cali',
  lat: 3.44,
  lng: -76.52,
  itemsPreview: ['Agua', 'Arroz', 'Cobijas'],
  itemCount: 5,
  claimedBy: null,
  createdAt: new Date('2026-08-12T10:00:00Z'),
}

describe('RequestCard', () => {
  it('muestra el título y la ubicación', () => {
    render(<RequestCard item={item} />)
    expect(screen.getByText('Familia sin agua ni alimentos')).toBeInTheDocument()
    expect(screen.getByText(/el diamante/i)).toBeInTheDocument()
    expect(screen.getByText(/cali/i)).toBeInTheDocument()
  })

  it('lista los ítems de muestra y cuántos faltan', () => {
    render(<RequestCard item={item} />)
    expect(screen.getByText('Agua')).toBeInTheDocument()
    expect(screen.getByText(/2 más/i)).toBeInTheDocument()
  })

  it('no anuncia ítems adicionales cuando no los hay', () => {
    render(<RequestCard item={{ ...item, itemCount: 3 }} />)
    expect(screen.queryByText(/más$/i)).not.toBeInTheDocument()
  })

  it('enlaza al detalle por su código', () => {
    render(<RequestCard item={item} />)
    expect(screen.getByRole('link', { name: /familia sin agua/i }))
      .toHaveAttribute('href', '/s/ABC123')
  })

  it('muestra la urgencia y el estado', () => {
    render(<RequestCard item={item} />)
    expect(screen.getByText(/urgencia alta/i)).toBeInTheDocument()
    expect(screen.getByText(/sin atender/i)).toBeInTheDocument()
  })

  it('no muestra el botón de ir en camino si ya la atienden', () => {
    render(<RequestCard item={{ ...item, status: 'en_atencion', claimedBy: 'Luis' }} />)
    expect(screen.queryByRole('button', { name: /voy en camino/i })).not.toBeInTheDocument()
    expect(screen.getByText(/luis va en camino/i)).toBeInTheDocument()
  })

  it('muestra la distancia cuando se conoce', () => {
    render(<RequestCard item={{ ...item, distanceKm: 2.4 }} />)
    expect(screen.getByText(/2,4 km/i)).toBeInTheDocument()
  })
})
