// Save as: backend/lib/pdfInvoice.js
//
// Generates a downloadable PDF version of the booking invoice, for the
// "Download Invoice as PDF" button on the confirmation email and the Manage
// Booking page. Built with pdfkit (pure JS, no headless browser/Chromium
// needed) rather than rendering the HTML email template, since a small
// hobby-tier server shouldn't need to run a full browser just to produce a
// one-page document. Layout intentionally mirrors sendBookingInvoice in
// email.js — same sections, same order, same wording — so the emailed
// invoice and the downloaded PDF never disagree with each other, and reuses
// that file's shared constants/helpers (PORT_NAMES, passengerFullName, etc.)
// instead of a second, driftable copy of them. Currency is formatted
// separately from the email's formatPeso — pdfkit's built-in fonts only
// cover the CP1252/Latin-1 character set, which does not include the ₱
// sign, so it silently substitutes an unrelated glyph (a plus-minus sign)
// if used directly. "PHP" is used instead, which is also standard on
// official Philippine financial documents.

const path = require('path');
const PDFDocument = require('pdfkit');
const {
  PORT_NAMES,
  TERMINAL_NAME,
  TERMINAL_ADDRESS,
  SUPPORT_PHONE,
  SUPPORT_EMAIL,
  passengerFullName,
} = require('./email');

// Bundled inside backend/ (copied from frontend/public/evershine-logo.png)
// rather than fetched over HTTP from FRONTEND_URL at request time — a local
// file read is instant and doesn't add "the frontend must be reachable" as
// a failure mode for something as simple as generating a PDF.
const LOGO_PATH = path.join(__dirname, '../assets/evershine-logo.png');

const TEAL_DARK = '#042f2e'; // header/footer bars — matches the email's footer and the site's teal-950
const TEAL = '#0f766e'; // accent text — matches the email's teal-700 accent
const TEAL_PALE = '#f0fdfa'; // zebra-striping fill — matches the email's reference-code panel background
const GRAY_LABEL = '#6b7280';
const GRAY_FAINT = '#9ca3af';
const GRAY_BORDER = '#e5e7eb';
const INK = '#111827';

