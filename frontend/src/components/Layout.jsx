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
  const isAdminDashboard = location.pathname === '/admin/dashboard' || location.pathname === '/coastguard'
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

  useEffect(() => {
    const hasAgreed = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === 'agreed'
    if (!hasAgreed) setShowCookieConsent(true)
  }, [])

  function handleAgreeToCookies() {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, 'agreed')
    setShowCookieConsent(false)
  }

  useEffect(() => {
  
    function handleScroll() {
      setScrolled((prev) => (prev ? window.scrollY > 20 : window.scrollY > 80))
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

 
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

  }, [customer?.id])


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

  const isBookPage = location.pathname === '/'
  const navIsSolid = !isBookPage || scrolled || menuOpen

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {!isAdminDashboard && (
      <div
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-500 ease-in-out ${
          navIsSolid ? 'bg-white text-black shadow-md' : 'bg-transparent text-white shadow-none'
        }`}
      >
       
        <div
          className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-white/60 to-transparent transition-opacity duration-500 ease-in-out ${
            navIsSolid ? 'opacity-0' : 'opacity-100'
          }`}
        />
    
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

     
          <nav className="hidden md:flex md:items-center gap-10 text-base">
            {navLinks.map((link) =>
              link.children ? (
        
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
   
                <Link
                  key={link.to}
                  to={link.to}
                  className="border-b-2 border-transparent pb-1 text-xl font-medium transition-[border-color] duration-500 ease-in-out hover:border-teal-950"
                >
                  {link.label}
                </Link>
              )
            )}

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
