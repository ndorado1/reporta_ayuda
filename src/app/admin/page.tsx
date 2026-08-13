import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ADMIN_COOKIE, isValidAdminCookie } from '@/lib/admin-auth'
import { listForModeration } from '@/lib/requests'
import { hideAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const store = await cookies()
  if (!isValidAdminCookie(store.get(ADMIN_COOKIE)?.value)) redirect('/admin/login')

  const rows = await listForModeration()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-(--color-primary)">Moderación</h1>
      <p className="text-(--color-muted)">
        Primero lo marcado para revisión: reportes de la comunidad y envíos que
        superaron el límite por conexión.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-(--color-line) text-sm text-(--color-muted)">
              <th className="py-2 pr-3">Solicitud</th>
              <th className="py-2 pr-3">Ciudad</th>
              <th className="py-2 pr-3">Reportes</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.publicCode} className={`border-b border-(--color-line) ${row.needsReview ? 'bg-(--color-media-soft)' : ''}`}>
                <td className="py-3 pr-3">
                  <Link href={`/s/${row.publicCode}`} className="cursor-pointer font-medium underline">
                    {row.title}
                  </Link>
                </td>
                <td className="py-3 pr-3">{row.cityName}</td>
                <td className="py-3 pr-3">{row.reportCount}</td>
                <td className="py-3 pr-3">{row.isHidden ? 'Oculta' : row.status}</td>
                <td className="py-3">
                  <form action={hideAction.bind(null, row.publicCode, !row.isHidden)}>
                    <button
                      type="submit"
                      className="min-h-[44px] cursor-pointer rounded-lg border-2 border-(--color-primary) px-3 font-semibold transition-colors duration-150 hover:bg-slate-50"
                    >
                      {row.isHidden ? 'Mostrar' : 'Ocultar'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
