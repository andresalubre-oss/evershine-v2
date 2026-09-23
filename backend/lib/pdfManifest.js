// Save as: backend/lib/pdfManifest.js
//
// Generates a PDF passenger manifest for one sailing — the soft copy an
// admin sends to the Coast Guard (or anyone else) from the Manifest tab.
// Deliberately mirrors pdfInvoice.js's layout conventions (same header/
// footer bars, same color tokens, same section-heading helper) so every PDF
// this app produces reads as coming from the same system, and reuses
// email.js's shared constants/helpers instead of a second, driftable copy.

const path = require('path');
const PDFDocument = require('pdfkit');
const { PORT_NAMES, TERMINAL_NAME, TERMINAL_ADDRESS, SUPPORT_PHONE, SUPPORT_EMAIL } = require('./email');

const LOGO_PATH = path.join(__dirname, '../assets/evershine-logo.png');

const TEAL_DARK = '#042f2e';
const TEAL = '#0f766e';
const GRAY_LABEL = '#6b7280';
const GRAY_FAINT = '#9ca3af';
const GRAY_BORDER = '#e5e7eb';
const INK = '#111827';

function fullName(p) {
  return [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' ');
}

function fullAddress(p) {
  return [p.barangay, p.cityMunicipality, p.province, p.zipCode, p.country].filter(Boolean).join(', ');
}

