import type { Metadata } from 'next'
import { Public_Sans } from 'next/font/google'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { listCities } from '@/lib/cities'
import { SiteHeader } from '@/components/SiteHeader'
import './globals.css'

// Autohospedada por next/font: sin llamadas a Google en tiempo de ejecución.
const publicSans = Public_Sans({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Reporta Cali — Ayuda tras el terremoto',
  description:
    'Publica qué necesitas y dónde, o encuentra a quién ayudar. Plataforma abierta para coordinar la ayuda tras el terremoto.',
}

// Las ciudades activas viven en una tabla, no en una lista fija en el
// código, para poder habilitar una ciudad nueva con un INSERT y sin
// desplegar (p. ej. si el sismo golpea otra ciudad mañana). Sin esta
// revalidación, el layout quedaría prerrenderizado como estático y ese
// INSERT no se vería hasta el siguiente build. Un minuto de desfase es
// irrelevante para una lista que cambia rarísimo, y evita el costo de
// `force-dynamic`, que renderizaría todo el layout en cada petición.
export const revalidate = 60

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cities = await listCities()

  return (
    <html lang="es-CO">
      <body className={`${publicSans.className} min-h-dvh bg-[--color-background]`}>
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        <SiteHeader cities={cities.map((c) => ({ slug: c.slug, name: c.name }))} />
        <main id="contenido" className="mx-auto max-w-6xl px-4 pb-28 pt-4">
          {children}
        </main>

        {/* Acción principal siempre alcanzable con el pulgar. */}
        <Link
          href="/nueva"
          className="fixed bottom-4 left-1/2 z-40 flex min-h-[52px] -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-[--color-cta] px-6 text-base font-semibold text-white shadow-lg transition-colors duration-150 hover:bg-[--color-cta-hover]"
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
          Pedir ayuda
        </Link>
      </body>
    </html>
  )
}
