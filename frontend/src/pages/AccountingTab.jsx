import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import {
  buildAccountingReport,
  presetRange,
  rangeLabel,
  peso,
  monthLabel,
  formatDateTime,
} from '../lib/accounting.js'
import { exportAccountingPdf, exportAccountingExcel, exportAccountingPptx } from '../lib/accountingExport.js'

const PRESETS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'last_quarter', label: 'Last quarter' },
  { key: 'this_year', label: 'This year' },
  { key: 'last_year', label: 'Last year' },
]

const inputClass =
  'mt-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

const cellClass = 'px-3 py-1.5 text-gray-700 dark:text-slate-300'
const rowClass = 'border-t border-gray-100 dark:border-slate-800 hover:bg-teal-50/50 dark:hover:bg-teal-900/30'

export default function AccountingTab({ Card, StatCard, DataTable }) {
  const initial = presetRange('this_month')
  const [preset, setPreset] = useState('this_month')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [exporting, setExporting] = useState(null)
  const [ledgerType, setLedgerType] = useState('all')
  const [ledgerSearch, setLedgerSearch] = useState('')

  const rangeValid = Boolean(from && to && from <= to)
  const rangeText = rangeValid ? rangeLabel(from, to) : ''

  async function load() {
    if (!rangeValid) return
    setLoading(true)
    setMessage('')
    try {
      setData(await api.getAccounting(from, to))
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  function choosePreset(key) {
    const range = presetRange(key)
    setPreset(key)
    setFrom(range.from)
    setTo(range.to)
  }

  const report = useMemo(() => (data ? buildAccountingReport(data) : null), [data])
  const s = report?.summary

  async function handleExport(format) {
    if (!report) return
    setExporting(format)
    setMessage('')
    try {
      if (format === 'pdf') await exportAccountingPdf(report, rangeText)
      else if (format === 'excel') await exportAccountingExcel(report, rangeText)
      else await exportAccountingPptx(report, rangeText)
    } catch (err) {
      setMessage(`Export failed: ${err.message}`)
    } finally {
      setExporting(null)
    }
  }

  const ledgerRows = useMemo(() => {
    if (!report) return []
    const query = ledgerSearch.trim().toLowerCase()
    return [...report.ledger]
      .filter((e) => ledgerType === 'all' || e.type.toLowerCase() === ledgerType)
      .filter((e) => !query || e.reference.toLowerCase().includes(query))
      .reverse()
  }, [report, ledgerType, ledgerSearch])

  const money = (n) => <span className={n < 0 ? 'text-red-700 dark:text-red-400' : ''}>{peso(n)}</span>

  // One row of the profit / BIR breakdown. `strong` rows are the subtotals.
  const line = (label, value, { strong = false, indent = false, note } = {}) => (
    <div className={`flex items-start justify-between gap-4 py-1.5 ${strong ? 'border-t border-gray-200 dark:border-slate-800 font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-slate-300'}`}>
      <span className={`text-sm ${indent ? 'pl-4' : ''}`}>
        {label}
        {note && <span className="block text-xs font-normal text-gray-500 dark:text-slate-500">{note}</span>}
      </span>
      <span className="whitespace-nowrap text-sm">{money(value)}</span>
    </div>
  )

  return (
    <div className="space-y-5">
      <Card>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => choosePreset(p.key)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                preset === p.key
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-500">From</label>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => { setPreset('custom'); setFrom(e.target.value) }}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-500">To</label>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => { setPreset('custom'); setTo(e.target.value) }}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={!rangeValid || loading}
            className="rounded-md bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {!rangeValid && <p className="mt-2 text-sm text-red-600 dark:text-red-400">Pick a start date that is on or before the end date.</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Export:</span>
          {[
            { key: 'pdf', label: 'PDF' },
            { key: 'excel', label: 'Excel' },
            { key: 'pptx', label: 'PowerPoint' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              disabled={!report || exporting !== null}
              onClick={() => handleExport(f.key)}
              className="rounded-md border border-gray-300 dark:border-slate-700 px-3.5 py-1.5 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {exporting === f.key ? 'Exporting...' : f.label}
            </button>
          ))}
        </div>
        {message && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{message}</p>}
      </Card>

      {s && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Gross Sales" value={peso(s.grossSales)} hint={`${s.salesCount} paid booking${s.salesCount === 1 ? '' : 's'}, incl. VAT`} />
            <StatCard label="Net Sales" value={peso(s.netSales)} hint="Excluding VAT" />
            <StatCard label="Output VAT (12%)" value={peso(s.outputVat)} hint="Collected on sales" />
            <StatCard label="Refunds Issued" value={peso(s.refundsIssued)} hint={`${s.refundCount} refund${s.refundCount === 1 ? '' : 's'} paid out`} />
            <StatCard label="VAT to Remit to BIR" value={peso(s.netVatPayable)} hint="Output VAT less VAT refunded" />
            <StatCard label="Net Revenue" value={peso(s.netRevenue)} hint={`${peso(s.netRevenueExVat)} excluding VAT`} />
          </div>

          <Card title="VAT to Remit to the BIR">
            <div className="max-w-xl">
              {line('Output VAT collected on fares', s.outputVat)}
              {line('Less: VAT returned with refunds', -s.refundVat, { indent: true })}
              {line('VAT payable to the BIR', s.netVatPayable, { strong: true })}
            </div>
          </Card>

          <Card title="VAT Report">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-gray-200 dark:border-slate-800 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">VAT-able sales</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{peso(s.vatableSales)}</p>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-slate-800 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">VAT-exempt sales (Senior / PWD)</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{peso(s.exemptSales)}</p>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-slate-800 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">VAT returned with refunds</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{peso(s.refundVat)}</p>
              </div>
            </div>

            {report.monthly.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">No sales or refunds in this period.</p>
            ) : (
              <DataTable headers={['Month', 'Bookings', 'VAT-able', 'VAT-exempt', 'Output VAT', 'Refund VAT', 'VAT payable', 'Gross sales', 'Refunds']}>
                {[...report.monthly].reverse().map((m) => (
                  <tr key={m.month} className={rowClass}>
                    <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-slate-100">{monthLabel(m.month)}</td>
                    <td className={cellClass}>{m.bookings}</td>
                    <td className={cellClass}>{peso(m.vatableSales)}</td>
                    <td className={cellClass}>{peso(m.exemptSales)}</td>
                    <td className={cellClass}>{peso(m.outputVat)}</td>
                    <td className={cellClass}>{peso(m.refundVat)}</td>
                    <td className="px-3 py-1.5 font-semibold text-gray-900 dark:text-white">{money(m.netVat)}</td>
                    <td className={cellClass}>{peso(m.grossSales)}</td>
                    <td className={cellClass}>{peso(m.refunds)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>

          <Card title="Refund Tracking">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-gray-200 dark:border-slate-800 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Pending, still owed to customers</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{peso(s.pendingAmount)}</p>
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  {s.pendingCount} request{s.pendingCount === 1 ? '' : 's'}, {peso(s.pendingVat)} of it VAT. Not limited to the selected period.
                </p>
              </div>
              <div className="rounded-md border border-gray-200 dark:border-slate-800 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Refunded in this period</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{peso(s.refundsIssued)}</p>
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  {s.refundCount} refund{s.refundCount === 1 ? '' : 's'}, {peso(s.refundVat)} of it VAT.
                </p>
              </div>
            </div>

            {report.pendingRefunds.length + report.refunds.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">No refunds to show.</p>
            ) : (
              <DataTable headers={['Status', 'Reference', 'Date', 'Rate', 'Refund amount', 'VAT portion', 'Reason']}>
                {[
                  ...report.pendingRefunds.map((r) => ({ ...r, status: 'Pending', date: r.requestedAt })),
                  ...[...report.refunds].reverse().map((r) => ({ ...r, status: 'Refunded', date: r.refundedAt })),
                ].map((r) => (
                  <tr key={`${r.status}-${r.id}`} className={rowClass}>
                    <td className="px-3 py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === 'Pending'
                            ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            : 'bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-800 dark:text-slate-100">{r.referenceCode}</td>
                    <td className={cellClass}>{formatDateTime(r.date)}</td>
                    <td className={cellClass}>{r.percent}%</td>
                    <td className={cellClass}>{peso(r.refundTotal)}</td>
                    <td className={cellClass}>{peso(r.refundVat)}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-slate-400">{r.reason || 'None given'}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>

          <Card title="Transaction Ledger">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search reference code..."
                className="min-w-0 flex-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <select
                value={ledgerType}
                onChange={(e) => setLedgerType(e.target.value)}
                className="rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="all">All transactions</option>
                <option value="sale">Sales only</option>
                <option value="refund">Refunds only</option>
              </select>
              <span className="whitespace-nowrap rounded-full bg-gray-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-slate-400">
                {ledgerRows.length} entr{ledgerRows.length === 1 ? 'y' : 'ies'}
              </span>
            </div>

            {ledgerRows.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">No transactions for this period.</p>
            ) : (
              <DataTable headers={['Date', 'Type', 'Reference', 'Details', 'Net', 'VAT', 'Total', 'Balance']}>
                {ledgerRows.map((e, i) => (
                  <tr key={`${e.type}-${e.reference}-${i}`} className={rowClass}>
                    <td className={`${cellClass} whitespace-nowrap`}>{formatDateTime(e.date)}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          e.type === 'Sale'
                            ? 'bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300'
                            : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {e.type}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-800 dark:text-slate-100">{e.reference}</td>
                    <td className="px-3 py-1.5 text-gray-600 dark:text-slate-400">{e.note}</td>
                    <td className={cellClass}>{money(e.net)}</td>
                    <td className={cellClass}>{money(e.vat)}</td>
                    <td className="px-3 py-1.5 font-medium text-gray-900 dark:text-white">{money(e.total)}</td>
                    <td className={cellClass}>{peso(e.balance)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </>
      )}

      {!s && !message && loading && <p className="text-sm text-gray-500 dark:text-slate-500">Loading accounting data...</p>}
    </div>
  )
}
