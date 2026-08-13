'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Crosshair } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { Button } from './ui/Button'

const pin = L.divIcon({
  className: '',
  html: '<span style="display:block;width:24px;height:24px;border-radius:9999px;background:#0369a1;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng]) }, [lat, lng, map])
  return null
}

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

export default function LocationPicker({
  lat,
  lng,
  zoom,
  onChange,
}: {
  lat: number
  lng: number
  zoom: number
  onChange: (lat: number, lng: number) => void
}) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function useMyLocation() {
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude)
        setLocating(false)
      },
      () => {
        setError('No pudimos obtener tu ubicación. Marca el punto en el mapa.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" onClick={useMyLocation} disabled={locating}>
        <Crosshair aria-hidden="true" className="h-5 w-5" />
        {locating ? 'Buscando…' : 'Usar mi ubicación'}
      </Button>

      {error && <p role="alert" className="text-sm font-medium text-[--color-urgente]">{error}</p>}

      <p className="text-sm text-[--color-muted]">
        Toca el mapa o arrastra el punto para marcar dónde se necesita la ayuda.
      </p>

      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        className="h-64 w-full rounded-xl border border-[--color-line]"
      >
        <TileLayer
          attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={lat} lng={lng} />
        <ClickCatcher onPick={onChange} />
        <Marker
          position={[lat, lng]}
          icon={pin}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const { lat: newLat, lng: newLng } = e.target.getLatLng()
              onChange(newLat, newLng)
            },
          }}
        />
      </MapContainer>
    </div>
  )
}
