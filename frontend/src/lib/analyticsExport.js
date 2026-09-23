// Client-side exports for the Admin Analytics tab — PDF, Excel, and
// PowerPoint. Everything here works off data the page has already loaded
// (api.getMonthlySales(), filtered by the admin's chosen date range), so
// there's no separate backend export route: whatever's on screen is exactly
// what gets exported.
//
// `rows` — the visible table rows, oldest-to-newest reversed for display but
// passed in here already sorted oldest-to-newest: [{ month: 'YYYY-MM',
// revenue, count, change }]
// `summary` — { totalRevenue, totalBookings, avgMonthlyRevenue, bestMonth:
// { month, revenue, count } | null, rangeLabel }
//
// Static imports (not dynamic import()) on purpose — these libraries are
// CommonJS under the hood, and a dynamic import() doesn't always unwrap
// them the same way a normal top-level import does under Vite.
//
// jspdf-autotable specifically is imported for its side effect only: it
// patches a `.autoTable()` method directly onto the jsPDF prototype rather
// than reliably exposing a usable default export, so calls below use
// `doc.autoTable(...)` instead of an imported `autoTable(doc, ...)`
// function.
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'
import PptxGenJS from 'pptxgenjs'

function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatPesoPlain(amount) {
  return `PHP ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function changeLabel(change) {
  if (change === null || change === undefined) return '—'
  const arrow = change >= 0 ? 'Up' : 'Down'
  return `${arrow} ${Math.abs(change).toFixed(1)}%`
}

const fileStamp = () => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// PDF — jsPDF + autoTable, styled to loosely match the invoice PDF's teal
// branding so exports feel like they came from the same app.
// ---------------------------------------------------------------------------
export async function exportAnalyticsPdf(rows, summary) {
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
  doc.text('Revenue & Booking Analytics', 40, 50)

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Range: ${summary.rangeLabel}  ·  Generated ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`, 40, 92)

  // Summary KPIs as a small 2x2 table rather than the app's card layout —
  // simpler to lay out reliably in a PDF than replicating the UI.
  doc.autoTable({
    startY: 108,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    body: [
      ['Total Revenue', formatPesoPlain(summary.totalRevenue), 'Total Bookings', String(summary.totalBookings)],
      [
        'Avg. Monthly Revenue',
        formatPesoPlain(summary.avgMonthlyRevenue),
        'Best Month',
        summary.bestMonth ? `${formatMonthLabel(summary.bestMonth.month)} (${formatPesoPlain(summary.bestMonth.revenue)})` : '—',
      ],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [107, 114, 128] },
      2: { fontStyle: 'bold', textColor: [107, 114, 128] },
    },
  })

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 20,
    head: [['Month', 'Revenue', 'Bookings', 'Change']],
    body: rows.map((m) => [formatMonthLabel(m.month), formatPesoPlain(m.revenue), String(m.count), changeLabel(m.change)]),
    headStyles: { fillColor: TEAL, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 6 },
    alternateRowStyles: { fillColor: [240, 253, 250] },
  })

  doc.save(`evershine-analytics-${fileStamp()}.pdf`)
}

// ---------------------------------------------------------------------------
// Excel — SheetJS. One sheet with the summary up top, then the monthly
// table below it, so it opens straight into something readable rather than
// requiring the admin to build their own pivot.
// ---------------------------------------------------------------------------
export async function exportAnalyticsExcel(rows, summary) {
  const summaryBlock = [
    ['Evershine Booking — Revenue & Booking Analytics'],
    [`Range: ${summary.rangeLabel}`],
    [`Generated: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`],
    [],
    ['Total Revenue (PHP)', Number(summary.totalRevenue)],
    ['Total Bookings', summary.totalBookings],
    ['Avg. Monthly Revenue (PHP)', Number(summary.avgMonthlyRevenue.toFixed(2))],
    ['Best Month', summary.bestMonth ? formatMonthLabel(summary.bestMonth.month) : '—'],
    ['Best Month Revenue (PHP)', summary.bestMonth ? Number(summary.bestMonth.revenue) : ''],
    [],
    ['Month', 'Revenue (PHP)', 'Bookings', 'Change (%)'],
  ]
  const dataRows = rows.map((m) => [
    formatMonthLabel(m.month),
    Number(m.revenue),
    m.count,
    m.change === null || m.change === undefined ? '' : Number(m.change.toFixed(1)),
  ])

  const ws = XLSX.utils.aoa_to_sheet([...summaryBlock, ...dataRows])
  ws['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Monthly Sales')
  XLSX.writeFile(wb, `evershine-analytics-${fileStamp()}.xlsx`)
}

// ---------------------------------------------------------------------------
// PowerPoint — pptxgenjs. A title slide, a KPI summary slide, and a table
// slide — enough to drop straight into a report-out deck without editing.
// ---------------------------------------------------------------------------
export async function exportAnalyticsPptx(rows, summary) {
  const pptx = new PptxGenJS()
  const TEAL = '0F766E'
  const INK = '111827'

  const title = pptx.addSlide()
  title.background = { color: TEAL }
  title.addText('Evershine Booking', { x: 0.5, y: 2.2, w: 9, h: 0.8, fontSize: 32, bold: true, color: 'FFFFFF' })
  title.addText('Revenue & Booking Analytics', { x: 0.5, y: 3.0, w: 9, h: 0.5, fontSize: 18, color: 'F0FDFA' })
  title.addText(`${summary.rangeLabel}  •  Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila' })}`, {
    x: 0.5, y: 3.6, w: 9, h: 0.4, fontSize: 12, color: 'CCFBF1',
  })

  const kpi = pptx.addSlide()
  kpi.addText('Summary', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: INK })
  kpi.addTable(
    [
      [{ text: 'Total Revenue', options: { bold: true } }, { text: formatPesoPlain(summary.totalRevenue) }],
      [{ text: 'Total Bookings', options: { bold: true } }, { text: String(summary.totalBookings) }],
      [{ text: 'Avg. Monthly Revenue', options: { bold: true } }, { text: formatPesoPlain(summary.avgMonthlyRevenue) }],
      [
        { text: 'Best Month', options: { bold: true } },
        { text: summary.bestMonth ? `${formatMonthLabel(summary.bestMonth.month)} (${formatPesoPlain(summary.bestMonth.revenue)})` : '—' },
      ],
    ],
    { x: 0.5, y: 1.0, w: 9, colW: [4, 5], fontSize: 14, border: { type: 'solid', color: 'E5E7EB', pt: 1 }, autoPage: false }
  )

  const table = pptx.addSlide()
  table.addText('Monthly Sales', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 22, bold: true, color: INK })
  const head = [['Month', 'Revenue', 'Bookings', 'Change']].map((r) =>
    r.map((text) => ({ text, options: { bold: true, color: 'FFFFFF', fill: { color: TEAL } } }))
  )
  const body = rows.map((m) => [
    { text: formatMonthLabel(m.month) },
    { text: formatPesoPlain(m.revenue) },
    { text: String(m.count) },
    { text: changeLabel(m.change) },
  ])
  table.addTable([...head, ...body], {
    x: 0.5,
    y: 1.0,
    w: 9,
    colW: [2.5, 2.8, 1.8, 1.9],
    fontSize: 11,
    border: { type: 'solid', color: 'E5E7EB', pt: 1 },
    autoPage: true,
  })

  await pptx.writeFile({ fileName: `evershine-analytics-${fileStamp()}.pptx` })
}
