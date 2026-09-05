import { Link } from 'react-router-dom'

function IconPhone(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  )
}
function IconMail(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 6l-10 7L2 6" />
    </svg>
  )
}
function IconPin(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

const QUICK_LINKS = [
  { to: '/', label: 'Book a Trip' },
  { to: '/manage-booking', label: 'Manage Booking' },
  { to: '/refund-cancellation', label: 'Refund & Cancellation' },
  { to: '/travel-info/policies', label: 'Policies' },
  { to: '/travel-info/ticket-policies', label: 'Ticket Policies' },
  { to: '/travel-info/faqs', label: 'FAQs' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <img src="/evershine-logo.png" alt="Evershine" className="h-12 w-auto" />
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Relax, unwind, explore take you to Limasawa fast and easy.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-800">Quick Links</h3>
          <ul className="mt-3 space-y-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-gray-600 hover:text-teal-700 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-800">Customer Support</h3>
          {/* Placeholder contact details — replace with your real support
              email, phone number, and terminal address. */}
          <p className="mt-3 text-sm font-semibold text-gray-800">Padre Burgos Terminal</p>
          <p className="mt-1 flex items-start gap-2 text-sm text-gray-600">
            <IconPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
            <span>Padre Burgos Port, Southern Leyte, 6600 Philippines</span>
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <IconPhone className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span>+63 924565632</span>
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <IconMail className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span>evershine.booking@gmail.com</span>
          </p>
        </div>
      </div>

      <div className="border-t border-gray-100 py-4">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-gray-500">
          <span>&copy; {year} Evershine Booking</span>
          <span className="text-gray-300">|</span>
          <Link to="/privacy-policy" className="hover:text-teal-700 hover:underline">Privacy Policy</Link>
          <span className="text-gray-300">|</span>
          <Link to="/terms-conditions" className="hover:text-teal-700 hover:underline">Terms &amp; Conditions</Link>
        </p>
      </div>
      <div className="border-t border-gray-100 py-4">
         <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-gray-500">
            Disclaimer: This website is for educational purposes only. Ayaw intawn mi ipakiha.Kapoy na baja skuyla nga way kwarta. All the details provided is not accurate and is subject for changes.</p>
      </div>
    </footer>
  )
}
