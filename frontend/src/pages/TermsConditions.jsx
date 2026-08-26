// Save as: frontend/src/pages/TermsConditions.jsx
//
// PLACEHOLDER CONTENT — mirrors the behavior actually enforced elsewhere in
// the app (24-hour cancellation cutoff, Profile Verification requirement,
// no ticket transfers, etc.) but has not been reviewed by a lawyer. Confirm
// wording and any liability language before publishing.

function Section({ title, children }) {
  return (
    <section className="border-t border-gray-100 py-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  )
}

export default function TermsConditions() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800">Terms &amp; Conditions</h1>
      <p className="mt-1 text-sm text-gray-600">
        These terms govern your use of Evershine Booking. This is a general placeholder pending legal review —
        please confirm it matches your actual policies before publishing.
      </p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <Section title="1. General Conditions">
          <p>
            The ticket is valid only for the particular voyage indicated therein and shall not be honored if used in any other voyage. The Carrier strictly operates a port of call/destination and point-to-point liner service and is not responsible for any connecting travel of the passenger beyond the port of call/destination or points stated on the ticket. The ticket is non-transferable and shall not be used by any person other than the passenger named therein. No refund or replacement shall be made on lost tickets. The ticket may be refunded or revalidated only within six (6) months from date of issuance. Refunds are limited to, regularly purchased tickets only. Tickets bought on promotion or discounts are not subject to refund and shall be governed by the terms and conditions of the promotion or discount.
          </p>
        </Section>

        <Section title="2. Passenger Obligations">
          <p>
            The passenger agrees to abide all the terms and conditions written herein upon purchase of this ticket. The passenger must check-in 30 minutes before the published departure time; otherwise, failure to do so will result in the cancellation of the ticket. This is for seat confirmation. The passenger undertakes to comply with the rules, regulations and all other passage/carriage conditions posted on board the vessel and at the ticket sales office and passenger terminal. The carrier is not liable to the Passenger for any loss or damage suffered by the Passenger through his or her failure to comply with the laws, regulations, orders, demands and travel rules of the carrier and/or competent public authority. Valid proof identity must be presented whenever required upon check-in. If it is found that the person presenting the ticket is not the same person named as passenger herein or if such person is unable to satisfactorily prove that he/she is the same person named in the ticket, then the Carrier has the right to refuse carriage to such person and invalidate the ticket so presented.
          </p>
        </Section>

        <Section title="3. Cancellations &amp; Refunds">
          <p>
            Cancellation and refund eligibility follow the cutoffs described on our{' '}
            <a href="/refund-cancellation" className="text-teal-700 hover:underline">Refund &amp; Cancellation</a>{' '}
            page. By booking, you agree to those terms.
          </p>
        </Section>

        <Section title="4. Passenger Conduct &amp; Safety">
          <p>
            Passengers are expected to follow terminal and crew instructions, arrive on time, and comply with
            baggage and prohibited-items rules described in our Ticket Policies. We may refuse boarding to
            passengers who pose a safety risk to themselves or others.
          </p>
        </Section>

      <Section title="5. Subject To Search">
            <p>
                Carrier reserves the right to search the passenger and his hand-carried baggage for any prohibited materials and substances and seize such if discovered, in coordination with the proper authorities. A passenger refusing to be searched shall not be allowed to board his designated voyage. Carrier further reserves the right to refuse to carry at any time, any baggage discovered to contain any Non-Allowable Baggages
            </p>
        </Section>

        <Section title="6. Limitation of Liability">
          <p>
            Evershine Booking facilitates ferry ticket reservations and is not liable for delays, cancellations,
            or losses caused by weather, mechanical issues, or other events outside our reasonable control,
            except as required by applicable law.
          </p>
        </Section>

        <Section title="6. Refusal To Board">
            <p>
                Carrier reserves the right to refuse to board for any valid reason passengers with contagious diseases and patients without medical clearance to travel issued by a physician or any competent medical practitioner. Pregnant women with less than or equal to 24 weeks or 6 months to a full term must sign a waiver of liability in favor of the carrier and must present, upon boarding the vessel, a medical certificate attesting to their fitness to undertake sea travel, otherwise, the carrier reserves the right to deny them boarding the vessel. Pregnant women with more than the allowable pregnancy period may be denied boarding. Sick passengers must present, upon boarding the vessel, a medical certificate attesting to their fitness to travel. The carrier reserves the right to verify their health condition and may, at its sole discretion, deny their boarding. Unruly passengers and those who refuse to comply with the passenger’s obligations in this ticket shall also be denied boarding. Prisoners shall only be allowed on board if escorted by authorized members of the Philippine National Police. The carrier reserves the right to determine the seating of the prisoners and their PNP escorts to ensure the safety of the passengers and crew. The carrier shall refuse to board person who is mentally ill or psychologically unstable. The carrier will not accept any unescorted minors unless they are accompanied by an adult. Unescorted minors will only be accepted for boarding if the Carrier was advised properly and the required turnover to the Carrier’s Terminal personnel and vessel crew was made. The adult purchasing the ticket for the unescorted minor is required to present documents proving his/her affinity and/or consent that the minor is allowed to travel alone.
            </p>
        </Section>
        
        <Section title="7. Hand Carried Baggage">
            <p>
                Each passenger may bring on board only one (1) hand carried baggage. Weight of hand-carried baggage must not exceed ten (10) kilograms and dimensions must not exceed 25 cm x 35 cm x 40 cm. All other baggages must be checked-in. In the case of hand carried Baggage or objects, the liability of the Carrier for loss, damage or delay, in case such loss, damage or delay was caused by the act or negligence of the Carrier and not by any cause beyond its control, is limited to One Hundred Pesos (PHP 100) Philippine Currency, per passenger. Only personal items such as laptop computers, cameras, cellular phones, mobile, landline phones, DVD players, other personal electronic items, toiletries for daily use, clothing for daily use, medicines for daily use and other similar personal items are allowed as handcarried baggage. For safety reasons, handcarried baggages are not allowed to be placed on the aisle of the vessel.
            </p>
        </Section>

        <Section title="8. Checked-In Baggage">
            <p>
                The liability of the Carrier for loss, damage or delay of Checked Baggage or of any object contained therein, attributable solely to the act, omission or negligence of the Carrier and not by any cause beyond its control, is limited to the sum of One Hundred Pesos (PHP 100) Philippine Currency, unless the Passenger has declared a higher value at the time the Checked Baggage was handed over to the Carrier and has paid a supplementary sum therefor in accordance with Carrier’s Tariffs. All unescorted baggages will be treated as cargo.
            </p>
        </Section>

        <Section title="9. Unclaimed Baggage">
            <p>
                Baggage unclaimed within thirty (30) days from the date of completion voyage shall be disposed of in accordance with law. Carrier reserves the right to charge storage fees for unclaimed baggages
            </p>
        </Section>

        <Section title="10. Live Animals And Plants">
            <p>
                No live animals will be allowed on board. Exceptions are fighting cocks, dogs, cats, rabbits and other household pets, provided that the passenger presents a Quarantine Permit and the animals are properly caged. Plants are likewise accepted if a Quarantine Permit has been secured. To be allowed to board, animals should be properly caged or packaged and are not allowed to be kept in the passenger area. All live animals transported by the Carrier shall be at passenger/owner risk
            </p>
        </Section>

        <Section title="11. Refunds, Revalidation And Surcharges">
            <p>
                Tickets are valid for six (6) months from the date of issuance. Any request for refund, rebooking, or revalidation must be made within this validity period. Requests beyond six (6) months from the date of issuance will no longer be accepted.

Passengers who wish to receive their refund immediately may proceed directly to any Oceanjet Ticketing Office located at the port. Refund requests processed through our ticketing offices, once approved and subject to the applicable conditions, will be released on the spot. Please note that the booking fee is non-refundable.

Passengers who choose to process their refund through our online channels shall be subject to the standard processing period depending on the payment method and applicable procedures. Tickets that are purchased via our official website, the reversal of payment will take 20-30 business days. Tickets that are purchased
directly through our ticketing office or from other authorized ticketing platforms, the refund process will take 30-45 business days and will be processed via your preferred bank.

Refunds and rebooking/revalidation requests are subject to the applicable conditions, fees, and surcharges. Please refer to the Refund Page on the Oceanjet website for the complete table of refund conditions and corresponding surcharges.
            </p>
        </Section>

        <Section title="12. Cancelled, Delayed or Diverted Voyages">
            <p>
                Carrier shall not be responsible for the subsistence of passengers or for any damages of lost time due to vessel delay/trip cancellation. Carrier reserves the right to bring the passengers to the port of destination stated in the ticket by other reasonable means possible or refund the value of the ticket. The Carrier may divert any voyage to any port other than the port of destination if it is unable to dock at the port of destination for reasons beyond its control. In such an event and unless the carrier is subsequently able to continue to the original destination, the carriage shall be deemed complete when the carrier arrives at such other port.
            </p>
        </Section>

        <Section title="13. Limitation of Liability">
            <p>
                The Carrier shall not be responsible for the injury or death to passengers or for the loss, damage or deterioration of baggages or objects if such is caused by events which could not be foreseen, or which, though foreseen, were inevitable such as flood, storm, earthquake, lightning, or other natural disaster or calamity; act of the public enemy in war, whether international or civil; act of omission of the shipper or owner of the goods; the character of the goods or defects in the packing or in the containers; order or act of competent public authority; other acts of God; or other events arising from force majeure or events beyond the control of Carrier, its officers, crew, agents and employees. Claims for injuries, death and other liabilities must be filed with the Carrier within thirty (30) days from the day the passenger disembarks the vessel or from the day the vessel arrives at the port of destination, whichever is earlier. For loss, damage or deterioration of baggages or objects, a written notice of claim for must be filed with the Carrier within twenty four (24) hours from receipt and sixty (60) days from accrual of the right of action for instituting a court action, which periods must concur. The carrier shall have no liability whatsoever if the passenger fails to file the claims within the periods stated above. In case of abandonement of vessel, the “no vessel, no liability” rule shall apply.
            </p>
        </Section>
        
        <Section title="14. Miscellaneous">
            <p>
                Fare rates, sailing schedules and time of departure are subject to change at any time without prior notice. Any unauthorized alteration or perforation of this ticket shall render the same null and void.
            </p>
        </Section>

        <Section title="15. Chargeback Policy For Debit And Credit Card Payments">
            <p>
                Passengers who purchase tickets using debit or credit cards must process any refund requests directly through Oceanjet.net. Filing a chargeback with their card issuer for any reason will result in an automatic decline. By accepting these terms and conditions, the passenger agrees not to initiate a chargeback and understands that all refund requests must be handled exclusively through Oceanjet.net’s refund process. Failure to comply with this policy may result in denial of future service and other legal actions as deemed necessary by the carrier.
            </p>
        </Section>
        <Section title="16. Changes to These Terms">
          <p>
            We may update these terms from time to time. Continued use of Evershine Booking after changes take
            effect means you accept the updated terms.
          </p>
        </Section>

        <Section title="17. Governing Law">
          <p>These terms are governed by the laws of the Republic of the Philippines.</p>
        </Section>
      </div>

   
    </div>
  )
}
