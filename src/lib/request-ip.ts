/**
 * La IP de confianza es la que escribe nuestro propio proxy, no la que
 * manda el cliente.
 *
 * Nuestra configuración de nginx fija `X-Real-IP` con
 * `proxy_set_header X-Real-IP $remote_addr`, que SOBRESCRIBE cualquier
 * valor que el cliente haya enviado: no es falsificable. Por eso es la
 * fuente principal.
 *
 * Si falta, recurrimos a `X-Forwarded-For`, pero tomando el ÚLTIMO valor,
 * no el primero: con `proxy_set_header X-Forwarded-For
 * $proxy_add_x_forwarded_for`, nginx AÑADE la IP real al final de lo que
 * el cliente ya haya mandado. El primer valor lo controla quien hace la
 * petición, así que leerlo permite evadir cualquier límite por IP
 * falsificando una cabecera distinta en cada intento.
 */
export function getClientIp(headers: Headers): string {
  const realIp = headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const hops = forwarded.split(',').map((hop) => hop.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1]
  }

  return '0.0.0.0'
}
