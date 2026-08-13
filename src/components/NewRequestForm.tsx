'use client'

import { useState } from 'react'
import dynamicImport from 'next/dynamic'
import Link from 'next/link'
import { ItemsField, type Item } from './ItemsField'
import { Button } from './ui/Button'
import { RequestCreated } from './RequestCreated'
import { createRequestAction } from '@/app/actions'
import { saveMyRequest } from '@/lib/my-requests'

const LocationPicker = dynamicImport(() => import('./LocationPicker'), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-slate-100" />,
})

type City = { slug: string; name: string; centerLat: number; centerLng: number; defaultZoom: number }

export function NewRequestForm({ cities }: { cities: City[] }) {
  const [citySlug, setCitySlug] = useState(cities[0]?.slug ?? '')
  const city = cities.find((c) => c.slug === citySlug) ?? cities[0]

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState<'alta' | 'media' | 'baja'>('media')
  const [items, setItems] = useState<Item[]>([{ name: '', quantity: '' }])
  const [requesterName, setRequesterName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [addressText, setAddressText] = useState('')
  const [peopleCount, setPeopleCount] = useState('')
  const [coords, setCoords] = useState({ lat: city.centerLat, lng: city.centerLng })
  const [acceptsPrivacy, setAcceptsPrivacy] = useState(false)
  const [website, setWebsite] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ publicCode: string; manageToken: string } | null>(null)

  function changeCity(slug: string) {
    setCitySlug(slug)
    const next = cities.find((c) => c.slug === slug)
    if (next) setCoords({ lat: next.centerLat, lng: next.centerLng })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Un corte de red a mitad de la petición no lanza un error "de
    // servidor" (eso ya lo captura el try/catch de la action): rechaza la
    // promesa del fetch aquí mismo. Sin este try/catch, "saving" se queda
    // en true para siempre, el botón se congela en "Publicando…" y la
    // única salida es recargar la página, perdiendo todo lo escrito.
    try {
      const result = await createRequestAction({
        citySlug,
        title,
        description,
        urgency,
        items: items.filter((i) => i.name.trim()),
        requesterName,
        whatsapp,
        lat: coords.lat,
        lng: coords.lng,
        neighborhood,
        addressText,
        peopleCount: peopleCount ? Number(peopleCount) : undefined,
        acceptsPrivacy: acceptsPrivacy as true,
        website,
      })

      if (result.ok) {
        saveMyRequest({
          publicCode: result.publicCode,
          manageToken: result.manageToken,
          title,
          createdAt: new Date().toISOString(),
        })
        setCreated({ publicCode: result.publicCode, manageToken: result.manageToken })
      } else {
        setError(result.error)
        setSaving(false)
      }
    } catch {
      setError('No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo.')
      setSaving(false)
    }
  }

  if (created) {
    return <RequestCreated {...created} whatsapp={whatsapp} title={title} />
  }

  const field = 'min-h-[44px] w-full rounded-lg border border-(--color-line) px-3 text-base'
  const label = 'block text-base font-semibold text-(--color-primary)'

  return (
    // noValidate: la validación nativa del navegador aparece en el idioma del
    // sistema (a menudo inglés) y no usa role="alert". Todos los campos ya
    // están cubiertos por createRequestSchema, que devuelve mensajes en
    // español que sí se anuncian con role="alert" más abajo.
    <form onSubmit={submit} noValidate className="space-y-6">
      <div>
        <label htmlFor="ciudad" className={label}>Ciudad</label>
        <select
          id="ciudad"
          value={citySlug}
          onChange={(e) => changeCity(e.target.value)}
          className={`${field} cursor-pointer`}
          required
        >
          {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="titulo" className={label}>¿Qué está pasando?</label>
        <input
          id="titulo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Familia con niños sin agua ni alimentos"
          className={field}
          required
          minLength={8}
          maxLength={120}
        />
      </div>

      <ItemsField items={items} onChange={setItems} />

      <div>
        <label htmlFor="urgencia" className={label}>¿Qué tan urgente es?</label>
        <select
          id="urgencia"
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
        <label htmlFor="descripcion" className={label}>
          Detalles <span className="font-normal text-(--color-muted)">(opcional)</span>
        </label>
        <textarea
          id="descripcion"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full rounded-lg border border-(--color-line) p-3 text-base"
        />
      </div>

      <div>
        <span className={label}>¿Dónde?</span>
        <LocationPicker
          lat={coords.lat}
          lng={coords.lng}
          zoom={city.defaultZoom}
          onChange={(lat, lng) => setCoords({ lat, lng })}
        />
      </div>

      <div>
        <label htmlFor="barrio" className={label}>
          Barrio o comuna <span className="font-normal text-(--color-muted)">(opcional)</span>
        </label>
        <input id="barrio" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={field} />
      </div>

      <div>
        <label htmlFor="direccion" className={label}>
          Dirección o punto de referencia <span className="font-normal text-(--color-muted)">(opcional)</span>
        </label>
        <input id="direccion" value={addressText} onChange={(e) => setAddressText(e.target.value)} className={field} />
      </div>

      <div>
        <label htmlFor="personas" className={label}>
          ¿Cuántas personas son? <span className="font-normal text-(--color-muted)">(opcional)</span>
        </label>
        <input
          id="personas"
          value={peopleCount}
          onChange={(e) => setPeopleCount(e.target.value.replace(/\D/g, ''))}
          type="text"
          inputMode="numeric"
          maxLength={3}
          className={field}
        />
      </div>

      <div>
        <label htmlFor="nombre" className={label}>Tu nombre</label>
        <input id="nombre" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} autoComplete="name" className={field} required />
      </div>

      <div>
        <label htmlFor="whatsapp" className={label}>Tu WhatsApp</label>
        <input
          id="whatsapp"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="300 123 4567"
          className={field}
          required
        />
        <p className="mt-1 text-sm text-(--color-muted)">
          No se muestra en la lista. Solo lo ve quien pulse el botón de contactarte.
        </p>
      </div>

      {/* Campo trampa: invisible para personas, tentador para bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor="website">No llenar</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {/* Todo el bloque es un <label>, no solo el texto: el objetivo táctil
          real del checkbox (24 px) queda muy por debajo de los 44 px mínimos
          del sistema de diseño, así que se agranda envolviendo toda la fila. */}
      <label
        htmlFor="privacidad"
        className="flex min-h-[44px] cursor-pointer gap-3 rounded-lg bg-slate-50 p-4"
      >
        <input
          id="privacidad"
          type="checkbox"
          checked={acceptsPrivacy}
          onChange={(e) => setAcceptsPrivacy(e.target.checked)}
          className="mt-1 h-6 w-6 shrink-0 cursor-pointer"
          required
        />
        <span className="text-sm text-(--color-secondary)">
          Autorizo publicar mi nombre, mi ubicación y lo que necesito, y que mi número
          de WhatsApp se entregue a quien quiera ayudarme. Puedo pedir que se borre
          cuando quiera. Leer la{' '}
          <Link href="/privacidad" className="cursor-pointer font-semibold text-(--color-cta) underline">
            política de datos
          </Link>.
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-(--color-urgente-soft) p-3 text-base font-semibold text-(--color-urgente)">
          {error}
        </p>
      )}

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Publicando…' : 'Publicar solicitud'}
      </Button>
    </form>
  )
}
