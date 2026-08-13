import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ItemsField } from './ItemsField'

describe('ItemsField', () => {
  it('muestra un renglón por ítem', () => {
    render(<ItemsField items={[{ name: 'Agua', quantity: '' }]} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('Agua')).toBeInTheDocument()
  })

  it('añade un renglón', () => {
    const onChange = vi.fn()
    render(<ItemsField items={[{ name: 'Agua', quantity: '' }]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }))
    expect(onChange).toHaveBeenCalledWith([
      { name: 'Agua', quantity: '' },
      { name: '', quantity: '' },
    ])
  })

  it('elimina un renglón', () => {
    const onChange = vi.fn()
    render(<ItemsField items={[{ name: 'Agua', quantity: '' }, { name: 'Arroz', quantity: '' }]} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button', { name: /quitar/i })[0])
    expect(onChange).toHaveBeenCalledWith([{ name: 'Arroz', quantity: '' }])
  })

  it('no permite quitar el único renglón', () => {
    render(<ItemsField items={[{ name: 'Agua', quantity: '' }]} onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument()
  })

  it('etiqueta cada campo para lectores de pantalla', () => {
    render(<ItemsField items={[{ name: 'Agua', quantity: '' }]} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/qué necesitas \(1\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cuánto \(1\)/i)).toBeInTheDocument()
  })
})
