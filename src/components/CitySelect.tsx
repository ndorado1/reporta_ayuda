'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { ALL_CITIES, CITY_STORAGE_KEY, resolveCitySlug } from '@/lib/city-preference'

type Option = { slug: string; name: string }

export function CitySelect({ cities }: { cities: Option[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cityParam = searchParams.get('ciudad')
  // El layout raíz no recibe searchParams en el App Router, así que la
  // ciudad activa se lee aquí, en el cliente.
  const activeSlug = cityParam ?? ALL_CITIES

  useEffect(() => {
    // La URL manda sobre lo guardado: si ya trae `?ciudad=`, no hay nada
    // que reconciliar. Sin eso, un enlace compartido en un grupo de
    // WhatsApp abriría la ciudad guardada en el teléfono de quien lo
    // recibe en vez de la que dice el enlace.
    if (cityParam) return

    let stored: string | null = null
    try {
      stored = localStorage.getItem(CITY_STORAGE_KEY)
    } catch {
      // Modo incógnito o almacenamiento bloqueado: no hay preferencia que aplicar.
    }

    const preferred = resolveCitySlug(null, stored, cities.map((c) => c.slug))
    if (!preferred) return

    const params = new URLSearchParams(searchParams.toString())
    params.set('ciudad', preferred)
    // replace, no push: si fuera push, el botón "atrás" del teléfono
    // devolvería una y otra vez a la misma pantalla en vez de salir.
    router.replace(`?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityParam])

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
