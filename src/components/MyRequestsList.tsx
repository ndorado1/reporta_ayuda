'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { listMyRequests, type MyRequest } from '@/lib/my-requests'

export function MyRequestsList() {
  const [items, setItems] = useState<MyRequest[] | null>(null)

  useEffect(() => {
    // localStorage no existe durante el render en el servidor: el efecto
    // pospone la lectura al montaje para no romper la hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(listMyRequests())
  }, [])

  if (items === null) {
    return <p className="text-(--color-muted)">Cargando…</p>
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-(--color-line) bg-white p-6 text-center">
        <p className="text-(--color-secondary)">
          En este navegador no hay solicitudes guardadas.
        </p>
        <p className="mt-2 text-sm text-(--color-muted)">
          Si publicaste una desde otro teléfono, ábrela con el enlace que guardaste.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.publicCode} className="rounded-xl border border-(--color-line) bg-white p-4">
          <p className="font-semibold text-(--color-primary)">{item.title}</p>
          <p className="mt-1 text-sm text-(--color-muted)">
            Publicada el {new Date(item.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
          </p>
          <Link
            href={`/s/${item.publicCode}?t=${item.manageToken}`}
            className="mt-3 inline-flex cursor-pointer items-center gap-2 font-semibold text-(--color-cta) underline"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            Administrar
          </Link>
        </li>
      ))}
    </ul>
  )
}
