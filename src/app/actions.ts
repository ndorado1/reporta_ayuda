'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { claimRequest, cancelClaim } from '@/lib/claims'
import { createRequest, fulfillRequest, cancelRequest, type CreateRequestInput } from '@/lib/requests'
import { getClientIp } from '@/lib/request-ip'

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

const fail = (e: unknown): Result => ({
  ok: false,
  error: e instanceof Error ? e.message : 'Ocurrió un error inesperado',
})

export async function claimAction(input: {
  publicCode: string
  volunteerName: string
}): Promise<Result<{ claimToken: string }>> {
  try {
    const ip = getClientIp(await headers())
    const { claimToken } = await claimRequest(input, ip)
    revalidatePath('/')
    revalidatePath(`/s/${input.publicCode}`)
    return { ok: true, claimToken }
  } catch (e) {
    return fail(e) as Result<{ claimToken: string }>
  }
}

export async function cancelClaimAction(publicCode: string, claimToken: string): Promise<Result> {
  try {
    await cancelClaim(publicCode, claimToken)
    revalidatePath('/')
    revalidatePath(`/s/${publicCode}`)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export async function fulfillAction(publicCode: string, manageToken: string): Promise<Result> {
  try {
    await fulfillRequest(publicCode, manageToken)
    revalidatePath('/')
    revalidatePath(`/s/${publicCode}`)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export async function cancelRequestAction(publicCode: string, manageToken: string): Promise<Result> {
  try {
    await cancelRequest(publicCode, manageToken)
    revalidatePath('/')
    revalidatePath(`/s/${publicCode}`)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}

export async function createRequestAction(
  input: CreateRequestInput
): Promise<Result<{ publicCode: string; manageToken: string; needsReview: boolean }>> {
  try {
    const ip = getClientIp(await headers())
    const created = await createRequest(input, ip)
    revalidatePath('/')
    return { ok: true, ...created }
  } catch (e) {
    // Zod entrega varios errores; mostramos el primero, que es el más útil.
    if (e && typeof e === 'object' && 'issues' in e) {
      const issues = (e as { issues: { message: string }[] }).issues
      return { ok: false, error: issues[0]?.message ?? 'Revisa los datos del formulario' }
    }
    return fail(e) as Result<{ publicCode: string; manageToken: string; needsReview: boolean }>
  }
}
