import { NextResponse } from 'next/server'
import { listEvents } from '@/lib/events'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const url = new URL(request.url)
  const citySlug = url.searchParams.get('ciudad') || undefined
  const desde = url.searchParams.get('desde')
  // Un "desde" malformado no debe tumbar la campanita: se ignora el
  // filtro y se cuenta/lista todo, igual que cuando el id no existe.
  const sinceId = desde && UUID_RE.test(desde) ? desde : undefined

  const events = await listEvents({ citySlug, sinceId, limit: 30 })

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.payload.title,
      neighborhood: e.payload.neighborhood,
      city: e.payload.city,
      createdAt: e.createdAt,
    })),
  })
}
