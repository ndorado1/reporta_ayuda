import { AlertTriangle, ArrowDown, Clock } from 'lucide-react'
import type { Urgency } from '@/lib/requests'

// Icono + texto además del color: bajo el sol, o con daltonismo,
// el tono por sí solo no distingue nada.
const STYLES: Record<Urgency, { label: string; className: string; Icon: typeof Clock }> = {
  alta: {
    label: 'Urgencia alta',
    className: 'bg-(--color-urgente-soft) text-(--color-urgente)',
    Icon: AlertTriangle,
  },
  media: {
    label: 'Urgencia media',
    className: 'bg-(--color-media-soft) text-(--color-media)',
    Icon: Clock,
  },
  baja: {
    label: 'Urgencia baja',
    className: 'bg-(--color-baja-soft) text-(--color-baja)',
    Icon: ArrowDown,
  },
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const { label, className, Icon } = STYLES[urgency]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${className}`}>
      <Icon aria-hidden="true" className="h-4 w-4" />
      {label}
    </span>
  )
}
