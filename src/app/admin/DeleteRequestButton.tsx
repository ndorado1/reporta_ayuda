'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { deleteAction } from './actions'

function Confirm() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[44px] cursor-pointer rounded-lg bg-(--color-urgente) px-3 font-semibold text-white transition-colors duration-150 hover:bg-red-800 disabled:opacity-60"
    >
      {pending ? 'Borrando…' : 'Sí, borrar'}
    </button>
  )
}

/**
 * Borrar es irreversible y este panel se abre con una sola contraseña, así que
 * no basta con un botón: hace falta un segundo gesto deliberado. Se usa un
 * paso extra en la propia tabla y no `window.confirm`, que algunos navegadores
 * móviles suprimen y que no se puede leer con un lector de pantalla como parte
 * de la fila.
 */
export function DeleteRequestButton({ code, title }: { code: string; title: string }) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={`Borrar "${title}"`}
        className="min-h-[44px] cursor-pointer rounded-lg border-2 border-(--color-urgente) px-3 font-semibold text-(--color-urgente) transition-colors duration-150 hover:bg-(--color-urgente-soft)"
      >
        Borrar
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-(--color-urgente)">
        Se borra para siempre.
      </span>
      <form action={deleteAction.bind(null, code)}>
        <Confirm />
      </form>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="min-h-[44px] cursor-pointer rounded-lg px-3 font-semibold text-(--color-secondary) underline transition-colors duration-150 hover:text-(--color-primary)"
      >
        Cancelar
      </button>
    </div>
  )
}
