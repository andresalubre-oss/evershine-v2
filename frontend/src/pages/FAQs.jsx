// Save as: frontend/src/pages/FAQs.jsx

// The question/answer content lives in lib/faqKnowledge.js so this page and
// the help chat widget both read from the same source instead of drifting
// apart over time.
import { FAQS } from '../lib/faqKnowledge.js'

function FaqItem({ q, a }) {
  return (
    <details className="group border-t border-gray-100 py-4 first:border-t-0 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-gray-800 marker:content-none">
        {q}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-180"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{a}</p>
    </details>
  )
}

export default function FAQs() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800">Frequently Asked Questions</h1>
    

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        {FAQS.map((item) => (
          <FaqItem key={item.q} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  )
}
