import Link from 'next/link'
import { MapPin, Navigation } from 'lucide-react'
import { UrgencyBadge } from './ui/UrgencyBadge'
import { StatusBadge } from './ui/StatusBadge'
import { WhatsAppButton } from './WhatsAppButton'
import { ClaimButton } from './ClaimButton'
import { ReportButton } from './ReportButton'
import type { RequestListItem } from '@/lib/requests'

export function RequestCard({ item }: { item: RequestListItem }) {
  const remaining = item.itemCount - item.itemsPreview.length

  return (
    <article className="relative rounded-xl border border-(--color-line) bg-white p-4 shadow-sm transition-colors duration-150 hover:border-(--color-cta)">
      <div className="flex flex-wrap items-center gap-2">
        <UrgencyBadge urgency={item.urgency} />
        <StatusBadge status={item.status} claimedBy={item.claimedBy} />
      </div>

      <h2 className="mt-3 text-lg font-bold leading-snug text-(--color-primary)">
        {/* Toda la tarjeta abre el detalle, pero envolverla entera en un
            enlace no vale: dentro hay botones, y un botón dentro de un enlace
            es HTML inválido y deja de responder al pulsarlo.
            En su lugar el enlace del título proyecta una capa transparente
            sobre la tarjeta completa. Sigue siendo un solo enlace: al navegar
            con teclado se tabula una vez, y un lector de pantalla lee el
            título como destino en vez de "enlace, enlace, enlace". */}
        <Link
          href={`/s/${item.publicCode}`}
          className="cursor-pointer after:absolute after:inset-0 after:content-[''] hover:underline"
        >
          {item.title}
        </Link>
      </h2>

      <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-(--color-muted)">
        <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
        {item.neighborhood ? `${item.neighborhood}, ` : ''}{item.cityName}
        {item.distanceKm !== undefined && (
          <span className="ml-2 inline-flex items-center gap-1">
            <Navigation aria-hidden="true" className="h-4 w-4" />
            a {item.distanceKm.toFixed(1).replace('.', ',')} km
          </span>
        )}
      </p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {item.itemsPreview.map((name) => (
          <li key={name} className="rounded-md bg-slate-100 px-2 py-1 text-sm font-medium text-(--color-secondary)">
            {name}
          </li>
        ))}
        {remaining > 0 && (
          <li className="rounded-md px-2 py-1 text-sm font-medium text-(--color-muted)">
            y {remaining} más
          </li>
        )}
      </ul>

      {/* `relative z-10` en los dos bloques de acciones: quedan por encima de
          la capa del enlace, que si no se los tragaría y pulsar "Contactar
          por WhatsApp" llevaría al detalle. */}
      <div className="relative z-10 mt-4 flex flex-col gap-2 sm:flex-row">
        <WhatsAppButton code={item.publicCode} className="flex-1" />
        {item.status === 'abierta' && (
          <div className="flex-1">
            <ClaimButton code={item.publicCode} />
          </div>
        )}
      </div>

      <div className="relative z-10 mt-3 inline-block">
        <ReportButton code={item.publicCode} />
      </div>
    </article>
  )
}
