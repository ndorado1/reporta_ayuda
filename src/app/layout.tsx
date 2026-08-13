import type { Metadata } from 'next'
import { Public_Sans } from 'next/font/google'
import Link from 'next/link'
import { Heart, Plus } from 'lucide-react'
import { listCities } from '@/lib/cities'
import { SiteHeader } from '@/components/SiteHeader'
import './globals.css'

// Autohospedada por next/font: sin llamadas a Google en tiempo de ejecución.
const publicSans = Public_Sans({ subsets: ['latin'], display: 'swap' })

const DESCRIPTION =
  'Plataforma de ayuda durante la emergencia por el terremoto del 10 de agosto en Colombia.'

// Base para las URLs absolutas que exigen las tarjetas de WhatsApp, Facebook
// y demás: una ruta relativa no le sirve a nadie que reciba el enlace fuera
// del sitio. Si la variable falta o está mal escrita caemos al dominio real
// en vez de tumbar la aplicación entera por un error de configuración.
function siteUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reportayuda.com')
  } catch {
    return new URL('https://reportayuda.com')
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'Reporta Ayuda — Coordinemos la ayuda tras el terremoto',
  description: DESCRIPTION,
  openGraph: {
    title: 'Reporta Ayuda',
    description: DESCRIPTION,
    url: '/',
    siteName: 'Reporta Ayuda',
    locale: 'es_CO',
    type: 'website',
  },
  // WhatsApp lee las etiquetas de Open Graph; Twitter/X necesita además las
  // suyas para mostrar la tarjeta grande en vez de un enlace pelado.
  twitter: {
    card: 'summary_large_image',
    title: 'Reporta Ayuda',
    description: DESCRIPTION,
  },
}

// Las ciudades activas viven en una tabla, no en una lista fija en el
// código, para poder habilitar una ciudad nueva con un INSERT y sin
// desplegar (p. ej. si el sismo golpea otra ciudad mañana).
//
// El layout se renderiza en cada petición, no en el build. Con `revalidate`
// Next.js prerrenderiza en el build las páginas que no son dinámicas
// (/privacidad, /nueva, /mis-solicitudes, /admin/login) y para ello tiene que
// consultar la base: eso obliga a que la base de producción sea alcanzable
// desde donde se construye la imagen, lo que rompe el despliegue en cualquier
// constructor aislado. Las páginas con datos ya eran `force-dynamic`, así que
// lo único que se pierde es el prerrenderizado de cuatro páginas estáticas, a
// cambio de un SELECT indexado sobre una tabla de cinco filas por petición.
export const dynamic = 'force-dynamic'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cities = await listCities()

  return (
    <html lang="es-CO">
      <body className={`${publicSans.className} min-h-dvh bg-(--color-background)`}>
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        <SiteHeader cities={cities.map((c) => ({ slug: c.slug, name: c.name }))} />
        <main id="contenido" className="mx-auto max-w-6xl px-4 pb-28 pt-4">
          {children}
        </main>

        <footer className="mx-auto max-w-6xl px-4 pb-24 pt-8 text-sm text-(--color-muted)">
          <nav className="flex flex-wrap gap-4">
            <Link href="/mis-solicitudes" className="cursor-pointer underline">Mis solicitudes</Link>
            <Link href="/privacidad" className="cursor-pointer underline">Política de datos</Link>
          </nav>
          <p className="mt-3">
            Reporta Ayuda es una iniciativa ciudadana sin ánimo de lucro para coordinar la
            ayuda tras el terremoto.
          </p>
          {/* El corazón es un icono SVG y no un emoji: los emoji los dibuja
              cada sistema a su manera y algunos Android antiguos los rinden
              como un cuadro vacío. Va oculto para los lectores de pantalla,
              con la palabra al lado en su lugar, para que se lea
              "Desarrollado con amor por" y no "Desarrollado con por". */}
          <p className="mt-2 flex items-center gap-1.5">
            Desarrollado con
            <Heart aria-hidden="true" className="h-4 w-4 fill-(--color-urgente) text-(--color-urgente)" />
            <span className="sr-only">amor</span>
            por Antonio Dorado
          </p>
        </footer>

        {/* Acción principal siempre alcanzable con el pulgar. */}
        <Link
          href="/nueva"
          className="fixed bottom-4 left-1/2 z-40 flex min-h-[52px] -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-(--color-cta) px-6 text-base font-semibold text-white shadow-lg transition-colors duration-150 hover:bg-(--color-cta-hover)"
        >
          <Plus aria-hidden="true" className="h-5 w-5" />
          Pedir ayuda
        </Link>
      </body>
    </html>
  )
}
