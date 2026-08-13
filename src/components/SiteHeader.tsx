import Link from 'next/link'
import { Suspense } from 'react'
import { CitySelect } from './CitySelect'
import { NotificationBell } from './NotificationBell'

type City = { slug: string; name: string }

// Fondo blanco opaco, sin `backdrop-blur`: desenfocar lo que pasa por debajo
// obliga al móvil a recomponer la cabecera en cada scroll, que en gama baja se
// nota, y además creaba un contexto de posicionamiento que recortaba el panel
// de novedades (ver NotificationBell).
export function SiteHeader({ cities }: { cities: City[] }) {
  return (
    <header className="sticky top-0 z-30 border-b border-(--color-line) bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="mr-auto flex items-center gap-2">
          {/* `img` y no `next/image`: la optimización de imágenes necesita
              sharp en el contenedor, que no está instalado. Para un PNG de
              4 KB que se sirve una vez y queda en caché, optimizarlo no
              ahorra nada y sí añadiría un punto de fallo en producción.
              Decorativa (alt vacío): el nombre que hay al lado ya la
              describe, y repetirlo haría que un lector de pantalla dijera
              lo mismo dos veces. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bandera-colombia.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0"
          />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight text-(--color-primary)">
              Reporta Ayuda
            </span>
            <span className="text-xs text-(--color-muted)">
              Ayuda tras el terremoto del 10 de agosto
            </span>
          </span>
        </Link>
        <Link
          href="/mis-solicitudes"
          className="hidden cursor-pointer text-sm font-semibold text-(--color-secondary) underline transition-colors duration-150 hover:text-(--color-cta) sm:block"
        >
          Mis solicitudes
        </Link>
        <Suspense fallback={null}>
          <CitySelect cities={cities} />
        </Suspense>
        <Suspense fallback={null}>
          <NotificationBell />
        </Suspense>
      </div>
    </header>
  )
}