function formatPesoPdf(amount) {
  return `PHP ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Builds the PDF into an in-memory buffer rather than writing to disk —
// simplest for a request/response cycle where the file only needs to exist
// long enough to stream back to the browser, with nothing left over to clean up.
function generateInvoicePdf(booking) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const marginX = 50;
      const contentWidth = pageWidth - marginX * 2;

      const ports = PORT_NAMES[booking.schedule.direction] || { from: '', to: '' };
      // Same Asia/Manila pin as the email invoice — the ferry departs at a
      // fixed real-world Philippine time regardless of where this PDF is
      // generated or opened.
      const departure = new Date(booking.schedule.departureDatetime).toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
        timeZone: 'Asia/Manila',
      });
      const bookedOn = new Date(booking.createdAt).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
      });
      const generatedOn = new Date().toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
        timeZone: 'Asia/Manila',
      });
      const passengerCount = booking.passengers.length;

      // ---- Header bar ------------------------------------------------------
      doc.rect(0, 0, pageWidth, 90).fill(TEAL_DARK);

      // White square backing behind the logo — same treatment used for it
      // everywhere else against a dark background (site nav, admin sidebar),
      // since the mark itself relies on a light background to read clearly.
      const logoBadgeSize = 38;
      const logoBadgeX = marginX;
      const logoBadgeY = 22;
      doc.roundedRect(logoBadgeX, logoBadgeY, logoBadgeSize, logoBadgeSize, 6).fill('#ffffff');
      try {
        doc.image(LOGO_PATH, logoBadgeX + 4, logoBadgeY + 4, {
          fit: [logoBadgeSize - 8, logoBadgeSize - 8],
          align: 'center',
          valign: 'center',
        });
      } catch {
        // Missing/unreadable logo file shouldn't block the whole invoice —
        // the white badge alone still leaves the header looking intentional.
      }

      const wordmarkX = logoBadgeX + logoBadgeSize + 12;
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('EVERSHINE BOOKING', wordmarkX, 28);
      doc
        .fillColor('#99f6e4')
        .font('Helvetica')
        .fontSize(11)
        .text('Official Booking Invoice', wordmarkX, 54);
      // Reference code echoed top-right too, so a passenger flipping through
      // a printed stack of tickets can find the right one without opening
      // each page — the same reason paper boarding passes repeat the
      // confirmation code in more than one place.
      doc
        .fillColor('#99f6e4')
        .font('Helvetica')
        .fontSize(9)
        .text('REF', marginX, 28, { width: contentWidth, align: 'right' });
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(booking.referenceCode, marginX, 40, { width: contentWidth, align: 'right', characterSpacing: 1 });

      let y = 118;

      doc
        .fillColor(GRAY_LABEL)
        .font('Helvetica')
        .fontSize(9)
        .text(
          'Thank you for booking with Evershine Booking. Present this document, or just your reference code below, at the terminal during boarding.',
          marginX, y, { width: contentWidth, lineGap: 3 }
        );
      y = doc.y + 18;

      // ---- Reference code + status panel ------------------------------------
      const refBoxHeight = 72;
      doc.rect(marginX, y, contentWidth, refBoxHeight).lineWidth(1).stroke(GRAY_BORDER);
      doc
        .fillColor(TEAL)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('REFERENCE CODE', marginX, y + 14, { width: contentWidth, align: 'center', characterSpacing: 1.2 });
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(26)
        .text(booking.referenceCode, marginX, y + 27, { width: contentWidth, align: 'center', characterSpacing: 2 });

      // Solid status pill — flat fill, no gradient/border-line, matching the
      // rest of the app's design language.
      const pillLabel = 'PAYMENT CONFIRMED';
      doc.font('Helvetica-Bold').fontSize(8);
      const pillTextWidth = doc.widthOfString(pillLabel, { characterSpacing: 1 });
      const pillWidth = pillTextWidth + 24;
      const pillX = marginX + (contentWidth - pillWidth) / 2;
      const pillY = y + refBoxHeight - 20;
      doc.roundedRect(pillX, pillY, pillWidth, 16, 8).fill(TEAL);
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(pillLabel, pillX, pillY + 4.5, { width: pillWidth, align: 'center', characterSpacing: 1 });

      y += refBoxHeight + 28;

      // ---- Trip Details ------------------------------------------------------
      y = sectionHeading(doc, 'Trip Details', marginX, y, contentWidth);
      y = labelValueRow(doc, 'Route', `${ports.from}  to  ${ports.to}`, marginX, y, contentWidth);
      y = labelValueRow(doc, 'Departure', departure, marginX, y, contentWidth);
      y = labelValueRow(doc, 'Ferry', booking.schedule.ferry?.name || 'Not set', marginX, y, contentWidth);
      y = labelValueRow(doc, 'Booked On', bookedOn, marginX, y, contentWidth);
      y += 18;

      // ---- Contact Details ----------------------------------------------------
      y = sectionHeading(doc, 'Booking Contact', marginX, y, contentWidth);
      y = labelValueRow(doc, 'Email', booking.contactEmail, marginX, y, contentWidth);
      y = labelValueRow(doc, 'Contact Number', booking.contactNumber || 'Not set', marginX, y, contentWidth);
      y += 18;

      // ---- Passengers table -----------------------------------------------------
      y = sectionHeading(doc, `Passengers (${passengerCount})`, marginX, y, contentWidth);

      const col1 = marginX;
      const col2 = marginX + contentWidth * 0.55;
      const col3 = marginX + contentWidth * 0.8;
      const rowHeight = 24;

      doc
        .fillColor(GRAY_LABEL)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('NAME', col1, y)
        .text('FARE TYPE', col2, y)
        .text('FARE', col3, y, { width: pageWidth - marginX - col3, align: 'right' });
      y += 16;
      doc.moveTo(marginX, y).lineTo(marginX + contentWidth, y).lineWidth(1).stroke(INK);
      y += 4;

      booking.passengers.forEach((p, i) => {
        // Zebra striping — a light solid fill on alternate rows, not a
        // colored border line, for scannability across longer group bookings.
        if (i % 2 === 1) {
          doc.rect(marginX, y, contentWidth, rowHeight).fill(TEAL_PALE);
        }
        const textY = y + 7;
        doc
          .fillColor(INK)
          .font('Helvetica')
          .fontSize(10)
          .text(passengerFullName(p), col1 + 2, textY, { width: col2 - col1 - 10 })
          .fillColor(GRAY_LABEL)
          .text(p.discountType === 'none' ? 'Regular' : capitalize(p.discountType), col2, textY)
          .fillColor(INK)
          .font('Helvetica-Bold')
          .text(formatPesoPdf(p.fare), col3, textY, { width: pageWidth - marginX - col3 - 2, align: 'right' });
        y += rowHeight;
      });
      doc.moveTo(marginX, y).lineTo(marginX + contentWidth, y).lineWidth(1).stroke(GRAY_BORDER);
      y += 16;

      // ---- Payment summary ---------------------------------------------------
      doc
        .fillColor(GRAY_LABEL)
        .font('Helvetica')
        .fontSize(9)
        .text('Payment Method', marginX, y, { width: contentWidth * 0.5 });
      doc
        .fillColor(INK)
        .font('Helvetica')
        .fontSize(9)
        .text('QR Ph (GCash / Maya / Banking Apps)', marginX, y, { width: contentWidth, align: 'right' });
      y += 18;

      doc.moveTo(marginX, y).lineTo(marginX + contentWidth, y).lineWidth(1).stroke(GRAY_BORDER);
      y += 10;
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('Total Paid', marginX, y);
      doc
        .fillColor(TEAL)
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(formatPesoPdf(booking.totalFare), marginX, y, { width: contentWidth, align: 'right' });
      y = doc.y + 22;

      // ---- Before You Board ---------------------------------------------------
      // Plain white background, black text, no box — same flat treatment as
      // every other section on this document rather than a colored callout,
      // per the site's "no colored boxes/light effects" design language.
      const noticeLines = [
        'Arrive at the terminal at least 30 minutes before departure.',
        "Bring a valid government ID matching each passenger's name above.",
        'Discount ID (Senior, PWD, or Student) is required for a discounted fare.',
      ];
      y = sectionHeading(doc, 'Before You Board', marginX, y, contentWidth);
      noticeLines.forEach((line) => {
        doc
          .fillColor(INK)
          .font('Helvetica')
          .fontSize(9.5)
          .text(`-  ${line}`, marginX, y, { width: contentWidth, lineGap: 2 });
        y = doc.y + 4;
      });
      y += 14;

      // ---- Generation note -----------------------------------------------------
      doc
        .fillColor(GRAY_FAINT)
        .font('Helvetica')
        .fontSize(8)
        .text(
          `This is a computer-generated document and does not require a signature. Generated on ${generatedOn}.`,
          marginX, y, { width: contentWidth }
        );

      // ---- Footer -----------------------------------------------------------
      const footerHeight = 70;
      const footerY = doc.page.height - footerHeight;
      doc.rect(0, footerY, pageWidth, footerHeight).fill(TEAL_DARK);
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(TERMINAL_NAME, marginX, footerY + 16);
      doc
        .fillColor('#99f6e4')
        .font('Helvetica')
        .fontSize(9)
        .text(TERMINAL_ADDRESS, marginX, footerY + 34)
        .text(`${SUPPORT_PHONE}  -  ${SUPPORT_EMAIL}`, marginX, footerY + 48);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function sectionHeading(doc, text, x, y, width) {
  doc
    .fillColor(INK)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(text.toUpperCase(), x, y, { characterSpacing: 0.5 });
  const headingBottom = doc.y + 6;
  doc.moveTo(x, headingBottom).lineTo(x + width, headingBottom).lineWidth(1.5).stroke(INK);
  return headingBottom + 14;
}

function labelValueRow(doc, label, value, x, y, width) {
  doc.fillColor(GRAY_LABEL).font('Helvetica').fontSize(10).text(label, x, y, { width: width * 0.4 });
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(value, x, y, { width, align: 'right' });
  return y + 20;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = { generateInvoicePdf };