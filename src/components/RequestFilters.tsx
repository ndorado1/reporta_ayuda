'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

const URGENCIES = [
  { value: '', label: 'Cualquier urgencia' },
  { value: 'alta', label: 'Urgencia alta' },
  { value: 'media', label: 'Urgencia media' },
  { value: 'baja', label: 'Urgencia baja' },
]

const STATUSES = [
  { value: '', label: 'Activas' },
  { value: 'atendida', label: 'Ya atendidas' },
]

export function RequestFilters() {
  const router = useRouter()
  const params = useSearchParams()

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`?${next.toString()}`)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[--color-muted]" />
        <label htmlFor="buscar" className="sr-only">Buscar por necesidad o barrio</label>
        <input
          id="buscar"
          type="search"
          defaultValue={params.get('buscar') ?? ''}
          onChange={(e) => update('buscar', e.target.value)}
          placeholder="Buscar por barrio o necesidad"
          className="min-h-[44px] w-full rounded-lg border border-[--color-line] bg-white pl-10 pr-3 text-base"
        />
      </div>

      <label htmlFor="urgencia" className="sr-only">Urgencia</label>
      <select
        id="urgencia"
        value={params.get('urgencia') ?? ''}
        onChange={(e) => update('urgencia', e.target.value)}
        className="min-h-[44px] cursor-pointer rounded-lg border border-[--color-line] bg-white px-3 text-base"
      >
        {URGENCIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <label htmlFor="estado" className="sr-only">Estado</label>
      <select
        id="estado"
        value={params.get('estado') ?? ''}
        onChange={(e) => update('estado', e.target.value)}
        className="min-h-[44px] cursor-pointer rounded-lg border border-[--color-line] bg-white px-3 text-base"
      >
        {STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
