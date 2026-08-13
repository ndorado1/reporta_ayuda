import Link from 'next/link'
import { Suspense } from 'react'
import { CitySelect } from './CitySelect'
import { NotificationBell } from './NotificationBell'

type City = { slug: string; name: string }

export function SiteHeader({ cities }: { cities: City[] }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[--color-line] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="mr-auto text-lg font-bold tracking-tight text-[--color-primary]">
          Reporta Cali
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
