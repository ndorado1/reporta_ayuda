export const CITY_STORAGE_KEY = 'reporta-cali:ciudad'
export const ALL_CITIES = 'todas'

/**
 * La URL manda sobre lo guardado: un enlace compartido en un grupo de
 * WhatsApp debe abrir la ciudad que dice el enlace, no la última que
 * miró quien lo recibe.
 */
export function resolveCitySlug(
  searchParam: string | null,
  stored: string | null,
  valid: string[]
): string | null {
  if (searchParam === ALL_CITIES) return null
  if (searchParam && valid.includes(searchParam)) return searchParam
  if (stored && valid.includes(stored)) return stored
  return null
}
