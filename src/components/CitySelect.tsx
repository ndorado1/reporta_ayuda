'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { ALL_CITIES, CITY_STORAGE_KEY } from '@/lib/city-preference'

type Option = { slug: string; name: string }

export function CitySelect({ cities }: { cities: Option[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // El layout raíz no recibe searchParams en el App Router, así que la
  // ciudad activa se lee aquí, en el cliente.
  const activeSlug = searchParams.get('ciudad') ?? ALL_CITIES

  function onChange(value: string) {
    try {
      localStorage.setItem(CITY_STORAGE_KEY, value)
    } catch {
      // Modo incógnito o almacenamiento bloqueado: seguimos con la URL.
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('ciudad', value)
    router.push(`?${params.toString()}`)
  }

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-[--color-secondary]">
      <MapPin aria-hidden="true" className="h-5 w-5 shrink-0" />
      <span className="sr-only">Ciudad</span>
      <select
        value={activeSlug}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] cursor-pointer rounded-lg border border-[--color-line] bg-white px-3 py-2 text-base font-semibold text-[--color-ink] transition-colors duration-150 hover:border-[--color-cta]"
      >
        <option value={ALL_CITIES}>Todas las ciudades</option>
        {cities.map((city) => (
          <option key={city.slug} value={city.slug}>{city.name}</option>
        ))}
      </select>
    </label>
  )
}
