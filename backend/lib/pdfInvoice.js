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
// that file's shared constants/helpers (PORT_NAMES, formatPeso, etc.)
// instead of a second, driftable copy of them.

const PDFDocument = require('pdfkit');
const {
  PORT_NAMES,
  TERMINAL_NAME,
  TERMINAL_ADDRESS,
  SUPPORT_PHONE,
  SUPPORT_EMAIL,
  formatPeso,
  passengerFullName,
} = require('./email');

const TEAL_DARK = '#042f2e'; // header/footer bars — matches the email's footer and the site's teal-950
const TEAL = '#0f766e'; // accent text — matches the email's teal-700 accent
const GRAY_LABEL = '#6b7280';
const GRAY_BORDER = '#e5e7eb';
const INK = '#111827';
const AMBER_HEADING = '#92400e';
const AMBER_TEXT = '#78350f';

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
      const passengerCount = booking.passengers.length;

      // ---- Header bar --------------------------------------------------
      doc.rect(0, 0, pageWidth, 90).fill(TEAL_DARK);
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('EVERSHINE BOOKING', marginX, 30);
      doc
        .fillColor('#99f6e4')
        .font('Helvetica')
        .fontSize(11)
        .text('Booking Invoice / E-Ticket', marginX, 56);

      let y = 120;

      doc
        .fillColor(GRAY_LABEL)
        .font('Helvetica')
        .fontSize(9)
        .text(
          `Thank you for booking with Evershine Booking. Present this document, or just your reference code below, at the terminal during boarding.`,
          marginX, y, { width: contentWidth, lineGap: 3 }
        );
      y = doc.y + 20;

      // ---- Reference code panel -----------------------------------------
      const refBoxHeight = 60;
      doc.rect(marginX, y, contentWidth, refBoxHeight).lineWidth(1).stroke(GRAY_BORDER);
      doc
        .fillColor(TEAL)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('REFERENCE CODE', marginX, y + 14, { width: contentWidth, align: 'center', characterSpacing: 1 });
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(24)
        .text(booking.referenceCode, marginX, y + 28, { width: contentWidth, align: 'center', characterSpacing: 2 });
      y += refBoxHeight + 30;

      // ---- Trip Details ---------------------------------------------------
      y = sectionHeading(doc, 'Trip Details', marginX, y, contentWidth);
      y = labelValueRow(doc, 'Route', `${ports.from} -> ${ports.to}`, marginX, y, contentWidth);
      y = labelValueRow(doc, 'Departure', departure, marginX, y, contentWidth);
      y = labelValueRow(doc, 'Ferry', booking.schedule.ferry?.name || 'Not set', marginX, y, contentWidth);
      y = labelValueRow(doc, 'Booked On', bookedOn, marginX, y, contentWidth);
      y += 20;

      // ---- Passengers table ------------------------------------------------
      y = sectionHeading(doc, `Passengers (${passengerCount})`, marginX, y, contentWidth);

      const col1 = marginX;
      const col2 = marginX + contentWidth * 0.55;
      const col3 = marginX + contentWidth * 0.8;

      doc
        .fillColor(GRAY_LABEL)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('NAME', col1, y)
        .text('FARE TYPE', col2, y)
        .text('FARE', col3, y, { width: pageWidth - marginX - col3, align: 'right' });
      y += 16;
      doc.moveTo(marginX, y).lineTo(marginX + contentWidth, y).lineWidth(1).stroke(GRAY_BORDER);
      y += 8;

      booking.passengers.forEach((p) => {
        doc
          .fillColor(INK)
          .font('Helvetica')
          .fontSize(10)
          .text(passengerFullName(p), col1, y, { width: col2 - col1 - 10 })
          .fillColor(GRAY_LABEL)
          .text(p.discountType === 'none' ? 'Regular' : capitalize(p.discountType), col2, y)
          .fillColor(INK)
          .font('Helvetica-Bold')
          .text(formatPeso(p.fare), col3, y, { width: pageWidth - marginX - col3, align: 'right' });
        y += 20;
        doc.moveTo(marginX, y - 4).lineTo(marginX + contentWidth, y - 4).lineWidth(0.5).stroke(GRAY_BORDER);
      });

      y += 10;
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(`Total Paid: ${formatPeso(booking.totalFare)}`, marginX, y, { width: contentWidth, align: 'right' });
      y = doc.y + 24;

      // ---- Before You Board ------------------------------------------------
      const noticeLines = [
        'Arrive at the terminal at least 30 minutes before departure.',
        "Bring a valid government ID matching each passenger's name above.",
        'Discount ID (Senior, PWD, or Student) is required for a discounted fare.',
      ];
      const noticeBoxHeight = 20 + noticeLines.length * 16;
      doc.rect(marginX, y, contentWidth, noticeBoxHeight).lineWidth(1).stroke('#fde68a');
      doc
        .fillColor(AMBER_HEADING)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Before You Board', marginX + 14, y + 12);
      let noticeY = y + 30;
      noticeLines.forEach((line) => {
        doc
          .fillColor(AMBER_TEXT)
          .font('Helvetica')
          .fontSize(9)
          .text(`-  ${line}`, marginX + 14, noticeY, { width: contentWidth - 28 });
        noticeY += 16;
      });

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
        .text(`${SUPPORT_PHONE}  ·  ${SUPPORT_EMAIL}`, marginX, footerY + 48);

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
