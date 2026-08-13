import { notFound } from 'next/navigation'
import { getRequestByCode } from '@/lib/requests'
import { RequestDetail } from '@/components/RequestDetail'

export const dynamic = 'force-dynamic'

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { code } = await params
  const token = (await searchParams).t ?? null

  const detail = await getRequestByCode(code, token ?? undefined)
  if (!detail) notFound()

  return <RequestDetail detail={detail} token={token} />
}
