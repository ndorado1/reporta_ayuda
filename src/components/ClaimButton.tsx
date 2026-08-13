'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Truck } from 'lucide-react'
import { Button } from './ui/Button'
import { claimAction } from '@/app/actions'

export function ClaimButton({ code }: { code: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    setError(null)
    const result = await claimAction({ publicCode: code, volunteerName: name })
    if (result.ok) {
      try {
        const raw = localStorage.getItem('reporta-cali:claims')
        const claims = raw ? JSON.parse(raw) : {}
        claims[code] = result.claimToken
        localStorage.setItem('reporta-cali:claims', JSON.stringify(claims))
      } catch {
        // Sin almacenamiento no podrá cancelar, pero el claim ya quedó hecho.
      }
      setOpen(false)
      router.refresh()
    } else {
      setError(result.error)
    }
    setSaving(false)
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
        <Truck aria-hidden="true" className="h-5 w-5" />
        Voy en camino
      </Button>
    )
  }

  return (
    <div className="rounded-lg border border-(--color-line) bg-white p-3">
      <label htmlFor={`nombre-${code}`} className="block text-sm font-semibold text-(--color-secondary)">
        Tu nombre
      </label>
      <input
        id={`nombre-${code}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        className="mt-1 min-h-[44px] w-full rounded-lg border border-(--color-line) px-3 text-base"
      />
      {error && <p role="alert" className="mt-2 text-sm font-medium text-(--color-urgente)">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button onClick={submit} disabled={saving || name.trim().length < 2} className="flex-1">
          {saving ? 'Guardando…' : 'Confirmar'}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
          Cancelar
        </Button>
      </div>
    </div>
  )
}
