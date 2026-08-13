'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './ui/Button'
import { cancelClaimAction } from '@/app/actions'

/** Solo aparece si este navegador guardó el token del claim. */
export function CancelClaimButton({ code }: { code: string }) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // localStorage no existe durante el render en el servidor: el efecto
    // pospone la lectura al montaje para no romper la hidratación. Es el
    // caso legítimo de "sincronizar con un sistema externo" que la regla
    // de abajo no distingue de una cascada de renders evitable.
    try {
      const raw = localStorage.getItem('reporta-cali:claims')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(raw ? (JSON.parse(raw)[code] ?? null) : null)
    } catch {
      setToken(null)
    }
  }, [code])

  if (!token) return null

  async function cancel() {
    setBusy(true)
    setError(null)
    // try/catch/finally: sin esto, un corte de red deja "busy" en true para
    // siempre y el botón se congela en "Cancelando…" sin forma de reintentar
    // salvo recargar.
    try {
      const result = await cancelClaimAction(code, token!)
      if (result.ok) router.refresh()
      else setError(result.error)
    } catch {
      setError('No pudimos guardar el cambio. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Button variant="secondary" onClick={cancel} disabled={busy} className="w-full">
        {busy ? 'Cancelando…' : 'Ya no puedo ir'}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-(--color-urgente)">{error}</p>}
    </div>
  )
}
