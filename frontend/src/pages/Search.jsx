import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import BookingSteps from '../components/BookingSteps.jsx'

const today = new Date().toISOString().split('T')[0]

// Approximate Padre Burgos <-> Limasawa crossing time. The schedule table
// only stores a departure time, not an arrival time, so this is used to
// show an estimated arrival — adjust here if the real crossing time differs.
const CROSSING_DURATION_HOURS = 1

const PORT_NAMES = {
  PB_TO_LIMASAWA: { from: 'Padre Burgos', to: 'Limasawa' },
  LIMASAWA_TO_PB: { from: 'Limasawa', to: 'Padre Burgos' },
}

// Hero background slides. Each can carry its own crop position, same
// convention as LIMASAWA_HIGHLIGHTS below, since different photos frame
// differently. Add/remove entries here to change what rotates through —
// nothing else needs to change.
const HERO_SLIDES = [
  { image: '/hero-2.jpg', position: 'center 30%' },
  { image: '/hero-6.jpg', position: 'center 70%' },
]
const HERO_SLIDE_INTERVAL_MS = 5000

// "Explore Limasawa Island" gallery entries. `image` points at whichever
// existing photo is available for now — replace with a real photo of each
// spot once one's ready, nothing else needs to change.
const LIMASAWA_HIGHLIGHTS = [
  {
    name: 'Island Lagoon',
    description: "The alluring turquoise, clear seawater is best for swimming; the rocks in its periphery are good start-off points for cliff diving. They offer picturesque views, perfect for swimming and other water sports activities. These sites are located in Barangay San Agustin.",
    image: '/blue-lagoon.jpg',
  },
  {
    name: "Bad-as Peak",
    description: 'The Limasawa Island Viewpoints became one of the biggest surprises of my visit to Limasawa. I expected to spend the afternoon chasing a beautiful sunset, but I left appreciating how two neighboring peaks could offer completely different experiences.',
    image: '/bad-as-peak.jpg',
    position: 'center 75%',
  },
  {
    name: 'DakDak Resort',
    description: 'Dakdak Beach Resort is a popular, budget-friendly tropical getaway located in Barangay Lugsungan on Limasawa Island, Southern Leyte, often nicknamed the island "Moana Village" for its scenic coconut trees, white sand, and bamboo cottages.',
    image: '/DakDak.jpg',
    position: 'center 75%',
  },
  {
    name: 'Parola',
    description: "Standing against the blue sky and surrounded by lush greenery, it serves as an important guide for ships navigating the waters around the island while also offering a scenic landmark for visitors.",
    image: '/parola.png',
     position: 'center 20%',
  },
  {
    name: 'Welcome to Limasawa',
    description: 'The Welcome to Limasawa landmark is a welcoming sign that marks the entrance to Limasawa Island, Southern Leyte. It gives visitors a warm first impression of the island and serves as a recognizable spot where travelers can stop.',
    image: '/welcome-limasawa-landmark.jpg',
    position: 'center 70%',
  },
  {
    name: 'Magellan Cross',
    description: "Magellan's Cross in Limasawa is a 20-foot (6.09-meter) commemorative cross located on a hilltop in Barangay Magallanes, Southern Leyte, marking the site where Ferdinand Magellan's expedition planted a cross in 1521.",
    image: '/magellan-cross.jpg',
  },
]

// Mobile carousel only: the real list with the last spot cloned onto the
// front and the first spot cloned onto the back, so there's always a real
// photo peeking on both sides — even at rest on the first/last spot — instead
// of blank margin. The desktop grid below renders LIMASAWA_HIGHLIGHTS
// directly and never sees these clones.
const GALLERY_LOOP = [
  LIMASAWA_HIGHLIGHTS[LIMASAWA_HIGHLIGHTS.length - 1],
  ...LIMASAWA_HIGHLIGHTS,
  LIMASAWA_HIGHLIGHTS[0],
]

function IconChevron(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  )
}

// Landscape ad/promo banner shown between the search form and the gallery.
// Drop full banner-style images (whatever you design) into frontend/public/
// and reference them here — nothing else needs to change. object-contain
// (not cover) keeps a designed banner's text/logos from getting cropped,
// regardless of its exact proportions.
const BANNER_AD_SLIDES = ['/book-now-landscape.png', '/island-lagoon-landscape.png']
const BANNER_AD_SLIDE_INTERVAL_MS = 6000

