import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import ChatWidget from './ChatWidget.jsx'
import CookieConsent, { COOKIE_CONSENT_STORAGE_KEY } from './CookieConsent.jsx'
import Footer from './Footer.jsx'

function IconUser(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" d="M4 21c1.5-4.5 5-6 8-6s6.5 1.5 8 6" />
    </svg>
  )
}

function initialsOf(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('') || '?'
}

// The nav's Account link shows the customer's real profile photo (the live
// selfie from Profile Verification — same one shown on the Account
// dashboard) once they're logged in, instead of a generic person icon.
// Falls back to a solid initials badge if they haven't submitted one yet.
function AccountAvatar({ photoUrl, name }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt="Your profile photo"
        className="h-9 w-9 flex-shrink-0 rounded-full border border-gray-200 object-cover"
      />
    )
  }
  return (
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-teal-700 bg-teal-700 text-xs font-bold text-white">
      {initialsOf(name)}
    </span>
  )
}

export default function Layout() {
  const { customer, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  // The admin dashboard has its own sidebar/Log Out — the customer-facing
  // nav (Book, Refund & Cancellation, Travel Info, etc.) doesn't belong there.
  const isAdminDashboard = location.pathname === '/admin'
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [travelInfoOpen, setTravelInfoOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [showCookieConsent, setShowCookieConsent] = useState(false)

  function handleLogout() {
    setAccountMenuOpen(false)
    setMenuOpen(false)
    logout()
    navigate('/')
  }

  // Shown once to first-time visitors, then remembered in localStorage so
  // it doesn't reappear on later visits from the same browser.
  useEffect(() => {
    const hasAgreed = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === 'agreed'
    if (!hasAgreed) setShowCookieConsent(true)
  }, [])

  function handleAgreeToCookies() {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, 'agreed')
    setShowCookieConsent(false)
  }

  useEffect(() => {
    // A single fixed threshold (e.g. "solid past 10px") flips back and
    // forth on every tiny scroll jitter right at that line, which is what
    // reads as the nav text (Travel Info especially, since it's the widest
    // element with the most visible color change) blinking on every
    // scroll. Two thresholds with a gap between them (go solid past 80px,
    // only go back transparent once above 20px) means a few pixels of
    // jitter can't cross both boundaries, so the bar settles into one
    // state instead of flickering.
    function handleScroll() {
      setScrolled((prev) => (prev ? window.scrollY > 20 : window.scrollY > 80))
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Fetched once per login (and re-fetched if the logged-in customer
  // changes) — same source as the Account dashboard's hero photo.
  useEffect(() => {
    if (!customer) {
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    let cancelled = false
    api.getMyPhotoUrl().then((url) => {
      if (cancelled) return
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id])

  // Items with a `children` array render as a dropdown instead of a plain link.
  // The account/login link is handled separately below (not in this array)
  // since it needs a two-line icon treatment instead of a plain text link.
  const navLinks = [
    { to: '/', label: 'Book' },
    { to: '/refund-cancellation', label: 'Refund & Cancellation' },
    {
      label: 'Travel Info',
      children: [
        { to: '/travel-info/policies', label: 'Policies' },
        { to: '/travel-info/ticket-policies', label: 'Ticket Policies' },
        { to: '/travel-info/faqs', label: 'FAQs' },
        { to: '/directions', label: 'Port Directions' },
      ],
    },
    { to: '/manage-booking', label: 'Manage Booking' },
    { to: '/contact-us', label: 'Contact Us' },
  ]

  // Transparent over the hero photo while at the very top of the Book page
  // (the only page with a photo directly under the nav), then a solid white
  // bar with dark text once scrolled. Every other page keeps the solid bar
  // at all times, since there's nothing but plain page background behind it
  // there. The mobile dropdown panel also doesn't have its own opaque
  // background, so opening it forces the solid look too, otherwise its
  // links would render as white text with nothing behind them.
  const isBookPage = location.pathname === '/'
  const navIsSolid = !isBookPage || scrolled || menuOpen

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {!isAdminDashboard && (
      <div
        // Only background-color and box-shadow animate here, deliberately
        // not text color. Animating white text to black passes through gray
        // partway through, and gray text over a photo with wildly different
        // brightness in different spots (dark rock vs. bright sky) reads as
        // legible in some places and nearly invisible in others at that
        // exact same instant, looking like the words are transitioning at
        // different speeds even though every one of them is on the same
        // duration. Leaving color out of the transition list makes it snap
        // instantly instead, so text is always fully one color or the
        // other, never a see-through-the-photo gray, while the background
        // and shadow still fade in smoothly underneath it.
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-500 ease-in-out ${
          navIsSolid ? 'bg-white text-black shadow-md' : 'bg-transparent text-white shadow-none'
        }`}
      >
        {/* Over the transparent hero photo, the logo (and to a lesser
            extent the nav text) can disappear into busy backgrounds
            (foliage, dark water). A soft white gradient across the whole
            bar gives everything in it a light backdrop to sit on; it
            fades out once the bar goes solid white on scroll, since it
            would be redundant there. Kept always mounted (opacity-only
            toggle) instead of conditionally rendered, so it fades instead
            of popping in and out. */}
        <div
          className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/60 to-transparent transition-opacity duration-500 ease-in-out ${
            navIsSolid ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {/* The white gradient above lightens whatever's directly behind the
            bar, which helps a lot over dark rock/foliage but does almost
            nothing over the already-bright sky, so the same white text can
            read as crisp in one spot and washed-out a few words later,
            depending purely on what photo detail happens to sit behind it.
            A drop-shadow doesn't have that problem: it darkens the edge of
            the text itself, so it adds contrast the same way everywhere,
            regardless of background brightness. Applied once here (not
            per-item) so every child, logo included, gets the identical
            shadow with zero risk of one item drifting out of sync with the
            rest, the way separately-set classes could. */}
        <div
          className={`flex items-center justify-between px-6 py-5 transition-all duration-500 ease-in-out ${
            navIsSolid ? '' : 'drop-shadow-md'
          }`}
        >
          <Link to="/" className="text-xl font-bold" onClick={() => setMenuOpen(false)}>
            <div className="flex items-center gap-2">
              <img src="/evershine-logo.png" alt="Evershine" className="h-16 w-32" />
            </div>
          </Link>

          {/* Desktop nav — hidden by default, shown from md: (768px) up */}
          <nav className="hidden md:flex md:items-center gap-10 text-base">
            {navLinks.map((link) =>
              link.children ? (
                // ---- Dropdown item (Travel Info) ----
                <div
                  key={link.label}
                  className="relative -mb-3 pb-3"
                  onMouseEnter={() => setTravelInfoOpen(true)}
                  onMouseLeave={() => setTravelInfoOpen(false)}
                >
                  <button
                    onClick={() => setTravelInfoOpen(!travelInfoOpen)}
                    className="flex items-center gap-1 border-b-2 border-transparent pb-1 text-xl font-medium transition-[border-color] duration-500 ease-in-out hover:border-teal-950"
                  >
                    {link.label}
                    <svg
                      className={`h-5 w-5 transition-transform ${travelInfoOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {travelInfoOpen && (
                    <div className="absolute left-0 top-full w-44 rounded-md border border-gray-200 bg-white py-2 shadow-lg">
                      {link.children.map((child) => (
                        <Link
                          key={child.to}
                          to={child.to}
                          onClick={() => setTravelInfoOpen(false)}
                          className="block px-4 py-2.5 text-base text-black hover:bg-gray-100"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // ---- Plain link (everything else) ----
                <Link
                  key={link.to}
                  to={link.to}
                  className="border-b-2 border-transparent pb-1 text-xl font-medium transition-[border-color] duration-500 ease-in-out hover:border-teal-950"
                >
                  {link.label}
                </Link>
              )
            )}

            {/* Account — profile photo + "Account" with a "Mabuhay, {name}" greeting
                underneath when logged in, opening a dropdown with the account link
                and Log Out; a plain icon + "Log In" otherwise. */}
            {customer ? (
              <div
                className="relative -mb-3 pb-3"
                onMouseEnter={() => setAccountMenuOpen(true)}
                onMouseLeave={() => setAccountMenuOpen(false)}
              >
                <button
                  onClick={() => setAccountMenuOpen((v) => !v)}
                  className="flex items-center gap-2.5 border-b-2 border-transparent px-1 pb-1 transition-[border-color] duration-500 ease-in-out hover:border-teal-950"
                >
                  <AccountAvatar photoUrl={photoUrl} name={customer.name} />
                  <span className="text-left leading-tight">
                    <span className="block text-lg font-semibold">Account</span>
                    <span
                      className={`block text-sm font-normal ${
                        navIsSolid ? 'text-gray-500' : 'text-white/80'
                      }`}
                    >
                      Mabuhay, {customer.name.split(' ')[0]}
                    </span>
                  </span>
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 top-full w-48 rounded-md border border-gray-200 bg-white py-2 shadow-lg">
                    <Link
                      to="/account"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-4 py-2.5 text-base text-black hover:bg-gray-100"
                    >
                      My Account
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full px-4 py-2.5 text-left text-base text-black hover:bg-gray-100"
                    >
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  to="/account/login"
                  className="flex items-center gap-2 border-b-2 border-transparent px-1 pb-1 transition-[border-color] duration-500 ease-in-out hover:border-teal-950"
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                    <IconUser className="h-6 w-6" />
                  </span>
                  <span className="text-xl font-medium">Log In</span>
                </Link>
                <Link
                  to="/register"
                  className="whitespace-nowrap rounded-md bg-teal-700 px-6 py-2.5 text-base font-semibold text-white transition-colors duration-500 ease-in-out hover:bg-teal-800"
                >
                  Register
                </Link>
              </>
            )}
          </nav>

          {/* Hamburger button — only visible below md: (768px) */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-md transition-[background-color] duration-500 ease-in-out hover:bg-gray-100 md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown panel — only rendered when menuOpen is true */}
        {menuOpen && (
          <nav className="flex flex-col gap-1 border-t border-gray-200 px-6 py-4 md:hidden">
            {navLinks.map((link) =>
              link.children ? (
                // ---- Dropdown item on mobile: label + indented children, always expanded ----
                <div key={link.label} className="flex flex-col">
                  <span className="px-3 py-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                    {link.label}
                  </span>
                  {link.children.map((child) => (
                    <Link
                      key={child.to}
                      to={child.to}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-md px-6 py-2 font-medium hover:bg-gray-100"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2 font-medium hover:bg-gray-100"
                >
                  {link.label}
                </Link>
              )
            )}

            {/* Account — same photo treatment as desktop, plus a Log Out item
                stacked right below it (the mobile panel is already a fully
                expanded list, so there's no need for a separate dropdown here). */}
            {customer ? (
              <>
                <Link
                  to="/account"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-gray-100"
                >
                  <AccountAvatar photoUrl={photoUrl} name={customer.name} />
                  <span className="text-left leading-tight">
                    <span className="block font-semibold">Account</span>
                    <span className="block text-xs font-normal text-gray-500">Mabuhay, {customer.name.split(' ')[0]}</span>
                  </span>
                </Link>
                <button onClick={handleLogout} className="rounded-md px-3 py-2 text-left font-medium hover:bg-gray-100">
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/account/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 font-medium hover:bg-gray-100"
                >
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                    <IconUser className="h-5 w-5" />
                  </span>
                  Log In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 rounded-md bg-teal-700 px-3 py-2 text-center font-semibold text-white hover:bg-teal-800"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
      )}

      <main className={isAdminDashboard ? 'flex-1' : 'mx-auto w-full max-w-5xl flex-1 px-4 py-8 pt-28'}>
        <Outlet />
      </main>

      {!isAdminDashboard && <Footer />}
      {!isAdminDashboard && <ChatWidget liftedByBanner={showCookieConsent} />}
      {!isAdminDashboard && (
        <CookieConsent visible={showCookieConsent} onAgree={handleAgreeToCookies} />
      )}
    </div>
  )
}
