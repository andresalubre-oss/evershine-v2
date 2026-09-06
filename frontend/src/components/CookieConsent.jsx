// Save as: frontend/src/components/CookieConsent.jsx
//
// A sticky bottom notice shown to first-time visitors. Dismissed once via
// the "I Agree" button and remembered in localStorage, so it doesn't show
// again on later visits from the same browser. Visibility is owned by
// Layout.jsx (not this component) so the chat widget can also react to it
// and lift itself out of the way while the banner is on screen.

import { Link } from 'react-router-dom'

export const COOKIE_CONSENT_STORAGE_KEY = 'evershine-cookie-consent'

export default function CookieConsent({ visible, onAgree }) {
  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-teal-900 bg-teal-950 shadow-lg">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-4 sm:flex-row sm:gap-6 sm:py-5">
        <div className="text-center sm:text-left">
          <p className="text-md font-semibold text-white sm:text-xl">We Value Your Privacy</p>
          <p className="mt-1 text-sm text-gray-200 sm:text-base">
            We use cookies and similar browser storage to keep you signed in, remember an in
            progress booking as you move between pages, and remember that you've seen this
            notice. We don't use third-party advertising or tracking cookies. By continuing to
            use this website, you agree to comply with our{' '}
            <Link to="/terms-conditions" className="font-medium text-white hover:text-white hover:underline">
              Terms and Conditions
            </Link>
            , <Link to="/privacy-policy" className="font-medium text-white hover:text-white hover:underline">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link to="/cookie-policy" className="font-medium text-white hover:text-white hover:underline">
              Cookie Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex w-full flex-shrink-0 items-center justify-center gap-3 sm:w-auto sm:justify-end">
          <button
            onClick={onAgree}
            className="flex-1 whitespace-nowrap rounded-md bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-600 sm:flex-none sm:text-base"
          >
            I Agree
          </button>
          <button
            onClick={onAgree}
            aria-label="Dismiss cookie notice"
            className="flex-shrink-0 rounded-md px-2 py-1 text-lg font-medium leading-none text-teal-300 transition-colors hover:bg-teal-900 hover:text-white"
          >
            &times;
          </button>
        </div>
      </div>
    </div>
  )
}
