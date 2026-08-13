'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Frontera de error de todo el árbol de rutas. Sin este archivo, cualquier
 * fallo no controlado (por ejemplo un parámetro de la URL que llega mal
 * formado hasta una consulta y revienta con un error de Postgres) cae en la
 * pantalla genérica de Next.js, en inglés, sin forma de reintentar — y
 * alguien que comparte un enlace editado a mano en un grupo de WhatsApp cree
 * que la plataforma entera se cayó.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <AlertTriangle aria-hidden="true" className="mx-auto h-10 w-10 text-(--color-urgente)" />
      <h1 className="text-xl font-bold text-(--color-primary)">Algo salió mal</h1>
      <p className="text-(--color-secondary)">
        No pudimos cargar esta página. Puede ser un problema pasajero: intenta de nuevo
        en un momento.
      </p>
      <Button onClick={reset} className="mx-auto">
        Reintentar
      </Button>
    </div>
  )
}
