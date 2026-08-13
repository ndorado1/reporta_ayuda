'use client'

import { Plus, X } from 'lucide-react'
import { Button } from './ui/Button'

export type Item = { name: string; quantity: string }

export function ItemsField({
  items,
  onChange,
}: {
  items: Item[]
  onChange: (items: Item[]) => void
}) {
  function update(index: number, patch: Partial<Item>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-semibold text-(--color-primary)">
        ¿Qué necesitan?
      </legend>

      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <label htmlFor={`item-${index}`} className="sr-only">
              Qué necesitas ({index + 1})
            </label>
            <input
              id={`item-${index}`}
              value={item.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="Agua, pañales, cobijas…"
              className="min-h-[44px] w-full rounded-lg border border-(--color-line) px-3 text-base"
            />
          </div>
          <div className="sm:w-40">
            <label htmlFor={`cantidad-${index}`} className="sr-only">
              Cuánto ({index + 1})
            </label>
            <input
              id={`cantidad-${index}`}
              value={item.quantity}
              onChange={(e) => update(index, { quantity: e.target.value })}
              placeholder="10 litros"
              className="min-h-[44px] w-full rounded-lg border border-(--color-line) px-3 text-base"
            />
          </div>
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label={`Quitar ${item.name || `renglón ${index + 1}`}`}
              className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg border border-(--color-line) text-(--color-muted) transition-colors duration-150 hover:border-(--color-urgente) hover:text-(--color-urgente)"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...items, { name: '', quantity: '' }])}
      >
        <Plus aria-hidden="true" className="h-5 w-5" />
        Agregar otra cosa
      </Button>
    </fieldset>
  )
}
