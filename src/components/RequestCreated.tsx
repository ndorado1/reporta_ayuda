'use client'

import Link from 'next/link'
import { CheckCircle2, Copy, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/Button'
import { buildWhatsAppLink, normalizePhone } from '@/lib/whatsapp'

export function RequestCreated({
  publicCode,
  manageToken,
  whatsapp,
  title,
}: {
  publicCode: string
  manageToken: string
  whatsapp: string
  title: string
}) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/s/${publicCode}?t=${manageToken}`

  const phone = normalizePhone(whatsapp)
  const selfLink = phone
    ? buildWhatsAppLink(phone, `Enlace para administrar mi solicitud "${title}" en Reporta Cali: ${url}`)
    : null

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-[--color-line] bg-white p-5">
      <div className="flex items-center gap-3">
        <CheckCircle2 aria-hidden="true" className="h-8 w-8 shrink-0 text-[--color-baja]" />
        <h1 className="text-xl font-bold text-[--color-primary]">Tu solicitud ya está publicada</h1>
      </div>

      <div className="rounded-lg bg-[--color-media-soft] p-4">
        <p className="font-semibold text-[--color-media]">Guarda este enlace</p>
        <p className="mt-1 text-sm text-[--color-secondary]">
          Es la única forma de marcar tu solicitud como atendida o de borrarla.
          Si borras los datos del navegador, lo pierdes.
        </p>
        <p className="mt-3 break-all rounded-md bg-white p-3 font-mono text-sm">{url}</p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={copy} className="flex-1">
            <Copy aria-hidden="true" className="h-5 w-5" />
            {copied ? 'Copiado' : 'Copiar enlace'}
          </Button>
          {selfLink && (
            <a href={selfLink} className="flex-1">
              <Button type="button" variant="whatsapp" className="w-full">
                <MessageCircle aria-hidden="true" className="h-5 w-5" />
                Enviármelo por WhatsApp
              </Button>
            </a>
          )}
        </div>
      </div>

      <Link href={`/s/${publicCode}`} className="block cursor-pointer text-center font-semibold text-[--color-cta] underline">
        Ver mi solicitud publicada
      </Link>
    </div>
  )
}
