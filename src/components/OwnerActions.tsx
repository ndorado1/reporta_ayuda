'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { Button } from './ui/Button'

type Result = { ok: true } | { ok: false; error: string }
type Action = (code: string, token: string) => Promise<Result>

export function OwnerActions({
  code,
  token,
  status,
  onFulfill,
  onCancel,
}: {
  code: string
  token: string
  status: string
  onFulfill: Action
  onCancel: Action
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState<'fulfill' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'atendida' || status === 'cancelada') return null

  async function run(action: Action) {
    setBusy(true)
    setError(null)
    const result = await action(code, token)
    if (result.ok) {
      setConfirming(null)
      router.refresh()
    } else {
      setError(result.error)
    }
    setBusy(false)
  }

  return (
    <div className="rounded-xl border-2 border-(--color-cta) bg-sky-50 p-4">
      <h2 className="text-base font-bold text-(--color-primary)">Administrar mi solicitud</h2>

      {confirming === null && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => setConfirming('fulfill')} className="flex-1">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
            Ya recibí la ayuda
          </Button>
          <Button variant="danger" onClick={() => setConfirming('cancel')} className="flex-1">
            <Trash2 aria-hidden="true" className="h-5 w-5" />
            Cancelar solicitud
          </Button>
        </div>
      )}

      {confirming && (
        <div className="mt-3">
          <p className="font-medium text-(--color-secondary)">
            {confirming === 'fulfill'
              ? '¿Confirmas que ya recibiste lo que necesitabas? La solicitud saldrá del mapa.'
              : '¿Confirmas que quieres cancelar? Ya nadie podrá verla.'}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => run(confirming === 'fulfill' ? onFulfill : onCancel)}
              disabled={busy}
              className="flex-1"
            >
              {busy ? 'Guardando…' : 'Sí, confirmar'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(null)} className="flex-1">
              No
            </Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm font-semibold text-(--color-urgente)">{error}</p>}
    </div>
  )
}
