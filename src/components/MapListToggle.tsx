'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { List, Map as MapIcon } from 'lucide-react'

export function MapListToggle({ current }: { current: 'lista' | 'mapa' }) {
  const router = useRouter()
  const params = useSearchParams()

  function go(view: 'lista' | 'mapa') {
    const next = new URLSearchParams(params.toString())
    if (view === 'mapa') next.set('vista', 'mapa')
    else next.delete('vista')
    router.push(`?${next.toString()}`)
  }

  const base = 'flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 font-semibold transition-colors duration-150'

  return (
    <div role="group" aria-label="Cambiar vista" className="flex gap-2 rounded-xl bg-slate-100 p-1">
      <button
        type="button"
        onClick={() => go('lista')}
        aria-pressed={current === 'lista'}
        className={`${base} ${current === 'lista' ? 'bg-white text-[--color-primary] shadow-sm' : 'text-[--color-muted]'}`}
      >
        <List aria-hidden="true" className="h-5 w-5" /> Lista
      </button>
      <button
        type="button"
        onClick={() => go('mapa')}
        aria-pressed={current === 'mapa'}
        className={`${base} ${current === 'mapa' ? 'bg-white text-[--color-primary] shadow-sm' : 'text-[--color-muted]'}`}
      >
        <MapIcon aria-hidden="true" className="h-5 w-5" /> Mapa
      </button>
    </div>
  )
}
