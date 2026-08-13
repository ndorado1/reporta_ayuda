import Link from 'next/link'
import { MapPin, Navigation } from 'lucide-react'
import { UrgencyBadge } from './ui/UrgencyBadge'
import { StatusBadge } from './ui/StatusBadge'
import { WhatsAppButton } from './WhatsAppButton'
import { ClaimButton } from './ClaimButton'
import type { RequestListItem } from '@/lib/requests'

export function RequestCard({ item }: { item: RequestListItem }) {
  const remaining = item.itemCount - item.itemsPreview.length

  return (
    <article className="rounded-xl border border-(--color-line) bg-white p-4 shadow-sm transition-colors duration-150 hover:border-(--color-cta)">
      <div className="flex flex-wrap items-center gap-2">
        <UrgencyBadge urgency={item.urgency} />
        <StatusBadge status={item.status} claimedBy={item.claimedBy} />
      </div>

      <h2 className="mt-3 text-lg font-bold leading-snug text-(--color-primary)">
        <Link href={`/s/${item.publicCode}`} className="cursor-pointer hover:underline">
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

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <WhatsAppButton code={item.publicCode} className="flex-1" />
        {item.status === 'abierta' && (
          <div className="flex-1">
            <ClaimButton code={item.publicCode} />
          </div>
        )}
      </div>
    </article>
  )
}
