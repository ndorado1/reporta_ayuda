import { Suspense } from 'react'
import { listRequests, type RequestStatus, type Urgency } from '@/lib/requests'
import { RequestCard } from '@/components/RequestCard'
import { RequestFilters } from '@/components/RequestFilters'
import { EmptyState } from '@/components/EmptyState'
import { MapListToggle } from '@/components/MapListToggle'
// Leaflet toca window: nunca en el servidor. Además así no pesa en la
// carga inicial de quien solo quiere la lista. El `next/dynamic` con
// `ssr: false` vive dentro de RequestMapLazy (Client Component): Next.js no
// permite esa opción directamente en un Server Component como esta página.
import RequestMap from '@/components/RequestMapLazy'
import { getCityBySlug } from '@/lib/cities'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ciudad?: string; urgencia?: string; estado?: string; buscar?: string; vista?: string }>
}) {
  const params = await searchParams
  const citySlug = params.ciudad && params.ciudad !== 'todas' ? params.ciudad : undefined

  const items = await listRequests({
    citySlug,
    urgency: params.urgencia as Urgency | undefined,
    statuses: params.estado ? ([params.estado] as RequestStatus[]) : undefined,
    search: params.buscar || undefined,
  })

  const view = params.vista === 'mapa' ? 'mapa' : 'lista'
  const city = citySlug ? await getCityBySlug(citySlug) : null
  const center = city
    ? { lat: city.centerLat, lng: city.centerLng }
    : { lat: 3.4516, lng: -76.532 } // Cali por defecto
  const zoom = city?.defaultZoom ?? 8

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-(--color-primary)">
          Solicitudes de ayuda
        </h1>
        <p className="mt-1 text-(--color-muted)">
          {items.length === 0
            ? 'No hay solicitudes con estos filtros.'
            : `${items.length} ${items.length === 1 ? 'solicitud' : 'solicitudes'}.`}
        </p>
      </div>

      {/* useSearchParams solo suspende bajo un build de producción; sin esta
          frontera, `npm run build` falla con el mismo error que ya apareció
          con CitySelect en la cabecera. */}
      <Suspense fallback={null}>
        <RequestFilters />
      </Suspense>

      {/* MapListToggle también usa useSearchParams: misma razón que arriba. */}
      <Suspense fallback={null}>
        <MapListToggle current={view} />
      </Suspense>

      {items.length === 0 ? (
        <EmptyState message="Nadie ha publicado una solicitud con estos filtros todavía." />
      ) : view === 'mapa' ? (
        <RequestMap items={items} center={center} zoom={zoom} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.publicCode}>
              <RequestCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
