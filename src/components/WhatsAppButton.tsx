'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from './ui/Button'

export function WhatsAppButton({ code, className = '' }: { code: string; className?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function contact() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/requests/${code}/contact`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo abrir WhatsApp')
      // Navegación directa: window.open tras un await suele bloquearse.
      window.location.href = body.link
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir WhatsApp')
      setLoading(false)
    }
  }

  return (
    <div className={className}>
      <Button variant="whatsapp" onClick={contact} disabled={loading} className="w-full">
        <MessageCircle aria-hidden="true" className="h-5 w-5" />
        {loading ? 'Abriendo…' : 'Contactar por WhatsApp'}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-[--color-urgente]">{error}</p>
      )}
    </div>
  )
}
