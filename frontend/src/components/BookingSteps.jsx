// Save as: frontend/src/components/BookingSteps.jsx
//
// Shared progress indicator used on both the Search page (always on
// "schedule") and the Booking page (moves through passenger -> review ->
// payment -> confirmation as the user progresses).

const STEPS = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'passenger', label: 'Passenger' },
  { id: 'review', label: 'Review' },
  { id: 'payment', label: 'Payment' },
  { id: 'confirmation', label: 'Confirmation' },
]

export default function BookingSteps({ currentStep }) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep)

  return (
    <div className="flex items-center justify-center overflow-x-auto py-4">
      {STEPS.map((step, i) => {
        const isActive = i === currentIndex
        const isDone = i < currentIndex
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-teal-700 text-white'
                    : isDone
                    ? 'border-2 border-teal-700 text-teal-700'
                    : 'border-2 border-gray-300 text-gray-400'
                }`}
              >
                {isDone ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`mt-1 whitespace-nowrap text-[10px] font-medium sm:text-[11px] ${
                  isActive || isDone ? 'text-teal-700' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 h-0.5 w-6 flex-shrink-0 sm:mx-2 sm:w-16 ${i < currentIndex ? 'bg-teal-700' : 'bg-gray-300'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