function BannerAdSlider() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % BANNER_AD_SLIDES.length)
    }, BANNER_AD_SLIDE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  if (BANNER_AD_SLIDES.length === 0) return null

  function prev() {
    setIndex((i) => (i - 1 + BANNER_AD_SLIDES.length) % BANNER_AD_SLIDES.length)
  }
  function next() {
    setIndex((i) => (i + 1) % BANNER_AD_SLIDES.length)
  }

  return (
    <div className="mx-auto max-w-10xl px-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="relative aspect-[3/1] w-full bg-gray-50">
          {BANNER_AD_SLIDES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`Promotion ${i + 1}`}
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-1000 ${i === index ? 'opacity-100' : 'opacity-0'}`}
            />
          ))}

          {BANNER_AD_SLIDES.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous promotion"
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-100 sm:left-4"
              >
                <IconChevron className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next promotion"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-100 sm:right-4"
              >
                <IconChevron className="h-4 w-4 rotate-180" />
              </button>

              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
                {BANNER_AD_SLIDES.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Show promotion ${i + 1} of ${BANNER_AD_SLIDES.length}`}
                    className={`h-2 w-2 rounded-full transition-colors ${i === index ? 'bg-teal-700' : 'bg-gray-300'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function oppositeDirection(direction) {
  return direction === 'PB_TO_LIMASAWA' ? 'LIMASAWA_TO_PB' : 'PB_TO_LIMASAWA'
}

function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().split('T')[0]
}

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// One trip result — departure/arrival times with a duration line between
// them, port names, price, and a Book button. Same card used for both the
// outbound and return lists.
function TripCard({ schedule, fromLabel, toLabel, onBook }) {
  const departure = new Date(schedule.departureDatetime)
  const arrival = new Date(departure.getTime() + CROSSING_DURATION_HOURS * 60 * 60 * 1000)

  return (
    <div className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3 sm:gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800">{formatTime(departure)}</p>
          <p className="text-base text-gray-500">{fromLabel}</p>
        </div>

        <div className="flex flex-1 flex-col items-center px-1">
          <span className="text-sm text-gray-400">ETA {CROSSING_DURATION_HOURS} Hr</span>
          <div className="flex w-full items-center">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-teal-700" />
            <span className="mx-1 flex-1 border-t border-dashed border-gray-300" />
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-teal-700" />
          </div>
        </div>

        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800">{formatTime(arrival)}</p>
          <p className="text-base text-gray-500">{toLabel}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-3 sm:justify-end sm:border-t-0 sm:pt-0">
        <p className="text-2xl font-bold text-teal-700">&#8369;{schedule.baseFare}</p>
        <button
          onClick={onBook}
          className="rounded-md bg-teal-700 px-7 py-3 text-lg font-medium text-white hover:bg-teal-800"
        >
          Book
        </button>
      </div>
    </div>
  )
}

function SearchFormFields({
  tripType, setTripType, direction, ports, swapDirection,
  date, setDate, returnDate, setReturnDate,
  onSearch, onCancel, loading, error,
}) {
  return (
    <>
      <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => setTripType('roundtrip')}
          className={`rounded px-6 py-2.5 text-lg font-medium transition-colors ${
            tripType === 'roundtrip' ? 'bg-teal-700 text-white' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Round Trip
        </button>
        <button
          type="button"
          onClick={() => setTripType('oneway')}
          className={`rounded px-6 py-2.5 text-lg font-medium transition-colors ${
            tripType === 'oneway' ? 'bg-teal-700 text-white' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          One-way
        </button>
      </div>


      <div className="mt-5 flex items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-5 py-3.5 sm:px-6 sm:py-5">
          <span className="block text-base text-gray-500">From</span>
          <span className="block truncate text-xl font-medium text-gray-800">{ports.from}</span>
        </div>

        <button
          type="button"
          onClick={swapDirection}
          title="Swap origin and destination"
          aria-label="Swap origin and destination"
          className="group flex flex-shrink-0 flex-col items-center gap-1"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-teal-700 text-teal-700 transition-colors duration-300 group-hover:bg-teal-700 group-hover:text-white sm:h-14 sm:w-14">
            <svg
              className={`h-6 w-6 transition-transform duration-300 sm:h-7 sm:w-7 ${
                direction === 'LIMASAWA_TO_PB' ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </span>
          <span className="text-sm font-semibold uppercase tracking-wide text-teal-700">Swap</span>
        </button>

        <div className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-5 py-3.5 sm:px-6 sm:py-5">
          <span className="block text-base text-gray-500">To</span>
          <span className="block truncate text-xl font-medium text-gray-800">{ports.to}</span>
        </div>
      </div>


      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          {tripType === 'roundtrip' && (
            <label className="mb-1 block text-base text-gray-500">Departure Date</label>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-4 py-3 text-lg"
          />
        </div>

        {tripType === 'roundtrip' && (
          <div className="flex-1">
            <label className="mb-1 block text-base text-gray-500">Return Date</label>
            <input
              type="date"
              value={returnDate}
              min={date}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-lg"
            />
          </div>
        )}

        <button
          onClick={onSearch}
          disabled={loading}
          className="rounded-md bg-teal-700 px-7 py-3.5 text-lg font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 sm:self-end"
        >
          {loading ? 'Searching...' : 'Search Trips'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-6 py-3.5 text-lg font-medium text-gray-600 hover:bg-gray-50 sm:self-end"
          >
            Cancel
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-lg text-red-600">{error}</p>}
    </>
  )
}


function DateNavHeader({ dateStr, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-gray-100 p-2">
      <button
        onClick={onPrev}
        className="rounded-md px-4 py-2 text-lg font-medium text-gray-600 hover:bg-white"
      >
        &larr; Prev Day
      </button>
      <span className="text-lg font-semibold text-gray-700">{formatDateLabel(dateStr)}</span>
      <button
        onClick={onNext}
        className="rounded-md px-4 py-2 text-lg font-medium text-gray-600 hover:bg-white"
      >
        Next Day &rarr;
      </button>
    </div>
  )
}

export default function Search() {
  const navigate = useNavigate()
  const [direction, setDirection] = useState('PB_TO_LIMASAWA')
  const [tripType, setTripType] = useState('oneway')
  const [date, setDate] = useState(today)
  const [returnDate, setReturnDate] = useState(today)
  const [outboundResults, setOutboundResults] = useState(null)
  const [returnResults, setReturnResults] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [heroIndex, setHeroIndex] = useState(0)
  const galleryScrollRef = useRef(null)

  const ports = PORT_NAMES[direction]

  // Auto-advance the hero background slider; still manually jumpable via
  // the dots below the photo.
  useEffect(() => {
    const id = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length)
    }, HERO_SLIDE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  // Advances the mobile gallery carousel by roughly one card. Desktop never
  // calls this since the arrow buttons that trigger it are sm:hidden. The
  // actual looping (landing seamlessly back on a real slide after passing
  // a cloned one) is handled by the settle effect below.
  function scrollGallery(dir) {
    const el = galleryScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  // Finds which gallery card is currently centered in the scroll container.
  function centeredGalleryIndex(el) {
    const target = el.scrollLeft + el.clientWidth / 2
    let closestIndex = 0
    let closestDistance = Infinity
    Array.from(el.children).forEach((child, i) => {
      const center = child.offsetLeft + child.offsetWidth / 2
      const distance = Math.abs(center - target)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = i
      }
    })
    return closestIndex
  }

  // Centers a gallery card horizontally by setting scrollLeft directly,
  // instead of scrollIntoView. scrollIntoView's `block` option can scroll
  // the whole *page* vertically too (to bring the element into view), which
  // fought with the app-wide scroll-to-top-on-navigate behavior whenever
  // this ran right after landing on the page mid-scroll. Setting scrollLeft
  // touches only this container, never the page.
  function centerGalleryChild(el, child) {
    if (!el || !child) return
    el.scrollLeft = child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2
  }

  // Positions the carousel on the real first spot at rest (skipping past the
  // cloned last-spot at index 0), and — once scrolling settles on either
  // cloned end — jumps instantly to the matching real spot so the loop feels
  // seamless instead of dead-ending.
  useEffect(() => {
    const el = galleryScrollRef.current
    if (!el) return

    centerGalleryChild(el, el.children[1])

    let settleTimeout
    function handleScroll() {
      clearTimeout(settleTimeout)
      settleTimeout = setTimeout(() => {
        const lastIndex = el.children.length - 1
        const index = centeredGalleryIndex(el)
        if (index === 0) {
          centerGalleryChild(el, el.children[lastIndex - 1])
        } else if (index === lastIndex) {
          centerGalleryChild(el, el.children[1])
        }
      }, 120)
    }

    el.addEventListener('scroll', handleScroll)
    return () => {
      el.removeEventListener('scroll', handleScroll)
      clearTimeout(settleTimeout)
    }
  }, [])

  function swapDirection() {
    setDirection((prev) => oppositeDirection(prev))
    setOutboundResults(null)
    setReturnResults(null)
  }

  async function runSearch() {
    if (!date) {
      setError('Please choose a departure date.')
      setOutboundResults(null)
      setReturnResults(null)
      return false
    }
    if (tripType === 'roundtrip') {
      if (!returnDate) {
        setError('Please choose a return date.')
        return false
      }
      if (returnDate < date) {
        setError('Return date must be on or after the departure date.')
        return false
      }
    }

    setError('')
    setLoading(true)
    try {
      const outbound = await api.getSchedules(direction, date)
      setOutboundResults(outbound)

      if (tripType === 'roundtrip') {
        const ret = await api.getSchedules(oppositeDirection(direction), returnDate)
        setReturnResults(ret)
      } else {
        setReturnResults(null)
      }
      return true
    } catch (err) {
      setError(err.message)
      setOutboundResults(null)
      setReturnResults(null)
      return false
    } finally {
      setLoading(false)
    }
  }

   function handleSearch() {
    if (!date) { setError('Please choose a departure date.'); return }
    if (tripType === 'roundtrip') {
      if (!returnDate) { setError('Please choose a return date.'); return }
      if (returnDate < date) { setError('Return date must be on or after the departure date.'); return }
    }
    const params = new URLSearchParams({ direction, tripType, date })
    if (tripType === 'roundtrip') params.set('returnDate', returnDate)
    navigate(`/search-results?${params.toString()}`)
  }

  async function changeDepartureDate(deltaDays) {
    const newDate = shiftDate(date, deltaDays)
    setDate(newDate)
    setLoading(true)
    try {
      const outbound = await api.getSchedules(direction, newDate)
      setOutboundResults(outbound)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function changeReturnDate(deltaDays) {
    const newDate = shiftDate(returnDate, deltaDays)
    setReturnDate(newDate)
    setLoading(true)
    try {
      const ret = await api.getSchedules(oppositeDirection(direction), newDate)
      setReturnResults(ret)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function bookTrip(schedule, tripDirection) {
    const params = new URLSearchParams({
      schedule_id: schedule.id,
      fare: schedule.baseFare,
      datetime: schedule.departureDatetime,
      direction: tripDirection,
    })
    navigate(`/booking?${params.toString()}`)
  }

  return (
    <div>

      {/* Hero photo — fixed, generous height so it reads as a proper full
          photo like the OceanJet reference. The search card below is
          absolutely positioned (not pulled up via negative margin), so its
          real rendered height — which changes with round-trip vs one-way,
          error messages, etc. — can never affect where this box ends or
          where the next section starts. `mb-40/48` on this wrapper reserves
          room below it for the card's bottom half, which hangs past the
          photo via `translate-y-1/2`.

          The background itself is now a slider: each HERO_SLIDES entry is
          its own absolutely-positioned layer, crossfaded via opacity so
          there's no dependency on a single static image. */}
     <div className="relative left-1/2 -mt-28 -ml-[50vw] w-screen sm:mb-48 sm:flex sm:h-[760px] sm:items-center">
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.image}
            className={`absolute inset-0 bg-cover bg-no-repeat transition-opacity duration-1000 ${i === heroIndex ? 'opacity-100' : 'opacity-0'}`}
            style={{ backgroundImage: `url(${slide.image})`, backgroundPosition: slide.position }}
          />
        ))}
        <div className="absolute inset-0 bg-black/10" />

        {/* Dots — manual control over the slider, and a visual cue that
            there's more than one photo. Solid fill only, no glow/ring. */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 sm:bottom-6">
          {HERO_SLIDES.map((slide, i) => (
            <button
              key={slide.image}
              type="button"
              onClick={() => setHeroIndex(i)}
              aria-label={`Show background photo ${i + 1} of ${HERO_SLIDES.length}`}
              className={`h-2 w-2 rounded-full transition-colors ${i === heroIndex ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>

        <div className="relative mx-auto max-w-5xl px-4 pt-28 sm:pt-0">
          <h1 className="text-5xl font-bold text-white text-center drop-shadow-xl sm:text-7xl">
            Travel to <span className="italic">Limasawa Island</span> with Ease!
          </h1>
          <p className="mt-1 text-lg text-white/100 text-center drop-shadow-sm sm:text-xl">
            Search available trips and book your seat in minutes.
          </p>
        </div>

        {/* Search form — sits exactly half over the photo, half below it,
            no matter how tall the form itself grows, since it's taken out
            of normal document flow entirely. Spans the full column width
            (matching the headline above) instead of capping at max-w-3xl —
            that cap left the card hugging the left edge with a large empty
            gap beside it, since nothing centered the narrower box. */}
   <div className="relative z-10 mt-6 px-4 pb-10 sm:absolute sm:inset-x-0 sm:bottom-0 sm:mt-0 sm:translate-y-1/2 sm:pb-0">
          <div className="mx-auto w-full max-w-5xl">
            <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-xl sm:p-6">
              <h2 className="text-3xl font-bold text-gray-800 sm:text-4xl">Where's your next adventure?</h2>
              <p className="mt-1 text-lg text-gray-600">Let's make your next trip one to remember.</p>

              <div className="mt-4">
                <SearchFormFields
                  tripType={tripType}
                  setTripType={setTripType}
                  direction={direction}
                  ports={ports}
                  swapDirection={swapDirection}
                  date={date}
                  setDate={setDate}
                  returnDate={returnDate}
                  setReturnDate={setReturnDate}
                  onSearch={handleSearch}
                  loading={loading}
                  error={error}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Landscape promo banner — sits between the search form and the
          gallery below. Same slider mechanism as the hero, just a wider
          aspect ratio and its own image list (BANNER_AD_SLIDES above). */}
      <div className="pt-10 sm:pt-14">
        <BannerAdSlider />
      </div>

      {/* Explore Limasawa Island — a gallery of what's waiting at the other
          end of the crossing. Evershine only serves the one route, so
          unlike a multi-destination carrier this showcases spots on the
          island rather than "popular routes". Labels/descriptions sit in a
          plain card below each photo (no overlay text on the image, no
          gradient) so it stays flat and readable. */}
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <h2 className="text-center text-4xl font-bold text-gray-800 sm:text-5xl">Explore Limasawa Island</h2>
        <p className="mt-2 text-center text-lg text-gray-600 sm:text-xl">
          Historic sites and scenic spots waiting at the other end of your crossing.
        </p>

        {/* Mobile: looping swipe carousel — GALLERY_LOOP clones the last/first
            spot onto each end so a real photo always peeks on both sides,
            even at rest. Arrow buttons since dragging isn't always obvious. */}
        <div className="relative mt-8 sm:hidden">
          <div
            ref={galleryScrollRef}
            className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-[11%] pb-2"
          >
            {GALLERY_LOOP.map((spot, i) => (
              <div
                key={`${spot.name}-${i}`}
                className="w-[78%] flex-shrink-0 snap-center overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <div
                  className="h-64 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${spot.image})`, backgroundPosition: spot.position || 'center' }}
                  role="img"
                  aria-label={spot.name}
                />
                <div className="p-4">
                  <h3 className="text-xl font-semibold text-gray-800">{spot.name}</h3>
                  <p className="mt-1 text-justify text-lg leading-relaxed text-gray-600">{spot.description}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollGallery(-1)}
            aria-label="Previous highlight"
            className="absolute left-2 top-32 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-100"
          >
            <IconChevron className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollGallery(1)}
            aria-label="Next highlight"
            className="absolute right-2 top-32 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm hover:bg-gray-100"
          >
            <IconChevron className="h-4 w-4 rotate-180" />
          </button>
        </div>

        {/* Desktop (sm+): plain grid, untouched by the mobile carousel. */}
        <div className="mt-8 hidden sm:grid sm:grid-cols-2 sm:gap-5 ">
          {LIMASAWA_HIGHLIGHTS.map((spot) => (
            <div key={spot.name} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div
                className="h-64 w-full bg-cover bg-center sm:h-72"
                  style={{ backgroundImage: `url(${spot.image})`, backgroundPosition: spot.position || 'center' }}
                role="img"
                aria-label={spot.name}
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold text-gray-800">{spot.name}</h3>
                <p className="mt-1 text-justify text-lg leading-relaxed text-gray-600">{spot.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

<div className="relative left-1/2 -ml-[50vw] w-screen overflow-hidden bg-[url('/section2-hero-bg.png')] bg-cover bg-top bg-no-repeat">
  <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-10 sm:grid-cols-2 sm:py-24">
    <div className="text-center sm:text-left">
      <img src="/evershine-logo.png" alt="Evershine" className="mx-auto h-16 w-28 sm:mx-0 sm:h-25 sm:w-44" />
      <h2 className="mt-2 text-4xl font-bold text-gray-800 sm:text-5xl">Where We Sail</h2>
      <p className="mt-4 text-lg leading-relaxed text-gray-700 sm:text-xl">
        We connect <span className="font-semibold">Padre Burgos</span> to{' '}
        <span className="font-semibold">Limasawa Island</span>, a short, scenic crossing
        across Southern Leyte's coastal waters.
      </p>
      <p className="mt-4 text-lg leading-relaxed text-gray-700 sm:text-xl">
        Book your seat and set sail on one of Southern Leyte's most historic routes.
      </p>
    </div>
    <div
      className="h-102 w-full bg-[url('/section2-hero.png')] bg-cover bg-[position:75%_55%] bg-no-repeat sm:h-[500px]"
      role="img"
      aria-label="Map of the Padre Burgos to Limasawa ferry route"
    />
  </div>
</div>

      {(outboundResults || returnResults) && (
        <div className="mx-auto max-w-5xl px-4">
          <BookingSteps currentStep="schedule" />

          {outboundResults && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold text-gray-800">
                Departure: {ports.from} &rarr; {ports.to}
              </h3>
              <div className="mt-2">
                <DateNavHeader dateStr={date} onPrev={() => changeDepartureDate(-1)} onNext={() => changeDepartureDate(1)} />
              </div>
              {outboundResults.length === 0 ? (
                <p className="mt-3 text-lg text-gray-500">No trips found for that date.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {outboundResults.map((s) => (
                    <TripCard
                      key={s.id}
                      schedule={s}
                      fromLabel={ports.from}
                      toLabel={ports.to}
                      onBook={() => bookTrip(s, direction)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {tripType === 'roundtrip' && returnResults && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="text-xl font-semibold text-gray-800">
                Return: {ports.to} &rarr; {ports.from}
              </h3>
              <div className="mt-2">
                <DateNavHeader dateStr={returnDate} onPrev={() => changeReturnDate(-1)} onNext={() => changeReturnDate(1)} />
              </div>
              {returnResults.length === 0 ? (
                <p className="mt-3 text-lg text-gray-500">No return trips found for that date.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {returnResults.map((s) => (
                    <TripCard
                      key={s.id}
                      schedule={s}
                      fromLabel={ports.to}
                      toLabel={ports.from}
                      onBook={() => bookTrip(s, oppositeDirection(direction))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {tripType === 'roundtrip' && (outboundResults || returnResults) && (
            <p className="mt-4 pb-6 text-base text-gray-500">
              Book your departure and return trips one at a time, each gets its own reference code and payment.
            </p>
          )}
        </div>
      )}


      <p className="mt-10 text-center text-lg">
        <a href="/manage-booking" className="text-teal-700 hover:underline">
          Already booked? Manage your booking here
        </a>
      </p>
    </div>

  )
}
