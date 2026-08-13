'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Bell, X, PackageCheck, Truck, AlertCircle } from 'lucide-react'
import { countUnseen, getLastSeenEventId, setLastSeenEventId } from '@/lib/notifications'

type FeedEvent = {
  id: string
  type: 'request_created' | 'request_claimed' | 'request_fulfilled'
  title: string
  neighborhood: string | null
  city: string
  createdAt: string
}

const POLL_MS = 30_000

const DESCRIPTIONS = {
  request_created: { text: 'Nueva solicitud', Icon: AlertCircle, className: 'text-(--color-urgente)' },
  request_claimed: { text: 'Alguien va en camino', Icon: Truck, className: 'text-(--color-cta)' },
  request_fulfilled: { text: 'Solicitud atendida', Icon: PackageCheck, className: 'text-(--color-baja)' },
}

export function NotificationBell() {
  const params = useSearchParams()
  const citySlug = params.get('ciudad')

  const [events, setEvents] = useState<FeedEvent[]>([])
  const [open, setOpen] = useState(false)
  const [unseen, setUnseen] = useState(0)

  const load = useCallback(async () => {
    try {
      const query = citySlug && citySlug !== 'todas' ? `?ciudad=${citySlug}` : ''
      const res = await fetch(`/api/events${query}`)
      if (!res.ok) return
      const body = await res.json()
      setEvents(body.events)
      setUnseen(countUnseen(body.events, getLastSeenEventId()))
    } catch {
      // Sin red no pasa nada: se reintenta en el siguiente ciclo.
    }
  }, [citySlug])

  useEffect(() => {
    // Carga inicial y sondeo periódico: `load` actualiza el estado de forma
    // asíncrona (después del fetch), no de forma síncrona en el cuerpo del
    // efecto, por lo que este patrón es el recomendado para sincronizar con
    // un sistema externo (la API).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // Solo sondea con la pestaña visible: ahorra batería y datos.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && events[0]) {
      setLastSeenEventId(events[0].id)
      setUnseen(0)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={unseen > 0 ? `Novedades: ${unseen} sin leer` : 'Novedades'}
        aria-expanded={open}
        className="relative flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg border border-(--color-line) bg-white transition-colors duration-150 hover:border-(--color-cta)"
      >
        <Bell aria-hidden="true" className="h-5 w-5 text-(--color-secondary)" />
        {unseen > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[22px] rounded-full bg-(--color-urgente) px-1.5 text-sm font-bold leading-[22px] text-white">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <aside
            role="dialog"
            aria-label="Novedades"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-sm overflow-y-auto bg-white p-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-(--color-primary)">Novedades</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar novedades"
                className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-(--color-muted) transition-colors duration-150 hover:text-(--color-ink)"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <p role="status" className="sr-only">
              {unseen > 0 ? `${unseen} novedades sin leer` : 'Sin novedades nuevas'}
            </p>

            {events.length === 0 ? (
              <p className="mt-6 text-(--color-muted)">Todavía no hay movimientos.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {events.map((event) => {
                  const info = DESCRIPTIONS[event.type]
                  return (
                    <li key={event.id} className="border-b border-(--color-line) pb-3 last:border-0">
                      <p className={`flex items-center gap-2 text-sm font-semibold ${info.className}`}>
                        <info.Icon aria-hidden="true" className="h-4 w-4" />
                        {info.text}
                      </p>
                      <p className="mt-1 font-medium text-(--color-ink)">{event.title}</p>
                      <p className="text-sm text-(--color-muted)">
                        {event.neighborhood ? `${event.neighborhood}, ` : ''}{event.city}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}

            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="mt-6 block cursor-pointer text-center font-semibold text-(--color-cta) underline"
            >
              Ver todas las solicitudes
            </Link>
          </aside>
        </div>
      )}
    </>
  )
}
