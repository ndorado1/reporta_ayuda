import { Suspense } from 'react'
import { listRequests, type RequestStatus, type Urgency } from '@/lib/requests'
import { RequestCard } from '@/components/RequestCard'
import { RequestFilters } from '@/components/RequestFilters'
import { EmptyState } from '@/components/EmptyState'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ciudad?: string; urgencia?: string; estado?: string; buscar?: string }>
}) {
  const params = await searchParams
  const citySlug = params.ciudad && params.ciudad !== 'todas' ? params.ciudad : undefined

  const items = await listRequests({
    citySlug,
    urgency: params.urgencia as Urgency | undefined,
    statuses: params.estado ? ([params.estado] as RequestStatus[]) : undefined,
    search: params.buscar || undefined,
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[--color-primary]">
          Solicitudes de ayuda
        </h1>
        <p className="mt-1 text-[--color-muted]">
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

      {items.length === 0 ? (
        <EmptyState message="Nadie ha publicado una solicitud con estos filtros todavía." />
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
