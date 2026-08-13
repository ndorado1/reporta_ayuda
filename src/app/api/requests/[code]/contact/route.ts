import { NextResponse } from 'next/server'
import { getContactPhone } from '@/lib/requests'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import { consumeRate } from '@/lib/ratelimit'
import { getClientIp } from '@/lib/request-ip'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const ip = getClientIp(request.headers)

  // Aquí el límite sí bloquea: es la defensa contra la recolección masiva
  // de números, no contra alguien que pide ayuda.
  const rate = await consumeRate(ip, 'contact')
  if (rate.exceeded) {
    return NextResponse.json(
      { error: 'Demasiadas consultas seguidas. Espera unos minutos.' },
      { status: 429 }
    )
  }

  const contact = await getContactPhone(code)
  if (!contact) {
    return NextResponse.json({ error: 'Esta solicitud ya no está disponible' }, { status: 404 })
  }

  const message = `Hola, te escribo por la solicitud "${contact.title}" que publicaste en Reporta Cali. ¿Todavía necesitas ayuda?`
  return NextResponse.json({ link: buildWhatsAppLink(contact.phone, message) })
}
