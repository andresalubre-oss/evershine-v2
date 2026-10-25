const path = require('path');
const PDFDocument = require('pdfkit');
const {
  PORT_NAMES,
  CANCELLATION_RATES,
  CANCELLATION_NOTES,
  GOOD_TO_KNOW,
  TERMINAL_NAME,
  TERMINAL_ADDRESS,
  SUPPORT_PHONE,
  SUPPORT_EMAIL,
  passengerFullName,
} = require('./email');

const LOGO_PATH = path.join(__dirname, '../assets/evershine-logo.png');

const TEAL_DARK = '#042f2e'; 
const TEAL = '#0f766e';
const TEAL_PALE = '#f0fdfa'; 
const GRAY_LABEL = '#6b7280';
const GRAY_FAINT = '#9ca3af';
const GRAY_BORDER = '#e5e7eb';
const INK = '#111827';

function formatPesoPdf(amount) {
  return `PHP ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

   
      doc.rect(0, 0, pageWidth, 90).fill(TEAL_DARK);

   
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
      y = doc.y + 12;

      
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

      y += refBoxHeight + 18;

  
      y = sectionHeading(doc, 'Trip Details', marginX, y, contentWidth);
      y = labelValueRow(doc, 'Route', `${ports.from}  to  ${ports.to}`, marginX, y, contentWidth);
      y = labelValueRow(doc, 'Departure', departure, marginX, y, contentWidth);
      y = labelValueRow(doc, 'Ferry', booking.schedule.ferry?.name || 'Not set', marginX, y, contentWidth);
      y = labelValueRow(doc, 'Booked On', bookedOn, marginX, y, contentWidth);
      y += 10;


      y = sectionHeading(doc, 'Booking Contact', marginX, y, contentWidth);
      y = labelValueRow(doc, 'Email', booking.contactEmail, marginX, y, contentWidth);
      y = labelValueRow(doc, 'Contact Number', booking.contactNumber || 'Not set', marginX, y, contentWidth);
      y += 10;


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
      y += 10;


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
      const vatAmount = Number(booking.vatAmount || 0);
      y = labelValueRow(doc, 'Subtotal (excluding VAT)', formatPesoPdf(Number(booking.totalFare) - vatAmount), marginX, y, contentWidth);
      y = labelValueRow(doc, 'VAT (12%)', formatPesoPdf(vatAmount), marginX, y, contentWidth);
      doc
        .fillColor(GRAY_FAINT)
        .font('Helvetica')
        .fontSize(8)
        .text('Senior Citizen and PWD fares are VAT-exempt.', marginX, y - 4, { width: contentWidth, align: 'right' });
      y += 14;
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
      y = doc.y + 12;

      const noticeLines = [
        'Arrive at the terminal at least 30 minutes before departure.',
        "Bring a valid government ID matching each passenger's name above.",
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
      y += 8;

      doc
        .fillColor(GRAY_FAINT)
        .font('Helvetica')
        .fontSize(8)
        .text(
          `This is a computer-generated document and does not require a signature. Generated on ${generatedOn}.`,
          marginX, y, { width: contentWidth }
        );

      drawFooter(doc, pageWidth, marginX);

      doc.addPage();
      doc.rect(0, 0, pageWidth, 60).fill(TEAL_DARK);
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text('Terms and Policies', marginX, 24);
      doc
        .fillColor('#99f6e4')
        .font('Helvetica')
        .fontSize(10)
        .text(`Booking ${booking.referenceCode}`, marginX, 26, { width: contentWidth, align: 'right' });

      let y2 = 90;
      y2 = sectionHeading(doc, 'Ticket Cancellation Policy', marginX, y2, contentWidth);
      CANCELLATION_RATES.forEach((r) => {
        y2 = labelValueRow(doc, r.when, r.refund, marginX, y2, contentWidth);
      });
      y2 += 6;
      CANCELLATION_NOTES.forEach((line) => {
        doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(`-  ${line}`, marginX, y2, { width: contentWidth, lineGap: 2 });
        y2 = doc.y + 5;
      });
      y2 += 16;

      y2 = sectionHeading(doc, 'Good to Know', marginX, y2, contentWidth);
      GOOD_TO_KNOW.forEach((line) => {
        doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(`-  ${line}`, marginX, y2, { width: contentWidth, lineGap: 2 });
        y2 = doc.y + 5;
      });
      y2 += 16;

      doc
        .fillColor(GRAY_FAINT)
        .font('Helvetica')
        .fontSize(8)
        .text(
          'The full policies are available on the Refund and Cancellation page of our website.',
          marginX, y2, { width: contentWidth }
        );

      drawFooter(doc, pageWidth, marginX);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function drawFooter(doc, pageWidth, marginX) {
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