import { Suspense } from 'react'
import { listRequests, listRequestsForMap, PAGE_SIZE } from '@/lib/requests'
import { parseUrgency, parseStatuses, parsePage } from '@/lib/list-params'
import { RequestCard } from '@/components/RequestCard'
import { RequestFilters } from '@/components/RequestFilters'
import { EmptyState } from '@/components/EmptyState'
import { MapListToggle } from '@/components/MapListToggle'
import { Pagination } from '@/components/Pagination'
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
  searchParams: Promise<{
    ciudad?: string
    urgencia?: string
    estado?: string
    buscar?: string
    vista?: string
    pagina?: string
  }>
}) {
  const params = await searchParams
  const citySlug = params.ciudad && params.ciudad !== 'todas' ? params.ciudad : undefined
  const view = params.vista === 'mapa' ? 'mapa' : 'lista'

  const filters = {
    citySlug,
    urgency: parseUrgency(params.urgencia),
    statuses: parseStatuses(params.estado),
    search: params.buscar || undefined,
  }

  let page = parsePage(params.pagina)
  let { items, total } = await listRequests({ ...filters, page })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Una página fuera de rango (enlace viejo, número editado a mano) no debe
  // ser un callejón sin salida: sin este ajuste, `items` llega vacío y la
  // rama del `else` de abajo no trae los controles de paginación porque solo
  // viven junto a la lista, así que no habría forma de volver.
  if (page > totalPages) {
    page = totalPages
    ;({ items, total } = await listRequests({ ...filters, page }))
  }

  // El mapa es la vía principal del voluntario y no se pagina (ver spec):
  // paseársela página por página es mala interacción, así que trae su propio
  // conjunto completo en vez de reusar los 50 de `items`.
  const mapItems = view === 'mapa' ? await listRequestsForMap(filters) : []

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
          {total === 0
            ? 'No hay solicitudes con estos filtros.'
            : `${total} ${total === 1 ? 'solicitud' : 'solicitudes'}.`}
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

      {view === 'mapa' ? (
        mapItems.length === 0 ? (
          <EmptyState message="Nadie ha publicado una solicitud con estos filtros todavía." />
        ) : (
          <RequestMap items={mapItems} center={center} zoom={zoom} />
        )
      ) : items.length === 0 ? (
        <EmptyState message="Nadie ha publicado una solicitud con estos filtros todavía." />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.publicCode}>
                <RequestCard item={item} />
              </li>
            ))}
          </ul>
          <Suspense fallback={null}>
            <Pagination page={page} totalPages={totalPages} />
          </Suspense>
        </>
      )}
    </div>
  )
}
