import { MyRequestsList } from '@/components/MyRequestsList'

export const metadata = { title: 'Mis solicitudes — Reporta Cali' }

export default function MyRequestsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-[--color-primary]">Mis solicitudes</h1>
      <p className="text-[--color-muted]">
        Estas son las solicitudes guardadas en este navegador. Si borras los datos de
        navegación o entraste en modo incógnito, no aparecerán aquí — pero eso no
        significa que se hayan borrado: siguen publicadas. Para administrarlas necesitas
        el enlace que guardaste al crearlas.
      </p>
      <MyRequestsList />
    </div>
  )
}
