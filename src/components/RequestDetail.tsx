'use client'

import { MapPin, Users, Clock } from 'lucide-react'
import { UrgencyBadge } from './ui/UrgencyBadge'
import { StatusBadge } from './ui/StatusBadge'
import { WhatsAppButton } from './WhatsAppButton'
import { ClaimButton } from './ClaimButton'
import { CancelClaimButton } from './CancelClaimButton'
import { OwnerActions } from './OwnerActions'
// `ssr: false` vive dentro de RequestMapLazy (Client Component), igual que en
// la pantalla de inicio: se reutiliza el mismo envoltorio en vez de duplicar
// el `next/dynamic`.
import RequestMap from './RequestMapLazy'
import { fulfillAction, cancelRequestAction } from '@/app/actions'
import type { RequestDetail as Detail } from '@/lib/requests'

export function RequestDetail({ detail, token }: { detail: Detail; token: string | null }) {
  return (
    <article className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <UrgencyBadge urgency={detail.urgency} />
        <StatusBadge status={detail.status} claimedBy={detail.claimedBy} />
      </div>

      <h1 className="text-2xl font-bold leading-tight text-(--color-primary)">{detail.title}</h1>

      {detail.description && <p className="text-(--color-secondary)">{detail.description}</p>}

      <dl className="grid gap-2 text-(--color-muted) sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <MapPin aria-hidden="true" className="h-5 w-5 shrink-0" />
          <dt className="sr-only">Ubicación</dt>
          <dd>
            {detail.addressText ? `${detail.addressText}. ` : ''}
            {detail.neighborhood ? `${detail.neighborhood}, ` : ''}{detail.cityName}
          </dd>
        </div>
        {detail.peopleCount && (
          <div className="flex items-center gap-2">
            <Users aria-hidden="true" className="h-5 w-5 shrink-0" />
            <dt className="sr-only">Personas</dt>
            <dd>{detail.peopleCount} personas</dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock aria-hidden="true" className="h-5 w-5 shrink-0" />
          <dt className="sr-only">Publicada</dt>
          <dd>
            Publicada el{' '}
            {new Date(detail.createdAt).toLocaleDateString('es-CO', {
              day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
            })}
          </dd>
        </div>
      </dl>

      <section>
        <h2 className="text-lg font-bold text-(--color-primary)">Lo que necesitan</h2>
        <ul className="mt-2 divide-y divide-(--color-line) rounded-xl border border-(--color-line) bg-white">
          {detail.items.map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium text-(--color-ink)">{item.name}</span>
              {item.quantity && <span className="text-(--color-muted)">{item.quantity}</span>}
            </li>
          ))}
        </ul>
      </section>

      <RequestMap
        items={[{
          publicCode: detail.publicCode, title: detail.title, urgency: detail.urgency,
          neighborhood: detail.neighborhood, lat: detail.lat, lng: detail.lng,
        }]}
        center={{ lat: detail.lat, lng: detail.lng }}
        zoom={16}
      />

      {detail.status !== 'atendida' && detail.status !== 'cancelada' && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <WhatsAppButton code={detail.publicCode} className="flex-1" />
          <div className="flex-1">
            {detail.status === 'abierta'
              ? <ClaimButton code={detail.publicCode} />
              : <CancelClaimButton code={detail.publicCode} />}
          </div>
        </div>
      )}

      {detail.canManage && token && (
        <OwnerActions
          code={detail.publicCode}
          token={token}
          status={detail.status}
          detail={detail}
          onFulfill={fulfillAction}
          onCancel={cancelRequestAction}
        />
      )}
    </article>
  )
}
