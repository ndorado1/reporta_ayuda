import { loginAction } from '../actions'

export const metadata = { title: 'Acceso — Reporta Ayuda' }

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const hasError = (await searchParams).error === '1'

  return (
    <form action={loginAction} noValidate className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold text-(--color-primary)">Acceso de moderación</h1>

      <div>
        <label htmlFor="token" className="block font-semibold text-(--color-primary)">Clave</label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-[44px] w-full rounded-lg border border-(--color-line) px-3 text-base"
        />
      </div>

      {hasError && (
        <p role="alert" className="text-sm font-semibold text-(--color-urgente)">Clave incorrecta.</p>
      )}

      <button
        type="submit"
        className="min-h-[44px] w-full cursor-pointer rounded-lg bg-(--color-cta) px-4 font-semibold text-white transition-colors duration-150 hover:bg-(--color-cta-hover)"
      >
        Entrar
      </button>
    </form>
  )
}
