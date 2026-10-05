import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminIpos, getIpoResultReport } from '../../services/ipoService'
import { formatCurrency, formatDate, getIpoStatusBadgeClass, getIpoStatusLabel } from '../../utils/formatters'

export default function AdminReports() {
  const [completedIpos, setCompletedIpos] = useState([])
  const [selectedIpo,   setSelectedIpo]   = useState(null)
  const [report,        setReport]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [error,         setError]         = useState('')

  useEffect(() => {
    getAdminIpos({ status: 'COMPLETED', pageSize: 100 })
      .then(({ data }) => setCompletedIpos(data))
      .catch(() => setError('Failed to load completed IPOs.'))
      .finally(() => setLoading(false))
  }, [])

  const handleSelectIpo = async (ipo) => {
    setSelectedIpo(ipo)
    setReportLoading(true)
    try {
      const data = await getIpoResultReport(ipo.id)
      setReport(data)
    } catch {
      setError('Failed to load report for ' + ipo.ipo_name)
    } finally {
      setReportLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (!report.length) return
    const headers = ['Username', 'Full Name', 'Applied', 'Allotted', 'Lots', 'Applied From', 'Refund', 'Profit', 'Tax', 'Settlement']
    const rows = report.map(r => [
      r.username, r.full_name,
      r.applied ? 'Yes' : 'No', r.allotted ? 'Yes' : 'No',
      r.lots ?? 0, r.applied_from ?? '',
      r.refund_amount ?? 0, r.profit_amount ?? 0,
      r.tax_amount ?? 0, r.final_settlement_amount ?? 0,
    ])
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${selectedIpo?.ipo_code ?? 'report'}_results.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const totals = report.reduce((acc, r) => ({
    profit:     acc.profit     + Number(r.profit_amount     ?? 0),
    tax:        acc.tax        + Number(r.tax_amount        ?? 0),
    settlement: acc.settlement + Number(r.final_settlement_amount ?? 0),
    refund:     acc.refund     + Number(r.refund_amount     ?? 0),
    allotted:   acc.allotted   + (r.allotted ? 1 : 0),
  }), { profit: 0, tax: 0, settlement: 0, refund: 0, allotted: 0 })

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="page-title">Reports</h1>

      {error && <div className="alert-error">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Completed IPOs list */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="section-title">Completed IPOs</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : completedIpos.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">No completed IPOs yet</div>
            ) : completedIpos.map(ipo => (
              <button key={ipo.id} onClick={() => handleSelectIpo(ipo)}
                className={`w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors ${selectedIpo?.id === ipo.id ? 'bg-indigo-50 border-l-2 border-indigo-600' : ''}`}>
                <p className="font-semibold text-sm text-gray-900">{ipo.ipo_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs text-gray-400">{ipo.ipo_code}</code>
                  {ipo.overall_profit != null && <span className="text-xs text-green-600 font-medium">{formatCurrency(ipo.overall_profit)}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Report Detail */}
        <div className="md:col-span-2 space-y-4">
          {!selectedIpo ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-16 text-center text-gray-400">
              <p className="text-3xl mb-3">📈</p>
              <p>Select a completed IPO to view its report</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="section-title">{selectedIpo.ipo_name}</h2>
                    <p className="text-xs text-gray-400">{selectedIpo.ipo_code} · {report.length} participants</p>
                  </div>
                  <button onClick={handleExportCSV} disabled={!report.length} className="btn btn-secondary btn-sm">
                    ⬇ Export CSV
                  </button>
                </div>
                {/* Summary row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Allotted',    value: `${totals.allotted} / ${report.length}` },
                    { label: 'Total Profit', value: formatCurrency(totals.profit), color: 'text-green-700' },
                    { label: 'Total Tax',    value: formatCurrency(totals.tax), color: 'text-amber-700' },
                    { label: 'Total Settlement', value: formatCurrency(totals.settlement), color: 'text-blue-700' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className={`font-bold text-sm ${color ?? 'text-gray-900'}`}>{value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {reportLoading ? (
                <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="table-wrapper">
                  <table className="table text-xs">
                    <thead><tr><th>#</th><th>Name</th><th>Applied</th><th>Allotted</th><th>Lots</th><th>Refund</th><th>Profit</th><th>Tax</th><th>Settlement</th></tr></thead>
                    <tbody>
                      {report.map((r, i) => (
                        <tr key={r.participation_id}>
                          <td className="text-gray-400">{i + 1}</td>
                          <td><p className="font-medium">{r.full_name}</p><p className="text-gray-400">@{r.username}</p></td>
                          <td>{r.applied ? '✅' : '❌'}</td>
                          <td>{r.allotted ? '✅' : '❌'}</td>
                          <td>{r.lots ?? 0}</td>
                          <td>{formatCurrency(r.refund_amount)}</td>
                          <td className={r.profit_amount > 0 ? 'text-green-600 font-semibold' : ''}>{formatCurrency(r.profit_amount)}</td>
                          <td>{formatCurrency(r.tax_amount)}</td>
                          <td className="font-semibold text-blue-700">{formatCurrency(r.final_settlement_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
