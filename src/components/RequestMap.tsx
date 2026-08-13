'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import Link from 'next/link'
import 'leaflet/dist/leaflet.css'
import type { MapRequestItem } from '@/lib/requests'

// Iconos por urgencia: el color no basta, cambia también la letra.
const ICONS: Record<string, L.DivIcon> = {
  alta: marker('#b91c1c', '!'),
  media: marker('#b45309', '•'),
  baja: marker('#15803d', '·'),
}

function marker(color: string, glyph: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};color:#fff;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${glyph}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export default function RequestMap({
  items,
  center,
  zoom,
}: {
  items: MapRequestItem[]
  center: { lat: number; lng: number }
  zoom: number
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom
      className="h-[60vh] w-full rounded-xl border border-(--color-line)"
    >
      <TileLayer
        attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {items.map((item) => (
        <Marker
          key={item.publicCode}
          position={[item.lat, item.lng]}
          icon={ICONS[item.urgency]}
        >
          <Popup>
            <strong className="block text-base">{item.title}</strong>
            <span className="text-sm">{item.neighborhood ?? item.cityName}</span>
            <Link href={`/s/${item.publicCode}`} className="mt-2 block font-semibold text-(--color-cta) underline">
              Ver solicitud
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
