// Save as: frontend/src/pages/Policies.jsx

function Section({ title, children }) {
  return (
    <section className="border-t border-gray-100 py-7 first:border-t-0 first:pt-0">
      <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
      <div className="mt-2 space-y-2 text-lg leading-relaxed text-gray-600">{children}</div>
    </section>
  )
}

// Single static landscape ad poster shown above the page title. Not a
// slider — drop one banner image into frontend/public/ and point this at
// it. object-cover fills the box edge-to-edge (crops overflow); switch to
// object-contain instead if you'd rather see the whole poster with letterbox
// bars when its aspect ratio doesn't match.
const AD_BANNER_IMAGE = '/magellancross-policies.png'


export default function Policies() {
  
  return (
  
    <div className="mx-auto max-w-5xl">
      {AD_BANNER_IMAGE && (
  <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
    <img
      src={AD_BANNER_IMAGE}
      alt="Promotion"
      className="aspect-[3/1] w-full object-cover"
    />
  </div>
)}
      <h1 className="text-4xl font-bold text-gray-800">Travel Policies</h1>
      <p className="mt-1 text-lg text-justify text-gray-600">
        Please review these policies before your trip between Padre Burgos and Limasawa. If anything here is
        unclear, reach out through our contact details on the Travel Info page.
      </p>

      <div className="mt-6 rounded-lg border text-justify border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <Section title="Booking &amp; Payment">
          <p>
            Every booking is confirmed only after payment is received and reflected as{' '}
            <span className="font-medium text-gray-800">Confirmed</span> on your booking status. Keep your
            reference code you'll need it to manage, look up, or cancel your booking, and to check in at the
            terminal.
          </p>
          <p>
            We recommend booking at least a day in advance, especially during weekends and holidays, since seats
            are limited to the ferry's capacity for each sailing.
          </p>
        </Section>

        <Section title="Check-in &amp; Boarding">
          <p>
            Please arrive at the terminal at least <span className="font-medium text-gray-800">30 minutes</span>{' '}
            before your scheduled departure. Boarding closes shortly before departure, and late arrivals may
            forfeit their seat without a refund.
          </p>
          <p>Bring a valid government-issued ID matching the name on your booking for every adult passenger.</p>
        </Section>

        <Section title="Valid ID &amp; Discount Eligibility">
          <p>
            Senior Citizen, PWD, and Student discounts are only honored for passengers whose account has
            completed <span className="font-medium text-gray-800">Profile Verification</span> a one-time
            process where you submit a live photo and a valid ID for review. Once approved, the discount applies
            automatically to your bookings while logged in.
          </p>
          <p>
            Please also bring the physical ID used for verification when boarding, as terminal staff may ask to
            see it alongside your booking confirmation.
          </p>
        </Section>

        <Section title="Baggage">
          <p>
            Each passenger may bring one piece of hand-carried baggage reasonable for a short island crossing.
            Bulky cargo, construction materials, or commercial goods should be coordinated with the terminal in
            advance and may be subject to additional handling fees.
          </p>
          <p>Prohibited items include flammable, explosive, and other hazardous materials.</p>
        </Section>

        <Section title="Cancellations &amp; Rebooking">
          <p>
            You can look up a booking anytime from{' '}
            <a href="/manage-booking" className="text-teal-700 hover:underline">Manage Booking</a> using your
            reference code and contact email. Cancellation requests must be submitted within{' '}
            <span className="font-medium text-gray-800">24 hours of making the booking</span> this window is
            based on when you booked, not how far away departure is.
          </p>
          <p>
            Refunds aren't automatic: submitting a cancellation puts your booking under manual review, and an
            admin sends the refund once your reason is verified. See our Refund &amp; Cancellation page for the
            full policy.
          </p>
        </Section>

        <Section title="Weather &amp; Trip Cancellations">
          <p>
            Padre Burgos Limasawa crossings can be affected by weather advisories from PAGASA or the Philippine
            Coast Guard. If a sailing is cancelled or suspended for safety reasons, affected passengers will be
            offered a full refund or free rebooking to the next available trip passenger safety always comes
            first, even if it means a delay.
          </p>
        </Section>

        <Section title="Children &amp; Infants">
          <p>
            Children are charged the standard adult fare unless a specific child fare is shown at checkout for a
            given sailing. Infants travelling on a parent's or guardian's lap generally do not require a separate
            seat please confirm with the terminal if you're travelling with an infant.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            For anything not covered here group bookings, special assistance, or cargo requests please get in
            touch through the contact details on our Travel Info page before your travel date.
          </p>
        </Section>
      </div>
    </div>
  )
}
