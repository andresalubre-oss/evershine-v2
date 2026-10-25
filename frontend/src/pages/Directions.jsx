import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'


const originIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#3b82f6;border:2px solid #1d4ed8;box-sizing:border-box;"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function IconMapPin(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  )
}


function GoogleMapsButton({ href, className = '' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 rounded-lg border border-teal-700 bg-teal-700 px-6 py-4 text-white transition-colors hover:bg-teal-800 ${className}`}
    >
      <IconMapPin className="h-7 w-7 flex-shrink-0" />
      <span>
        <span className="block text-base font-semibold">Open in Google Maps</span>
        <span className="block text-sm text-teal-100">Get live turn-by-turn navigation to the port</span>
      </span>
    </a>
  )
}


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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [direction, setDirection] = useState(
    searchParams.get('direction') === 'LIMASAWA_TO_PB' ? 'LIMASAWA_TO_PB' : 'PB_TO_LIMASAWA'
  )
  const destination = PORTS[direction]

  function switchDirection(next) {
    setDirection(next)
    setSearchParams({ direction: next })
  }

  const [origin, setOrigin] = useState(null)
 
  const [status, setStatus] = useState('locating')
  const [errorMessage, setErrorMessage] = useState('')
  const [routeLine, setRouteLine] = useState(null)
  const [distanceText, setDistanceText] = useState('')
  const [durationText, setDurationText] = useState('')


  function locate() {
    if (!navigator.geolocation) {
      setStatus('error')
      setErrorMessage('Your browser does not support location services.')
      return
    }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
        setStatus('routing')
      },
      () => setStatus('location_denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => {
    locate()
   
  }, [])

  
  function handleOriginDrag(e) {
    const { lat, lng } = e.target.getLatLng()
    setOrigin({ lat, lng, accuracy: null })
  }

  
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
   
  }, [origin, destination])

  const googleMapsAppUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-base font-medium text-teal-700 hover:text-teal-800 hover:underline"
      >
        &larr; Back
      </button>

      <h1 className="mt-3 text-3xl font-bold text-gray-800">Directions to {destination.name}</h1>
      <p className="mt-1.5 text-lg text-gray-600">
        {direction === 'PB_TO_LIMASAWA'
          ? 'Head here to catch your ferry to Limasawa.'
          : 'Head here to catch your ferry to Padre Burgos.'}
      </p>

  
      <div className="mt-5 inline-flex rounded-md border border-gray-200 bg-gray-50 p-1.5">
        <button
          type="button"
          onClick={() => switchDirection('PB_TO_LIMASAWA')}
          className={`rounded px-4 py-2 text-base font-medium transition-colors ${
            direction === 'PB_TO_LIMASAWA' ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Padre Burgos Port
        </button>
        <button
          type="button"
          onClick={() => switchDirection('LIMASAWA_TO_PB')}
          className={`rounded px-4 py-2 text-base font-medium transition-colors ${
            direction === 'LIMASAWA_TO_PB' ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Limasawa Port
        </button>
      </div>

      {status === 'locating' && (
        <p className="mt-6 text-base text-gray-600">Getting your current location...</p>
      )}

      {status === 'location_denied' && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-7">
          <p className="text-base text-gray-700">
            Location access was denied, so we can't draw a route from where you are. You can
            still open directions in the Google Maps app instead:
          </p>
          <GoogleMapsButton href={googleMapsAppUrl} className="mt-4" />
        </div>
      )}

      {status === 'error' && <p className="mt-6 text-base text-red-600">{errorMessage}</p>}

      {status === 'ready' && (
        <p className="mt-6 text-base text-gray-600">
          <b>{distanceText}</b> away &middot; about <b>{durationText}</b> by car
        </p>
      )}

      {(status === 'routing' || status === 'ready') && origin && (
        <>
          <div
           
            className={`${status === 'ready' ? 'mt-3' : 'mt-6'} isolate h-[32rem] w-full overflow-hidden rounded-lg border border-gray-200`}
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
              {origin.accuracy && (
                <Circle
                  center={[origin.lat, origin.lng]}
                  radius={origin.accuracy}
                  pathOptions={{ color: '#3b82f6', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.08 }}
                />
              )}
              <Marker
                position={[origin.lat, origin.lng]}
                icon={originIcon}
                draggable
                eventHandlers={{ dragend: handleOriginDrag }}
              >
                <Popup>You are here, drag if this looks wrong</Popup>
              </Marker>
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
          <p className="mt-2.5 text-sm text-gray-500">
            Location is estimated from your device and network, and can be off by a wide margin,
            especially on desktop. Drag the blue marker to your exact position, or{' '}
            <button type="button" onClick={locate} className="font-medium text-teal-700 hover:underline">
              update my location
            </button>
            .
          </p>
          <GoogleMapsButton href={googleMapsAppUrl} className="mt-5" />
        </>
      )}
    </div>
  )
}
