// Save as: frontend/src/pages/CookiePolicy.jsx
//
// PLACEHOLDER CONTENT, describes the browser storage Evershine Booking's
// own features actually use (sign-in, remembering this cookie notice) and
// states there are no third-party advertising or tracking cookies, since
// none are used elsewhere in the app. Has not been reviewed by a lawyer;
// confirm wording before publishing.

function Section({ title, children }) {
  return (
    <section className="border-t border-gray-100 py-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  )
}

export default function CookiePolicy() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800">Cookie Policy</h1>
      <p className="mt-1 text-sm text-gray-600">
        This page explains how Evershine Booking uses cookies and similar browser storage. It is a general
        placeholder pending legal review, please confirm it matches your actual practices before publishing.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <Section title="What Cookies Are">
          <p>
            Cookies are small pieces of data a website stores in your browser. Evershine Booking mostly relies on
            similar browser storage, such as local storage, rather than traditional cookies, to support the
            features described below.
          </p>
        </Section>

        <Section title="How We Use Cookies and Local Storage">
          <p>
            We use this storage to keep you signed in to your account between visits, remember that you've
            acknowledged this site's cookie notice, and maintain the state of an in-progress booking as you move
            between pages.
          </p>
        </Section>

        <Section title="Third-Party Cookies">
          <p>
            We do not use third-party advertising or analytics cookies. Any promotional images shown on the site
            are static content served from Evershine Booking itself, not third-party ad networks.
          </p>
        </Section>

        <Section title="Managing Cookies">
          <p>
            Most browsers let you clear or block cookies and local storage through their settings. Doing so may
            sign you out, or cause this cookie notice to reappear the next time you visit.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this policy from time to time. Continued use of Evershine Booking after changes take
            effect means you accept the updated policy.
          </p>
        </Section>
      </div>
    </div>
  )
}
