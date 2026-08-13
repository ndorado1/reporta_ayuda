import { NextResponse } from 'next/server'
import { listEvents } from '@/lib/events'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const citySlug = url.searchParams.get('ciudad') || undefined
  const sinceId = url.searchParams.get('desde') || undefined

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
