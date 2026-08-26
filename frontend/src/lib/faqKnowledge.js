// Save as: frontend/src/lib/faqKnowledge.js
//
// Shared question/answer content for both the FAQs page and the help
// chat widget — one source of truth so the two never drift apart. No AI
// involved: the widget just scores each entry by how many meaningful words
// it shares with what the visitor typed, and returns the best match above
// a minimum threshold.

export const FAQS = [
  {
    q: 'What do I need to present when boarding?',
    a: `Bring your booking reference code (from your confirmation email) along with a valid government-issued ID
      matching the name on your ticket. If a Senior, PWD, or Student discount is applied, also bring the physical
      ID you used for Profile Verification — terminal staff may ask to see it.`,
    keywords: ['boarding', 'requirements', 'bring', 'id'],
  },
  {
    q: 'Can I transfer my ticket to another person?',
    a: `No. A booking is tied to the passenger names entered at checkout and can't be transferred to a different
      person. If your plans change, cancel through Manage Booking and rebook under the correct name instead.`,
    keywords: ['transfer', 'give', 'someone else', 'change name'],
  },
  {
    q: 'What if I miss my boarding — can I get a refund?',
    a: `Once check-in has closed or you've missed your sailing, the seat is generally forfeited and isn't
      eligible for a refund. Cancelling ahead of time through Manage Booking gives you more options — see our
      Refund & Cancellation page for the specific cutoffs.`,
    keywords: ['missed', 'no show', 'late', 'forfeit'],
  },
  {
    q: 'What happens if Evershine cancels or delays the trip?',
    a: `If we cancel a sailing — most often due to a weather advisory from PAGASA or the Philippine Coast Guard —
      you'll be offered a full refund or a free rebooking to the next available trip. We'll reach out using the
      contact details on your booking.`,
    keywords: ['weather', 'delay', 'cancelled by evershine', 'trip cancelled', 'suspended'],
  },
  {
    q: 'Do I get a full refund if you cancel the voyage?',
    a: `Yes. If the cancellation is on our end, you're entitled to the full value of your ticket back, or a free
      seat on the next available sailing — whichever you prefer.`,
    keywords: ['full refund', 'company cancelled'],
  },
  {
    q: 'Can I get a refund after I have already boarded?',
    a: `No. Once a ticket has been used to board, it's considered consumed and isn't refundable, even if you
      disembark early or change your onward plans.`,
    keywords: ['already boarded', 'used ticket'],
  },
  {
    q: 'When is a refund not possible?',
    a: `Refunds aren't available for a completed trip, a missed sailing you checked in for but didn't board, or a
      ticket outside the refund window described on our Refund & Cancellation page.`,
    keywords: ['not refundable', 'no refund'],
  },
  {
    q: 'What is the cancellation policy? Can I cancel my booking?',
    a: `You can request a cancellation from Manage Booking within 24 hours of making the booking — this window is
      based on when you booked, not how far away departure is. Refunds aren't automatic: your request goes to an
      admin for manual review, and the refund is sent once your reason is verified. See our Refund & Cancellation
      page for the full details.`,
    keywords: ['cancel', 'cancellation', '24 hours', 'refund policy'],
  },
  {
    q: 'How do I cancel or look up my booking?',
    a: `Go to Manage Booking and enter your reference code plus the email you used at checkout. From there you
      can view your booking details and submit a cancellation request if you're still within 24 hours of when
      you booked — an admin will review it and process the refund manually.`,
    keywords: ['manage booking', 'look up', 'find my booking', 'reference code'],
  },
  {
    q: 'How much baggage can I bring on board?',
    a: `Each passenger may bring hand-carried baggage containing personal items only, kept to roughly 10 kg.
      Larger loads or commercial cargo should be arranged with the terminal ahead of your trip.`,
    keywords: ['baggage', 'luggage', 'bags', 'weight limit'],
  },
  {
    q: 'How long do I have to claim baggage left at the terminal?',
    a: `Please claim any left-behind baggage within 2 days of your voyage. Items unclaimed after that may be
      disposed of, and reasonable storage fees may apply before release.`,
    keywords: ['claim baggage', 'lost and found', 'left behind'],
  },
  {
    q: 'Can a sick passenger board?',
    a: `Passengers with mild, non-contagious conditions are generally fine to travel. For everyone's safety, we
      may decline boarding to passengers showing signs of a serious or contagious illness.`,
    keywords: ['sick', 'illness', 'contagious'],
  },
  {
    q: 'Are pregnant passengers allowed to board?',
    a: `In most cases, yes — but given the open-water crossing, we recommend checking with your doctor beforehand
      if you're in your third trimester or have a high-risk pregnancy, and letting terminal staff know when you
      check in.`,
    keywords: ['pregnant', 'pregnancy'],
  },
  {
    q: 'Can I bring plants, fish, vegetables, or similar items?',
    a: `Generally yes, as long as they're properly packed and don't pose a spill or odor risk to other
      passengers — these may be subject to a quick inspection at check-in. Live animals require prior
      arrangement.`,
    keywords: ['plants', 'fish', 'vegetables', 'produce'],
  },
  {
    q: 'What if I need to bring a firearm?',
    a: `Firearms are not allowed as hand-carried or checked baggage. They must be declared and surrendered to the
      vessel's captain or head of security before boarding, and picked up again on arrival.`,
    keywords: ['firearm', 'gun', 'weapon'],
  },
  {
    q: 'Can I bring my pet?',
    a: `Pets and other live animals aren't accepted as standard baggage. If you need to travel with one, please
      contact us before your trip so we can let you know what, if anything, can be arranged for that sailing.`,
    keywords: ['pet', 'dog', 'cat', 'animal'],
  },
  {
    q: 'Do I need an account to book a trip?',
    a: `No — you can book as a guest with just a valid email and contact number. Creating an account just makes
      it easier to see your booking history and apply for Senior, PWD, or Student discounts.`,
    keywords: ['need an account', 'require account', 'guest checkout'],
  },
  {
    q: 'How do I create an account or register?',
    a: `Click "Register" in the top menu, fill in your name, address, email, phone number, and a password, then
      submit — you're logged in right away. You can start booking or verifying your profile immediately after.`,
    keywords: ['create account', 'make account', 'make an account', 'sign up', 'how to register', 'new account'],
  },
  {
    q: 'How do I get the Senior, PWD, or Student discount?',
    a: `Create an account and complete Profile Verification from your account page: a live camera photo plus the
      front and back of a valid ID. Once an admin approves it, the discount is applied automatically to your
      bookings while you're logged in.`,
    keywords: ['discount', 'senior', 'pwd', 'student', 'verification', 'profile verification'],
  },
  {
    q: 'How long is the crossing from Padre Burgos to Limasawa?',
    a: `The Padre Burgos–Limasawa crossing takes about an hour. Exact departure and estimated arrival times are
      shown for each sailing when you search.`,
    keywords: ['how long', 'duration', 'crossing time', 'travel time'],
  },
  {
    q: 'How do I contact Evershine Booking for something not covered here?',
    a: `For anything specific to your booking, group trips, or special assistance, please reach out through the
      contact details on our Travel Info page and we'll help you directly.`,
    keywords: ['contact', 'support', 'help', 'phone', 'email us'],
  },
]

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should',
  'i', 'my', 'me', 'you', 'your', 'to', 'for', 'of', 'on', 'in', 'at', 'and', 'or', 'if', 'it', 'be',
  'how', 'what', 'when', 'where', 'who', 'why', 'with', 'this', 'that', 'there', 'have', 'has', 'need',
  'want', 'please', 'about', 'get', 'im', "i'm", 'was', 'were',
])

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !STOPWORDS.has(word))
}

// Precompute each entry's token set once (question + optional keyword
// synonyms) instead of re-tokenizing on every keystroke.
const INDEX = FAQS.map((entry) => ({
  entry,
  tokens: new Set(tokenize(`${entry.q} ${(entry.keywords || []).join(' ')}`)),
}))

// Returns the closest-matching FAQ entry, or null if nothing clears the
// similarity bar. Score = shared words / smaller word-set size, so a short
// query that's fully contained in a longer question still scores well.
export function findBestAnswer(query) {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const { entry, tokens } of INDEX) {
    let overlap = 0;
    for (const t of queryTokens) if (tokens.has(t)) overlap += 1;
    const score = overlap / Math.min(queryTokens.size, tokens.size);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore >= 0.4 ? best : null;
}