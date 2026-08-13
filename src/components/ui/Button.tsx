import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'whatsapp' | 'danger'

// Sin transform en hover: en gama baja produce tirones y no aporta nada.
// Sintaxis `(--token)`, no `[--token]`: en Tailwind v4 los corchetes con una
// variable CSS "pelada" (sin `var()`) no generan ninguna regla. Con esto los
// botones quedaban con fondo transparente y texto blanco invisible.
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-(--color-cta) text-white hover:bg-(--color-cta-hover)',
  secondary: 'bg-white text-(--color-primary) border-2 border-(--color-primary) hover:bg-slate-50',
  whatsapp: 'bg-(--color-whatsapp) text-white hover:bg-(--color-whatsapp-hover)',
  danger: 'bg-white text-(--color-urgente) border-2 border-(--color-urgente) hover:bg-(--color-urgente-soft)',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    />
  )
}
