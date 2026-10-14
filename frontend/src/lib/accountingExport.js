// Client-side exports for the Admin Accounting tab: PDF, Excel and
// PowerPoint. Like analyticsExport.js, everything works off the report the
// page has already built (see buildAccountingReport in accounting.js), so an
// export always matches what's on screen. See that file for why jspdf-
// autotable is imported for its side effect and why these are static imports.
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'
import PptxGenJS from 'pptxgenjs'
import { phpPlain, monthLabel, formatDateTime } from './accounting.js'

const fileStamp = () => new Date().toISOString().slice(0, 10)
const generatedLabel = () => new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })

const SUMMARY_ROWS = (s) => [
  ['Gross sales (incl. VAT)', s.grossSales],
  ['Net sales (excl. VAT)', s.netSales],
  ['  VAT-able sales', s.vatableSales],
  ['  VAT-exempt sales (Senior / PWD)', s.exemptSales],
  ['Output VAT collected (12%)', s.outputVat],
  ['Refunds issued', s.refundsIssued],
  ['VAT returned with refunds', s.refundVat],
  ['Net revenue (incl. VAT)', s.netRevenue],
  ['Net revenue (excl. VAT)', s.netRevenueExVat],
  ['VAT payable to BIR (output VAT less refunded VAT)', s.netVatPayable],
  [`Pending refunds (${s.pendingCount})`, s.pendingAmount],
]

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
export async function exportAccountingPdf(report, rangeText) {
  const { summary, monthly, ledger, pendingRefunds } = report
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const TEAL = [15, 118, 110]
  const INK = [17, 24, 39]

  doc.setFillColor(...TEAL)
  doc.rect(0, 0, pageWidth, 70, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Evershine Booking', 40, 32)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Accounting and VAT Report', 40, 50)

  doc.setTextColor(...INK)
  doc.setFontSize(10)
  doc.text(`Period: ${rangeText}   |   Generated ${generatedLabel()}`, 40, 92)

  doc.autoTable({
    startY: 106,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    body: SUMMARY_ROWS(summary).map(([label, value]) => [label, phpPlain(value)]),
    columnStyles: { 0: { fontStyle: 'bold', textColor: [107, 114, 128], cellWidth: 260 }, 1: { halign: 'right' } },
  })

  const tableStyle = {
    headStyles: { fillColor: TEAL, textColor: 255 },
    styles: { fontSize: 8.5, cellPadding: 4 },
    alternateRowStyles: { fillColor: [240, 253, 250] },
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Monthly VAT Report', 40, doc.lastAutoTable.finalY + 26)
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 34,
    head: [['Month', 'VAT-able', 'VAT-exempt', 'Output VAT', 'Refund VAT', 'VAT payable', 'Gross sales']],
    body: monthly.map((m) => [
      monthLabel(m.month), phpPlain(m.vatableSales), phpPlain(m.exemptSales), phpPlain(m.outputVat),
      phpPlain(m.refundVat), phpPlain(m.netVat), phpPlain(m.grossSales),
    ]),
    ...tableStyle,
  })

  if (pendingRefunds.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Pending Refunds', 40, doc.lastAutoTable.finalY + 26)
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 34,
      head: [['Reference', 'Requested', 'Rate', 'Refund amount', 'VAT portion']],
      body: pendingRefunds.map((r) => [
        r.referenceCode, formatDateTime(r.requestedAt), `${r.percent}%`, phpPlain(r.refundTotal), phpPlain(r.refundVat),
      ]),
      ...tableStyle,
    })
  }

  doc.addPage()
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Transaction Ledger', 40, 50)
  doc.autoTable({
    startY: 60,
    head: [['Date', 'Type', 'Reference', 'Net', 'VAT', 'Total', 'Balance']],
    body: ledger.map((e) => [
      formatDateTime(e.date), e.type, e.reference, phpPlain(e.net), phpPlain(e.vat), phpPlain(e.total), phpPlain(e.balance),
    ]),
    ...tableStyle,
  })

  doc.save(`evershine-accounting-${fileStamp()}.pdf`)
}

