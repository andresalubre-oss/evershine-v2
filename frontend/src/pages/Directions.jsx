import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// Port coordinates. These are close approximations of the town/port area —
// if they're off from the actual wharf, right-click the real spot on
// Google Maps ("What's here?") and swap the lat/lng below.
const PORTS = {
  PB_TO_LIMASAWA: {
    name: 'Padre Burgos Port',
    lat: 10.0296,
    lng: 125.017,
  },
  LIMASAWA_TO_PB: {
    name: 'Limasawa Port (Magallanes)',
    lat: 9.9079,
    lng: 125.0761,
  },
}

// Small helper that lives inside <MapContainer> so it can access the Leaflet
// map instance via react-leaflet's hook, then zoom/pan to fit the route.
function FitRoute({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] })
    }
  }, [bounds, map])
  return null
}

export default function Directions() {
  const [searchParams] = useSearchParams()
  const direction = searchParams.get('direction') === 'LIMASAWA_TO_PB' ? 'LIMASAWA_TO_PB' : 'PB_TO_LIMASAWA'
  const destination = PORTS[direction]

  const [origin, setOrigin] = useState(null)
  // locating | location_denied | routing | ready | error
  const [status, setStatus] = useState('locating')
  const [errorMessage, setErrorMessage] = useState('')
  const [routeLine, setRouteLine] = useState(null)
  const [distanceText, setDistanceText] = useState('')
  const [durationText, setDurationText] = useState('')

  // Get the user's current location.
  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('error')
      setErrorMessage('Your browser does not support location services.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude })
        setStatus('routing')
      },
      () => setStatus('location_denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // Fetch a driving route from OSRM's free public routing service.
  useEffect(() => {
    if (!origin) return

    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.code !== 'Ok' || !data.routes?.length) {
          throw new Error('No route found')
        }
        const route = data.routes[0]
        // OSRM returns [lng, lat] pairs; Leaflet wants [lat, lng].
        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
        setRouteLine(coords)

        const km = (route.distance / 1000).toFixed(1)
        const minutes = Math.round(route.duration / 60)
        setDistanceText(`${km} km`)
        setDurationText(minutes < 60 ? `${minutes} min` : `${(minutes / 60).toFixed(1)} hr`)
        setStatus('ready')
      })
      .catch(() => {
        setStatus('error')
        setErrorMessage('Could not calculate a driving route to the port.')
      })
    // destination is derived from `direction`, which only changes via URL —
    // safe to omit from deps here since it's effectively constant per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin])

  const googleMapsAppUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800">Directions to {destination.name}</h1>
      <p className="mt-1 text-gray-600">
        {direction === 'PB_TO_LIMASAWA'
          ? 'Head here to catch your ferry to Limasawa.'
          : 'Head here to catch your ferry to Padre Burgos.'}
      </p>

      {status === 'locating' && (
        <p className="mt-6 text-sm text-gray-600">Getting your current location...</p>
      )}

      {status === 'location_denied' && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm text-gray-700">
            Location access was denied, so we can't draw a route from where you are. You can
            still open directions in the Google Maps app instead:
          </p>
          <a
            href={googleMapsAppUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-md bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Open in Google Maps
          </a>
        </div>
      )}

      {status === 'error' && <p className="mt-6 text-sm text-red-600">{errorMessage}</p>}

      {status === 'ready' && (
        <p className="mt-6 text-sm text-gray-600">
          <b>{distanceText}</b> away &middot; about <b>{durationText}</b> by car
        </p>
      )}

      {(status === 'routing' || status === 'ready') && origin && (
        <>
          <div
            className={`${status === 'ready' ? 'mt-3' : 'mt-6'} h-96 w-full overflow-hidden rounded-lg border border-gray-200`}
          >
            <MapContainer
              center={[origin.lat, origin.lng]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <CircleMarker
                center={[origin.lat, origin.lng]}
                radius={8}
                pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
              >
                <Popup>You are here</Popup>
              </CircleMarker>
              <CircleMarker
                center={[destination.lat, destination.lng]}
                radius={8}
                pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}
              >
                <Popup>{destination.name}</Popup>
              </CircleMarker>
              {routeLine && <Polyline positions={routeLine} pathOptions={{ color: '#0f766e', weight: 5 }} />}
              {routeLine && <FitRoute bounds={routeLine} />}
            </MapContainer>
          </div>
          <a
            href={googleMapsAppUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm text-teal-700 hover:underline"
          >
            Open turn-by-turn navigation in Google Maps &rarr;
          </a>
        </>
      )}
    </div>
  )
}
