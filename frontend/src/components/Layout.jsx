import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'

export default function Layout() {
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
      <div className="fixed inset-x-0 top-0 z-50 bg-white text-black shadow-md">
        <div className="flex items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold" onClick={() => setMenuOpen(false)}>
            <div className="flex items-center gap-2">
              <img src="/EVERSHINE LOGO.png" alt="Evershine" className="h-15 w-30" />
            </div>
          </Link>

          {/* Desktop nav — hidden by default, shown from md: (768px) up */}
          <nav className="hidden md:flex gap-10 text-sm">
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
                          className="block px-4 py-2 text-lg text-black hover:bg-gray-100"
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
          </nav>
        )}
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8 pt-28">
        <Outlet />
      </main>
    </div>
  )
}
