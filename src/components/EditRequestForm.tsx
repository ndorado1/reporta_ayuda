'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ItemsField, type Item } from './ItemsField'
import { Button } from './ui/Button'
import { updateRequestAction } from '@/app/actions'
import type { RequestDetail } from '@/lib/requests'

export function EditRequestForm({
  detail,
  token,
  onDone,
}: {
  detail: RequestDetail
  token: string
  onDone: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(detail.title)
  const [description, setDescription] = useState(detail.description ?? '')
  const [urgency, setUrgency] = useState(detail.urgency)
  const [neighborhood, setNeighborhood] = useState(detail.neighborhood ?? '')
  const [addressText, setAddressText] = useState(detail.addressText ?? '')
  const [items, setItems] = useState<Item[]>(
    detail.items.map((i) => ({ name: i.name, quantity: i.quantity ?? '' }))
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const field = 'min-h-[44px] w-full rounded-lg border border-(--color-line) px-3 text-base'
  const label = 'block text-base font-semibold text-(--color-primary)'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // try/catch/finally: sin esto, un corte de red deja "saving" en true
    // para siempre y el botón se congela en "Guardando…" sin forma de
    // reintentar salvo recargar (y perder los cambios escritos).
    try {
      const result = await updateRequestAction(detail.publicCode, token, {
        title,
        description,
        urgency,
        neighborhood,
        addressText,
        items: items.filter((i) => i.name.trim()),
      })

      if (result.ok) {
        onDone()
        router.refresh()
      } else {
        setError(result.error)
      }
    } catch {
      setError('No pudimos guardar el cambio. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-4 rounded-xl border border-(--color-line) bg-white p-4"
    >
      <h3 className="text-lg font-bold text-(--color-primary)">Editar solicitud</h3>

      <div>
        <label htmlFor="edit-titulo" className={label}>¿Qué está pasando?</label>
        <input
          id="edit-titulo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={field}
          required
          minLength={8}
          maxLength={120}
        />
      </div>

      <ItemsField items={items} onChange={setItems} />

      <div>
        <label htmlFor="edit-urgencia" className={label}>Urgencia</label>
        <select
          id="edit-urgencia"
          value={urgency}
          onChange={(e) => setUrgency(e.target.value as 'alta' | 'media' | 'baja')}
          className={`${field} cursor-pointer`}
        >
          <option value="alta">Alta — se necesita hoy</option>
          <option value="media">Media — en los próximos días</option>
          <option value="baja">Baja — puede esperar</option>
        </select>
      </div>

      <div>
        <label htmlFor="edit-descripcion" className={label}>Detalles</label>
        <textarea
          id="edit-descripcion"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full rounded-lg border border-(--color-line) p-3 text-base"
        />
      </div>

      <div>
        <label htmlFor="edit-barrio" className={label}>Barrio o comuna</label>
        <input
          id="edit-barrio"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          className={field}
        />
      </div>

      <div>
        <label htmlFor="edit-direccion" className={label}>Dirección o punto de referencia</label>
        <input
          id="edit-direccion"
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
          className={field}
        />
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-(--color-urgente)">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} className="flex-1">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
