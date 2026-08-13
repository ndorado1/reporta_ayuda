/** nginx antepone la IP real en x-forwarded-for; la primera es la del cliente. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip')?.trim() || '0.0.0.0'
}
