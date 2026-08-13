'use client'

// `ssr: false` en `next/dynamic` no está permitido dentro de un Server
// Component (ver docs de Next.js: "ssr: false is not allowed with
// next/dynamic in Server Components. Please move it into a Client
// Component."). page.tsx es un Server Component async, así que el import
// diferido vive aquí, en su propio límite de cliente.

import dynamicImport from 'next/dynamic'

const RequestMap = dynamicImport(() => import('@/components/RequestMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[60vh] w-full animate-pulse rounded-xl bg-slate-100" aria-label="Cargando mapa" />
  ),
})

export default RequestMap
