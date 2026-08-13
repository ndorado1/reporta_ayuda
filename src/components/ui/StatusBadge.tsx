import { CircleDot, CheckCircle2, Truck, Archive, XCircle } from 'lucide-react'
import type { RequestStatus } from '@/lib/requests'

export function StatusBadge({
  status,
  claimedBy,
}: {
  status: RequestStatus
  claimedBy?: string | null
}) {
  const map = {
    abierta: { label: 'Sin atender', className: 'bg-slate-100 text-[--color-secondary]', Icon: CircleDot },
    en_atencion: {
      label: claimedBy ? `${claimedBy} va en camino` : 'Alguien va en camino',
      className: 'bg-sky-50 text-[--color-cta]',
      Icon: Truck,
    },
    atendida: { label: 'Atendida', className: 'bg-[--color-baja-soft] text-[--color-baja]', Icon: CheckCircle2 },
    cancelada: { label: 'Cancelada', className: 'bg-slate-100 text-[--color-muted]', Icon: XCircle },
    archivada: { label: 'Archivada', className: 'bg-slate-100 text-[--color-muted]', Icon: Archive },
  }[status]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${map.className}`}>
      <map.Icon aria-hidden="true" className="h-4 w-4" />
      {map.label}
    </span>
  )
}
