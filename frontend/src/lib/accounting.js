// Shared money math for the Admin Accounting tab and its exports. Takes the
// raw response of GET /api/admin/accounting ({ sales, refunds,
// pendingRefunds }) and derives everything the page and the PDF / Excel /
// PowerPoint exports show, so the screen and every export always agree.
//
// Conventions:
//   - "Net" means excluding the 12% VAT; "gross" / "total" includes it.
//   - Output VAT is VAT collected on sales. A refund hands back the refunded
//     share of the VAT with it (a partial refund keeps the rest as revenue,
//     so that part of the VAT stays collected).
//   - Months are Asia/Manila calendar months, matching how the backend turns
//     the admin's from/to dates into a range.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const sum = (list, pick) => round2(list.reduce((acc, item) => acc + Number(pick(item) || 0), 0))

export function manilaDateStr(date) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
}

export function manilaMonthStr(date) {
  return manilaDateStr(date).slice(0, 7)
}

// "2026-08" -> "Aug 2026"
export function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
  })
}

// ₱ with centavos, because accounting figures need them (the rest of the
// admin dashboard rounds to whole pesos).
export function peso(amount) {
  const n = Number(amount) || 0
  return `${n < 0 ? '-' : ''}₱${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Plain "PHP" variant for PDFs, whose built-in fonts have no ₱ glyph.
export function phpPlain(amount) {
  const n = Number(amount) || 0
  return `${n < 0 ? '-' : ''}PHP ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Income tax bases the admin can pick from. These are estimates only: the
// real figure depends on how the business is registered with the BIR (which
// the app can't know) and on annual rules like deductions and the minimum
// corporate income tax. 25% is the regular corporate rate; 20% is the reduced
// rate for small corporations (net taxable income up to PHP 5M and total
// assets up to PHP 100M excluding land). A VAT-registered business can't use
// the 8% flat option, so it isn't offered.
export const TAX_BASES = {
  corporation: { label: 'Corporation, 25%', rate: 25 },
  small_corporation: { label: 'Small corporation, 20%', rate: 20 },
  none: { label: 'Do not estimate income tax', rate: 0 },
}

export function buildAccountingReport(data, { taxBasis = 'corporation' } = {}) {
  const sales = data?.sales || []
  const refunds = data?.refunds || []
  const pendingRefunds = data?.pendingRefunds || []
  const expenses = data?.expenses || []
  const taxRate = (TAX_BASES[taxBasis] || TAX_BASES.corporation).rate

  const grossSales = sum(sales, (s) => s.total)
  const netSales = sum(sales, (s) => s.net)
  const outputVat = sum(sales, (s) => s.vat)
  const vatableSales = sum(sales, (s) => s.vatableSales)
  const exemptSales = sum(sales, (s) => s.exemptSales)
  const refundsIssued = sum(refunds, (r) => r.refundTotal)
  const refundVat = sum(refunds, (r) => r.refundVat)

  const expensesTotal = sum(expenses, (e) => e.amount)
  const inputVat = sum(expenses, (e) => e.inputVat)
  const expensesNet = round2(expensesTotal - inputVat)
  const netVatPayable = round2(outputVat - refundVat)
  const netRevenueExVat = round2(netSales - (refundsIssued - refundVat))
  // Input VAT (VAT paid on purchases) is credited against the VAT collected.
  // If the credit is bigger than what was collected, nothing is remitted and
  // the excess carries over to the next period instead of being refunded.
  const vatBalance = round2(netVatPayable - inputVat)
  const profitBeforeTax = round2(netRevenueExVat - expensesNet)
  const incomeTaxEstimate = round2(Math.max(0, profitBeforeTax) * (taxRate / 100))

  const summary = {
    grossSales,
    netSales,
    outputVat,
    vatableSales,
    exemptSales,
    refundsIssued,
    refundVat,
    // VAT collected, less the share handed back with refunds.
    netVatPayable,
    // Money actually kept: sales minus refunds, with and without VAT.
    netRevenue: round2(grossSales - refundsIssued),
    netRevenueExVat,
    expensesTotal,
    inputVat,
    expensesNet,
    expenseCount: expenses.length,
    // What is actually remitted to the BIR for VAT, after the input VAT credit.
    vatRemittable: round2(Math.max(0, vatBalance)),
    vatCarryOver: round2(Math.max(0, -vatBalance)),
    profitBeforeTax,
    taxRate,
    incomeTaxEstimate,
    profitAfterTax: round2(profitBeforeTax - incomeTaxEstimate),
    totalBirEstimate: round2(Math.max(0, vatBalance) + incomeTaxEstimate),
    salesCount: sales.length,
    refundCount: refunds.length,
    pendingCount: pendingRefunds.length,
    pendingAmount: sum(pendingRefunds, (r) => r.refundTotal),
    pendingVat: sum(pendingRefunds, (r) => r.refundVat),
  }

  const monthMap = new Map()
  const bucket = (month) => {
    if (!monthMap.has(month)) {
      monthMap.set(month, {
        month, bookings: 0, vatableSales: 0, exemptSales: 0, netSales: 0,
        outputVat: 0, grossSales: 0, refunds: 0, refundVat: 0, expenses: 0, inputVat: 0,
      })
    }
    return monthMap.get(month)
  }
  for (const s of sales) {
    const b = bucket(manilaMonthStr(s.paidAt))
    b.bookings += 1
    b.vatableSales += s.vatableSales
    b.exemptSales += s.exemptSales
    b.netSales += s.net
    b.outputVat += s.vat
    b.grossSales += s.total
  }
  for (const r of refunds) {
    const b = bucket(manilaMonthStr(r.refundedAt))
    b.refunds += r.refundTotal
    b.refundVat += r.refundVat
  }
  for (const e of expenses) {
    const b = bucket(manilaMonthStr(e.expenseDate))
    b.expenses += e.amount
    b.inputVat += e.inputVat
  }
  const monthly = [...monthMap.values()]
    .map((m) => ({
      ...m,
      vatableSales: round2(m.vatableSales),
      exemptSales: round2(m.exemptSales),
      netSales: round2(m.netSales),
      outputVat: round2(m.outputVat),
      grossSales: round2(m.grossSales),
      refunds: round2(m.refunds),
      refundVat: round2(m.refundVat),
      expenses: round2(m.expenses),
      inputVat: round2(m.inputVat),
      netVat: round2(m.outputVat - m.refundVat),
      // Negative means input VAT exceeded VAT collected that month, a credit
      // that carries forward rather than a refund.
      vatPayable: round2(m.outputVat - m.refundVat - m.inputVat),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // One chronological ledger: sales add money, refunds take it back out.
  const entries = [
    ...sales.map((s) => ({
      date: s.paidAt,
      type: 'Sale',
      reference: s.referenceCode,
      note: `${s.passengerCount} passenger${s.passengerCount === 1 ? '' : 's'}`,
      net: s.net,
      vat: s.vat,
      total: s.total,
    })),
    ...refunds.map((r) => ({
      date: r.refundedAt,
      type: 'Refund',
      reference: r.referenceCode,
      note: `${r.percent}% refunded`,
      net: round2(-(r.refundTotal - r.refundVat)),
      vat: round2(-r.refundVat),
      total: round2(-r.refundTotal),
    })),
    ...expenses.map((e) => ({
      date: e.expenseDate,
      type: 'Expense',
      reference: '-',
      note: e.description,
      net: round2(-(e.amount - e.inputVat)),
      vat: round2(-e.inputVat),
      total: round2(-e.amount),
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date))

  let running = 0
  const ledger = entries.map((e) => {
    running = round2(running + e.total)
    return { ...e, balance: running }
  })

  return { summary, monthly, ledger, refunds, pendingRefunds, expenses }
}

// Preset ranges, as { from, to } YYYY-MM-DD strings in Manila time.
export function presetRange(key, now = new Date()) {
  const todayStr = manilaDateStr(now)
  const [y, m] = todayStr.split('-').map(Number)
  const pad = (n) => String(n).padStart(2, '0')
  const lastDay = (year, month) => new Date(year, month, 0).getDate() // month is 1-based

  if (key === 'this_month') return { from: `${y}-${pad(m)}-01`, to: todayStr }
  if (key === 'last_month') {
    const py = m === 1 ? y - 1 : y
    const pm = m === 1 ? 12 : m - 1
    return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDay(py, pm))}` }
  }
  if (key === 'this_quarter') {
    const qStart = Math.floor((m - 1) / 3) * 3 + 1
    return { from: `${y}-${pad(qStart)}-01`, to: todayStr }
  }
  if (key === 'last_quarter') {
    let qStart = Math.floor((m - 1) / 3) * 3 + 1 - 3
    let qy = y
    if (qStart < 1) { qStart += 12; qy -= 1 }
    const qEnd = qStart + 2
    return { from: `${qy}-${pad(qStart)}-01`, to: `${qy}-${pad(qEnd)}-${pad(lastDay(qy, qEnd))}` }
  }
  if (key === 'this_year') return { from: `${y}-01-01`, to: todayStr }
  if (key === 'last_year') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
  return { from: `${y}-${pad(m)}-01`, to: todayStr }
}

export function rangeLabel(from, to) {
  const fmt = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return from === to ? fmt(from) : `${fmt(from)} to ${fmt(to)}`
}
