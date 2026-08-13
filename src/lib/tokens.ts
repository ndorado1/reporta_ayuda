import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/** Sin 0, 1, I, O ni L: se confunden al leer un código en voz alta. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function verifyToken(token: string, hash: string): boolean {
  const a = Buffer.from(hashToken(token), 'hex')
  const b = Buffer.from(hash, 'hex')
  // timingSafeEqual exige longitudes iguales; un hash corrupto no debe lanzar.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function generatePublicCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}

export function hashIp(ip: string): string {
  const secret = process.env.IP_HASH_SECRET
  if (!secret) throw new Error('Falta IP_HASH_SECRET')
  // HMAC y no sha256: el espacio IPv4 completo se revierte por fuerza bruta.
  return createHmac('sha256', secret).update(ip).digest('hex')
}
