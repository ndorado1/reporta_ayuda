import { listCities } from '@/lib/cities'
import { NewRequestForm } from '@/components/NewRequestForm'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Pedir ayuda — Reporta Ayuda' }

export default async function NewRequestPage() {
  const cities = await listCities()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-(--color-primary)">Pedir ayuda</h1>
        <p className="mt-1 text-(--color-muted)">
          Cuenta qué necesitas y dónde. Quien pueda ayudarte te escribirá por WhatsApp.
        </p>
      </div>

      <NewRequestForm
        cities={cities.map((c) => ({
          slug: c.slug,
          name: c.name,
          centerLat: c.centerLat,
          centerLng: c.centerLng,
          defaultZoom: c.defaultZoom,
        }))}
      />
    </div>
  )
}
