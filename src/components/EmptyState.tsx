import Link from 'next/link'
import { Inbox } from 'lucide-react'

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-(--color-line) bg-white p-8 text-center">
      <Inbox aria-hidden="true" className="mx-auto h-10 w-10 text-(--color-muted)" />
      <p className="mt-3 text-base font-medium text-(--color-secondary)">{message}</p>
      <Link href="/nueva" className="mt-4 inline-block cursor-pointer font-semibold text-(--color-cta) underline">
        Publicar una solicitud
      </Link>
    </div>
  )
}
