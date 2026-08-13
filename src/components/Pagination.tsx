'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const BASE = 'flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-4 font-semibold transition-colors duration-150'
const ENABLED = 'cursor-pointer bg-white text-(--color-primary) border-2 border-(--color-primary) hover:bg-slate-50'
const DISABLED = 'cursor-not-allowed bg-slate-100 text-(--color-muted)'

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const params = useSearchParams()

  // Conserva ciudad, urgencia, estado, búsqueda y vista: solo cambia "pagina".
  function hrefFor(target: number) {
    const next = new URLSearchParams(params.toString())
    if (target <= 1) next.delete('pagina')
    else next.set('pagina', String(target))
    const qs = next.toString()
    return qs ? `?${qs}` : '?'
  }

  if (totalPages <= 1) return null

  return (
    <nav aria-label="Paginación de solicitudes" className="flex items-center justify-between gap-3 pt-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={`${BASE} ${ENABLED}`}>
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          Anterior
        </Link>
      ) : (
        <span aria-disabled="true" className={`${BASE} ${DISABLED}`}>
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          Anterior
        </span>
      )}

      <span className="text-sm font-medium text-(--color-muted)">
        Página {page} de {totalPages}
      </span>

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={`${BASE} ${ENABLED}`}>
          Siguiente
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </Link>
      ) : (
        <span aria-disabled="true" className={`${BASE} ${DISABLED}`}>
          Siguiente
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </span>
      )}
    </nav>
  )
}