// schedule must include its ferry (same shape as elsewhere in the app:
// { direction, departureDatetime, ferry: { name, seatCapacity } }).
// passengers is the flat list from GET /api/admin/schedules/:id/manifest.
function generateManifestPdf(schedule, passengers) {
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

      const ports = PORT_NAMES[schedule.direction] || { from: '', to: '' };
      const departure = new Date(schedule.departureDatetime).toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
        timeZone: 'Asia/Manila',
      });
      const generatedOn = new Date().toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
      });
      const seatsLeft = schedule.ferry ? Math.max(schedule.ferry.seatCapacity - passengers.length, 0) : null;

      // ---- Header bar ------------------------------------------------------
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
        // Missing logo shouldn't block the document.
      }

      const wordmarkX = logoBadgeX + logoBadgeSize + 12;
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('EVERSHINE BOOKING', wordmarkX, 28);
      doc.fillColor('#99f6e4').font('Helvetica').fontSize(11).text('Passenger Manifest', wordmarkX, 54);
      doc
        .fillColor('#99f6e4')
        .font('Helvetica')
        .fontSize(9)
        .text('GENERATED', marginX, 28, { width: contentWidth, align: 'right' });
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(generatedOn, marginX, 42, { width: contentWidth, align: 'right' });

      let y = 118;

      // ---- Trip details panel ------------------------------------------------
      const panelHeight = 60;
      doc.rect(marginX, y, contentWidth, panelHeight).lineWidth(1).stroke(GRAY_BORDER);
      const col1X = marginX + 16;
      const col2X = marginX + contentWidth * 0.35;
      const col3X = marginX + contentWidth * 0.62;
      const col4X = marginX + contentWidth * 0.84;
      const labelY = y + 12;
      const valueY = y + 26;

      doc.fillColor(GRAY_LABEL).font('Helvetica-Bold').fontSize(8).text('ROUTE', col1X, labelY, { characterSpacing: 0.5 });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(`${ports.from} to ${ports.to}`, col1X, valueY, { width: col2X - col1X - 8 });

      doc.fillColor(GRAY_LABEL).font('Helvetica-Bold').fontSize(8).text('DEPARTURE', col2X, labelY, { characterSpacing: 0.5 });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(departure, col2X, valueY, { width: col3X - col2X - 8 });

      doc.fillColor(GRAY_LABEL).font('Helvetica-Bold').fontSize(8).text('VESSEL', col3X, labelY, { characterSpacing: 0.5 });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(schedule.ferry?.name || 'Not set', col3X, valueY, { width: col4X - col3X - 8 });

      doc.fillColor(GRAY_LABEL).font('Helvetica-Bold').fontSize(8).text('PASSENGERS', col4X, labelY, { characterSpacing: 0.5 });
      doc
        .fillColor(TEAL)
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(`${passengers.length}${seatsLeft !== null ? ` / ${passengers.length + seatsLeft}` : ''}`, col4X, valueY - 2);

      y += panelHeight + 24;

      // ---- Passenger table ---------------------------------------------------
      y = sectionHeading(doc, `Passenger List (${passengers.length})`, marginX, y, contentWidth);

      const numW = 24;
      const nameW = contentWidth * 0.24;
      const sexW = contentWidth * 0.08;
      const natW = contentWidth * 0.13;
      const addrW = contentWidth * 0.27;
      const emailW = contentWidth * 0.16;
      // contactW takes the remainder

      let headerY = y;
      doc.fillColor(GRAY_LABEL).font('Helvetica-Bold').fontSize(8);
      let cx = marginX;
      doc.text('NO.', cx, headerY, { width: numW }); cx += numW;
      doc.text('NAME', cx, headerY, { width: nameW }); cx += nameW;
      doc.text('SEX', cx, headerY, { width: sexW }); cx += sexW;
      doc.text('NATIONALITY', cx, headerY, { width: natW }); cx += natW;
      doc.text('ADDRESS', cx, headerY, { width: addrW }); cx += addrW;
      doc.text('EMAIL', cx, headerY, { width: emailW }); cx += emailW;
      doc.text('CONTACT', cx, headerY, { width: marginX + contentWidth - cx });
      y = headerY + 14;
      doc.moveTo(marginX, y).lineTo(marginX + contentWidth, y).lineWidth(1).stroke(INK);
      y += 6;

      if (passengers.length === 0) {
        doc.fillColor(GRAY_LABEL).font('Helvetica').fontSize(10).text('No passengers booked for this sailing.', marginX, y);
        y = doc.y + 10;
      }

      passengers.forEach((p, i) => {
        // A row can wrap onto a new page — pdfkit doesn't do this
        // automatically for a manually-positioned layout like this one, so
        // it's checked before each row rather than assuming everything fits.
        if (y > doc.page.height - 100) {
          doc.addPage();
          y = 50;
        }
        const rowY = y;
        doc.fillColor(GRAY_LABEL).font('Helvetica').fontSize(8.5).text(String(i + 1), marginX, rowY, { width: numW });
        let rx = marginX + numW;
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.5).text(fullName(p) || '—', rx, rowY, { width: nameW - 4 }); rx += nameW;
        doc.fillColor(INK).font('Helvetica').fontSize(8.5).text(p.sex || '—', rx, rowY, { width: sexW - 4 }); rx += sexW;
        doc.text(p.nationality || '—', rx, rowY, { width: natW - 4 }); rx += natW;
        doc.text(fullAddress(p) || '—', rx, rowY, { width: addrW - 4 }); rx += addrW;
        doc.text(p.email || '—', rx, rowY, { width: emailW - 4 }); rx += emailW;
        doc.text(p.contactNumber || '—', rx, rowY, { width: marginX + contentWidth - rx });

        const rowHeight = Math.max(doc.heightOfString(fullAddress(p) || '—', { width: addrW - 4 }), 12) + 8;
        y += rowHeight;
        doc.moveTo(marginX, y - 4).lineTo(marginX + contentWidth, y - 4).lineWidth(0.5).stroke(GRAY_BORDER);
      });

      y += 16;
      if (y > doc.page.height - 140) {
        doc.addPage();
        y = 50;
      }

      // ---- Sign-off ------------------------------------------------------
      const signOffWidth = (contentWidth - 24) / 2;
      doc.moveTo(marginX, y + 30).lineTo(marginX + signOffWidth, y + 30).lineWidth(1).stroke(GRAY_BORDER);
      doc.fillColor(GRAY_LABEL).font('Helvetica').fontSize(8).text('Verified by (Crew/Purser)', marginX, y + 35);
      const col2SignX = marginX + signOffWidth + 24;
      doc.moveTo(col2SignX, y + 30).lineTo(col2SignX + signOffWidth, y + 30).lineWidth(1).stroke(GRAY_BORDER);
      doc.fillColor(GRAY_LABEL).font('Helvetica').fontSize(8).text('Signature & Date', col2SignX, y + 35);

      // ---- Footer -----------------------------------------------------------
      const footerHeight = 70;
      const footerY = doc.page.height - footerHeight;
      doc.rect(0, footerY, pageWidth, footerHeight).fill(TEAL_DARK);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text(TERMINAL_NAME, marginX, footerY + 16);
      doc
        .fillColor('#99f6e4')
        .font('Helvetica')
        .fontSize(9)
        .text(TERMINAL_ADDRESS, marginX, footerY + 34)
        .text(`${SUPPORT_PHONE}  -  ${SUPPORT_EMAIL}`, marginX, footerY + 48);
      doc
        .fillColor(GRAY_FAINT)
        .font('Helvetica')
        .fontSize(8)
        .text('This is a computer-generated document and does not require a signature.', marginX, footerY - 16, { width: contentWidth });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function sectionHeading(doc, text, x, y, width) {
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(text.toUpperCase(), x, y, { characterSpacing: 0.5 });
  const headingBottom = doc.y + 6;
  doc.moveTo(x, headingBottom).lineTo(x + width, headingBottom).lineWidth(1.5).stroke(INK);
  return headingBottom + 12;
}

module.exports = { generateManifestPdf };
