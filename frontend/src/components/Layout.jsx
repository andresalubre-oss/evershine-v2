import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function IconUser(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" d="M4 21c1.5-4.5 5-6 8-6s6.5 1.5 8 6" />
    </svg>
  )
}

export default function Layout() {
  const { customer } = useAuth()
  const location = useLocation()
  // The admin dashboard has its own sidebar/Log Out — the customer-facing
  // nav (Book, Refund & Cancellation, Travel Info, etc.) doesn't belong there.
  const isAdminDashboard = location.pathname === '/admin'
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [travelInfoOpen, setTravelInfoOpen] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Items with a `children` array render as a dropdown instead of a plain link.
  // The account/login link is handled separately below (not in this array)
  // since it needs a two-line icon treatment instead of a plain text link.
  const navLinks = [
    { to: '/', label: 'Book' },
    { to: '/Book', label: 'Refund & Cancellation' },
    {
      label: 'Travel Info',
      children: [
        { to: '/travel-info/policies', label: 'Policies' },
        { to: '/travel-info/faqs', label: 'FAQs' },
      ],
    },
    { to: '/manage-booking', label: 'Manage Booking' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {!isAdminDashboard && (
      <div className="fixed inset-x-0 top-0 z-50 bg-white text-black shadow-md">
        <div className="flex items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold" onClick={() => setMenuOpen(false)}>
            <div className="flex items-center gap-2">
              <img src="/EVERSHINE LOGO.png" alt="Evershine" className="h-15 w-30" />
            </div>
          </Link>

          {/* Desktop nav — hidden by default, shown from md: (768px) up */}
          <nav className="hidden md:flex md:items-center gap-10 text-sm">
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
                    className="flex items-center gap-1 border-b-2 border-transparent pb-1 text-lg font-medium transition-colors hover:border-teal-700"
                  >
                    {link.label}
                    <svg
                      className={`h-4 w-4 transition-transform ${travelInfoOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {travelInfoOpen && (
                    <div className="absolute left-0 top-full w-40 rounded-md border border-gray-200 bg-white py-2 shadow-lg">
                      {link.children.map((child) => (
                        <Link
                          key={child.to}
                          to={child.to}
                          onClick={() => setTravelInfoOpen(false)}
                          className="block px-4 py-2 text-sm text-black hover:bg-gray-100"
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
                  className="border-b-2 border-transparent pb-1 text-lg font-medium transition-colors hover:border-teal-700"
                >
                  {link.label}
                </Link>
              )
            )}

            {/* Account — profile icon + "Account" with a "Mabuhay, {name}" greeting
                underneath when logged in; a plain icon + "Log In" otherwise. */}
            {customer ? (
              <Link to="/account" className="flex items-center gap-2.5 rounded-md px-1 hover:bg-gray-50">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <IconUser className="h-5 w-5" />
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-base font-semibold">Account</span>
                  <span className="block text-xs font-normal text-gray-500">Mabuhay, {customer.name.split(' ')[0]}</span>
                </span>
              </Link>
            ) : (
              <>
                <Link to="/account/login" className="flex items-center gap-2 rounded-md px-1 hover:bg-gray-50">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                    <IconUser className="h-5 w-5" />
                  </span>
                  <span className="text-lg font-medium">Log In</span>
                </Link>
                <Link
                  to="/register"
                  className="whitespace-nowrap rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
                >
                  Register
                </Link>
              </>
            )}
          </nav>

          {/* Hamburger button — only visible below md: (768px) */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-gray-100 md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

            {/* Account — same icon treatment as desktop, stacked into the mobile list. */}
            {customer ? (
              <Link
                to="/account"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-gray-100"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <IconUser className="h-5 w-5" />
                </span>
                <span className="text-left leading-tight">
                  <span className="block font-semibold">Account</span>
                  <span className="block text-xs font-normal text-gray-500">Mabuhay, {customer.name.split(' ')[0]}</span>
                </span>
              </Link>
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

      <main className={`mx-auto max-w-5xl px-4 py-8 ${isAdminDashboard ? '' : 'pt-28'}`}>
        <Outlet />
      </main>
    </div>
  )
}
