export type Coords = { lat: number; lng: number }

/**
 * Radio holgado. El objetivo no es delimitar el municipio, sino detectar
 * errores gruesos: eligió Cali y dejó el pin en Bogotá.
 */
export const MAX_PIN_DISTANCE_KM = 60

const EARTH_RADIUS_KM = 6371
const toRad = (deg: number) => (deg * Math.PI) / 180

export function distanceKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function isNearCity(pin: Coords, center: Coords): boolean {
  return distanceKm(pin, center) <= MAX_PIN_DISTANCE_KM
}
