// Save as: frontend/src/pages/PrivacyPolicy.jsx
//
// PLACEHOLDER CONTENT — this describes, in general terms, the kind of data
// Evershine Booking's own features collect (based on what's built into the
// app: registration, profile verification, bookings, email). It has not
// been reviewed by a lawyer and should be checked against the Philippine
// Data Privacy Act (RA 10173) and your actual data practices before launch.

function Section({ title, children }) {
  return (
    <section className="border-t border-gray-100 py-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  )
}

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800">Privacy Policy</h1>
      <p className="mt-1 text-sm text-gray-600">
        This page explains what information Evershine Booking collects and how it's used. It is a general
        placeholder pending legal review — please confirm it matches your actual data practices before publishing.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <Section title="Information We Collect">
          <p>
            When you book a trip or create an account, we collect the details you provide directly: your name,
            address, email, and contact number. If you complete Profile Verification for a Senior, PWD, or
            Student discount, we also collect a live camera photo and images of your valid ID (front and back).
          </p>
        </Section>

        <Section title="How We Use Your Information">
          <p>
            We use this information to process your booking, send confirmation and verification emails, review
            discount eligibility, and provide support if you contact us about a trip. We don't sell your personal
            information to third parties.
          </p>
        </Section>

        <Section title="Verification Photos & ID Documents">
          <p>
            Selfie and ID images submitted for Profile Verification are used only to confirm your identity and
            discount eligibility, and are reviewed by authorized staff. Please contact us if you'd like a copy of
            what's on file or would like it removed.
          </p>
        </Section>

        <Section title="Third-Party Services">
          <p>
            We use a third-party email service to deliver booking confirmations and account verification emails.
            These providers process your email address only to deliver that mail on our behalf.
          </p>
        </Section>

        <Section title="Data Retention">
          <p>
            We keep booking and account information for as long as your account is active or as needed to comply
            with recordkeeping obligations. You can request that we delete your account and associated data by
            contacting us.
          </p>
        </Section>

        <Section title="Your Rights">
          <p>
            Under the Philippine Data Privacy Act, you may request access to, correction of, or deletion of your
            personal data. To make a request, reach out through the contact details in our footer.
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
