'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { reportAction } from '@/app/actions'

export function ReportButton({ code }: { code: string }) {
  const [done, setDone] = useState(false)
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(false)

  if (done) {
    return <p className="text-sm text-(--color-muted)">Gracias. Lo revisaremos.</p>
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 text-sm text-(--color-muted) underline transition-colors duration-150 hover:text-(--color-urgente)"
      >
        <Flag aria-hidden="true" className="h-4 w-4" />
        Reportar
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`motivo-${code}`} className="block text-sm font-semibold">
        ¿Qué problema tiene?
      </label>
      <input
        id={`motivo-${code}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="min-h-[44px] w-full rounded-lg border border-(--color-line) px-3 text-base"
      />
      <button
        type="button"
        onClick={async () => {
          await reportAction(code, reason)
          setDone(true)
        }}
        className="min-h-[44px] cursor-pointer rounded-lg border-2 border-(--color-urgente) px-3 font-semibold text-(--color-urgente)"
      >
        Enviar reporte
      </button>
    </div>
  )
}