// ---------------------------------------------------------------------------
// Excel: Summary, Monthly VAT, Ledger and Refunds sheets, with real numbers
// in the cells (not formatted text) so the admin can sum or pivot them.
// ---------------------------------------------------------------------------
export async function exportAccountingExcel(report, rangeText) {
  const { summary, monthly, ledger, refunds, pendingRefunds } = report
  const wb = XLSX.utils.book_new()

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['Evershine Booking: Accounting and VAT Report'],
    [`Period: ${rangeText}`],
    [`Generated: ${generatedLabel()}`],
    [],
    ['Item', 'Amount (PHP)'],
    ...SUMMARY_ROWS(summary).map(([label, value]) => [label.trim(), Number(value)]),
  ])
  summarySheet['!cols'] = [{ wch: 36 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  const monthlySheet = XLSX.utils.aoa_to_sheet([
    ['Month', 'Bookings', 'VAT-able sales', 'VAT-exempt sales', 'Net sales', 'Output VAT', 'Refund VAT', 'VAT payable', 'Gross sales', 'Refunds'],
    ...monthly.map((m) => [
      monthLabel(m.month), m.bookings, m.vatableSales, m.exemptSales, m.netSales, m.outputVat, m.refundVat, m.netVat, m.grossSales, m.refunds,
    ]),
  ])
  monthlySheet['!cols'] = [{ wch: 12 }, { wch: 10 }, ...Array(8).fill({ wch: 16 })]
  XLSX.utils.book_append_sheet(wb, monthlySheet, 'Monthly VAT')

  const ledgerSheet = XLSX.utils.aoa_to_sheet([
    ['Date', 'Type', 'Reference', 'Details', 'Net (PHP)', 'VAT (PHP)', 'Total (PHP)', 'Running balance (PHP)'],
    ...ledger.map((e) => [formatDateTime(e.date), e.type, e.reference, e.note, e.net, e.vat, e.total, e.balance]),
  ])
  ledgerSheet['!cols'] = [{ wch: 24 }, { wch: 9 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ledgerSheet, 'Ledger')

  const refundSheet = XLSX.utils.aoa_to_sheet([
    ['Status', 'Reference', 'Date', 'Rate (%)', 'Refund amount (PHP)', 'VAT portion (PHP)', 'Reason'],
    ...pendingRefunds.map((r) => ['Pending', r.referenceCode, formatDateTime(r.requestedAt), r.percent, r.refundTotal, r.refundVat, r.reason || '']),
    ...refunds.map((r) => ['Refunded', r.referenceCode, formatDateTime(r.refundedAt), r.percent, r.refundTotal, r.refundVat, r.reason || '']),
  ])
  refundSheet['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 9 }, { wch: 20 }, { wch: 18 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, refundSheet, 'Refunds')

  XLSX.writeFile(wb, `evershine-accounting-${fileStamp()}.xlsx`)
}

// ---------------------------------------------------------------------------
// PowerPoint: title, summary, monthly VAT and refunds slides.
// ---------------------------------------------------------------------------
export async function exportAccountingPptx(report, rangeText) {
  const { summary, monthly, pendingRefunds } = report
  const pptx = new PptxGenJS()
  const TEAL = '0F766E'
  const INK = '111827'
  const headCell = (text) => ({ text, options: { bold: true, color: 'FFFFFF', fill: { color: TEAL } } })
  const border = { type: 'solid', color: 'E5E7EB', pt: 1 }

  const title = pptx.addSlide()
  title.background = { color: TEAL }
  title.addText('Evershine Booking', { x: 0.5, y: 2.2, w: 9, h: 0.8, fontSize: 32, bold: true, color: 'FFFFFF' })
  title.addText('Accounting and VAT Report', { x: 0.5, y: 3.0, w: 9, h: 0.5, fontSize: 18, color: 'F0FDFA' })
  title.addText(`${rangeText}  |  Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila' })}`, {
    x: 0.5, y: 3.6, w: 9, h: 0.4, fontSize: 12, color: 'CCFBF1',
  })

  const sum = pptx.addSlide()
  sum.addText('Summary', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: INK })
  sum.addTable(
    SUMMARY_ROWS(summary).map(([label, value]) => [{ text: label.trim(), options: { bold: true } }, { text: phpPlain(value), options: { align: 'right' } }]),
    { x: 0.5, y: 1.0, w: 9, colW: [5.5, 3.5], fontSize: 12, border, autoPage: false }
  )

  const vat = pptx.addSlide()
  vat.addText('Monthly VAT Report', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: INK })
  vat.addTable(
    [
      ['Month', 'Output VAT', 'Refund VAT', 'VAT payable'].map(headCell),
      ...monthly.map((m) => [
        { text: monthLabel(m.month) }, { text: phpPlain(m.outputVat) }, { text: phpPlain(m.refundVat) },
        { text: phpPlain(m.netVat) },
      ]),
    ],
    { x: 0.5, y: 1.0, w: 9, colW: [2.1, 2.3, 2.3, 2.3], fontSize: 11, border, autoPage: true }
  )

  const refunds = pptx.addSlide()
  refunds.addText('Refunds', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: INK })
  refunds.addTable(
    [
      [{ text: 'Refunds issued', options: { bold: true } }, { text: `${phpPlain(summary.refundsIssued)} (${summary.refundCount})` }],
      [{ text: 'VAT returned with refunds', options: { bold: true } }, { text: phpPlain(summary.refundVat) }],
      [{ text: 'Pending refunds', options: { bold: true } }, { text: `${phpPlain(summary.pendingAmount)} (${pendingRefunds.length} request${pendingRefunds.length === 1 ? '' : 's'})` }],
    ],
    { x: 0.5, y: 1.0, w: 9, colW: [4.5, 4.5], fontSize: 13, border, autoPage: false }
  )

  await pptx.writeFile({ fileName: `evershine-accounting-${fileStamp()}.pptx` })
}
