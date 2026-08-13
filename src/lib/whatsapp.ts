/**
 * En Colombia los celulares tienen diez dígitos y empiezan por 3.
 * Los fijos, que no sirven para WhatsApp, empiezan por 60.
 */
const MOBILE = /^3\d{9}$/

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (!digits) return null

  // Quita el indicativo de país y el cero de marcación nacional.
  let local = digits
  if (local.startsWith('57') && local.length > 10) local = local.slice(2)
  if (local.startsWith('0')) local = local.slice(1)

  return MOBILE.test(local) ? `+57${local}` : null
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
