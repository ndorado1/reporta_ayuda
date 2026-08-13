'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { claimRequest, cancelClaim } from '@/lib/claims'
import {
  createRequest,
  fulfillRequest,
  cancelRequest,
  reportRequest,
  updateRequest,
  type CreateRequestInput,
  type UpdateRequestInput,
} from '@/lib/requests'
import { getClientIp } from '@/lib/request-ip'
import { DomainError } from '@/lib/errors'

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

/**
 * Solo un DomainError o un error de validación de Zod tienen un mensaje
 * pensado para mostrarse. Cualquier otra cosa (Drizzle envuelve cada fallo
 * de consulta con el SQL y los parámetros literales, que pueden incluir el
 * nombre, el teléfono o las coordenadas de quien está publicando) se
 * registra en el servidor y se responde con un mensaje genérico: exponerlo
 * tal cual sería mostrarle a la persona su propio INSERT en inglés.
 */
const fail = (e: unknown): Result => {
  if (e instanceof DomainError) return { ok: false, error: e.message }
  if (e instanceof ZodError) {
    return { ok: false, error: e.issues[0]?.message ?? 'Revisa los datos' }
  }
  console.error(e)
  return { ok: false, error: 'No pudimos guardar. Inténtalo de nuevo en un momento.' }
}

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

export async function updateRequestAction(
  code: string,
  token: string,
  patch: UpdateRequestInput
): Promise<Result> {
  try {
    await updateRequest(code, token, patch)
    revalidatePath('/')
    revalidatePath(`/s/${code}`)
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
    return fail(e) as Result<{ publicCode: string; manageToken: string; needsReview: boolean }>
  }
}

export async function reportAction(publicCode: string, reason: string): Promise<Result> {
  try {
    const ip = getClientIp(await headers())
    await reportRequest(publicCode, reason, ip)
    return { ok: true }
  } catch (e) {
    return fail(e)
  }
}
