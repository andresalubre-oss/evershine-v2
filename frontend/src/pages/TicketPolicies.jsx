// Save as: frontend/src/pages/TicketPolicies.jsx

const CLAUSES = [
  {
    title: 'Validity of Your Ticket',
    body: `A booking is valid only for the specific sailing, date, and passengers named on it. It cannot be
      transferred to another person or used on a different trip. If a ticket is lost, we're unable to reissue
      or refund it — keep your reference code and confirmation email safe. Requests to revalidate or refund a
      ticket must be made within 6 months of the original booking date.`,
  },
  {
    title: 'Passenger Conduct',
    body: `By booking with us, you agree to follow crew and terminal staff instructions and to treat our
      personnel with courtesy. We are not responsible for losses a passenger suffers as a result of ignoring
      posted rules, safety instructions, or the lawful directions of terminal or port authorities.`,
  },
  {
    title: 'Check-in Cut-off',
    body: `Passengers must check in at the terminal at least 30 minutes before the scheduled departure. Arriving
      after check-in has closed may result in losing your reserved seat, with no guarantee of a refund. We may
      also conduct routine baggage and security checks before boarding.`,
  },
  {
    title: 'Baggage Allowance',
    body: `Each passenger may bring hand-carried baggage limited to personal items only. As a guide, keep bags
      to around 10 kg and a size that comfortably fits in the overhead or under-seat storage — oversized cargo,
      construction materials, or bulk commercial goods should be arranged with the terminal ahead of time and
      may involve extra handling. Our liability for loss or damage to hand-carried or checked baggage is limited
      to the amount set under applicable Philippine maritime transport regulations, unless a higher value was
      declared and paid for in advance.`,
  },
  {
    title: 'Restricted & Prohibited Items',
    body: `Firearms, explosives, flammable substances, and other hazardous materials are not allowed aboard.
      Any firearm must be declared and surrendered to the vessel's captain or head of security before boarding.
      We also reserve the right to decline carriage of live animals or plants.`,
  },
  {
    title: 'Right to Refuse Boarding',
    body: `For the safety of everyone aboard, we may decline boarding to passengers who appear seriously ill,
      show signs of a contagious condition, or — depending on sea conditions and vessel type — passengers who
      are visibly pregnant. Where possible, staff will explain the reason and help you rebook.`,
  },
  {
    title: 'Unclaimed Baggage',
    body: `Any baggage left unclaimed for more than 2 days after a voyage's completion may be disposed of in
      accordance with applicable law, and reasonable storage costs may be charged before release.`,
  },
  {
    title: 'Refunds & Revalidation',
    body: `Refunds and rebooking follow the rules described on our Refund & Cancellation page and applicable
      government regulations. A ticket cannot be refunded or revalidated once you have checked in but did not
      board the vessel.`,
  },
  {
    title: 'Delays & Trip Cancellations',
    body: `We are not liable for meals, accommodation, or other costs a passenger incurs because of a delayed or
      cancelled sailing. When a trip cannot push through — most often due to weather advisories from PAGASA or
      the Philippine Coast Guard — we will offer either a seat on the next available sailing to the same
      destination or a refund of the ticket's value.`,
  },
  {
    title: 'Claims & Filing Deadlines',
    body: `We are not responsible for events beyond reasonable control or that could not have been foreseen.
      Claims relating to passenger injury must be filed within 30 days of disembarkation or the vessel's arrival
      at its destination, whichever comes first. Claims for lost, damaged, or deteriorated baggage must be
      reported within 24 hours of receiving it, and any related legal action must be filed within 60 days of
      when the claim first arose.`,
  },
  {
    title: 'Governing Terms',
    body: `These policies are in addition to the specific rules for your booking shown at checkout and posted at
      our terminals. Where the two conflict, the version posted at the terminal or on this website at the time
      of travel will apply. Disputes arising from a booking made through Evershine Booking are subject to the
      jurisdiction of the courts of Southern Leyte.`,
  },
]

export default function TicketPolicies() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800">Ticket Policies</h1>
      <p className="mt-1 text-sm text-gray-600">
        These are the terms and conditions that apply to every ticket booked through Evershine Booking for
        travel between Padre Burgos and Limasawa.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <ol className="space-y-6">
          {CLAUSES.map((clause, i) => (
            <li key={clause.title} className="border-t border-gray-100 pt-6 first:border-t-0 first:pt-0">
              <h2 className="text-sm font-semibold text-gray-800">
                {i + 1}. {clause.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{clause.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        This page summarizes our ticket terms for general reference. Figures such as baggage weight and liability
        limits should be reviewed against current Philippine maritime transport regulations before publishing.
      </p>
    </div>
  )
}
