import { createHmac, timingSafeEqual } from 'node:crypto'

export const ADMIN_COOKIE = 'reporta_admin'

function secret(): string {
  const value = process.env.ADMIN_COOKIE_SECRET
  if (!value) throw new Error('Falta ADMIN_COOKIE_SECRET')
  return value
}

/**
 * La cookie es "admin.<hmac>". No lleva el token dentro, y como se firma
 * con un secreto del servidor, no se puede fabricar desde fuera.
 */
export function signAdminCookie(): string {
  const payload = 'admin'
  const mac = createHmac('sha256', secret()).update(payload).digest('hex')
  return `${payload}.${mac}`
}

export function isValidAdminCookie(value: string | undefined): boolean {
  if (!value) return false
  const [payload, mac] = value.split('.')
  if (payload !== 'admin' || !mac) return false

  const expected = Buffer.from(createHmac('sha256', secret()).update(payload).digest('hex'))
  const given = Buffer.from(mac)
  if (expected.length !== given.length) return false
  return timingSafeEqual(expected, given)
}

export function checkAdminToken(input: string): boolean {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) throw new Error('Falta ADMIN_TOKEN')
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
