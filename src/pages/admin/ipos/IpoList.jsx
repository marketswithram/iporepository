import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminIpos } from '../../../services/ipoService'
import { formatCurrency, formatDate, getIpoStatusBadgeClass, getIpoStatusLabel } from '../../../utils/formatters'

const STATUSES = ['', 'DRAFT', 'OPEN', 'CLOSED', 'PROCESSING', 'COMPLETED', 'CANCELLED']

export default function IpoList() {
  const [ipos,    setIpos]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')
  const [status,  setStatus]  = useState('')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const PAGE_SIZE = 15

  useEffect(() => {
    setLoading(true)
    getAdminIpos({ page, pageSize: PAGE_SIZE, status: status || null, search })
      .then(({ data, count }) => { setIpos(data); setTotal(count) })
      .catch(() => setError('Failed to load IPOs.'))
      .finally(() => setLoading(false))
  }, [page, status, search])

  // Debounce search
  const handleSearch = (e) => { setSearch(e.target.value); setPage(1) }
  const handleStatus = (e) => { setStatus(e.target.value); setPage(1) }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="page-title">IPO Management</h1>
        <Link to="/admin/ipos/create" className="btn bg-indigo-600 text-white hover:bg-indigo-700">+ Create IPO</Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input type="text" value={search} onChange={handleSearch} placeholder="Search by name or code…"
          className="input max-w-xs" />
        <select value={status} onChange={handleStatus} className="input w-auto">
          {STATUSES.map(s => <option key={s} value={s}>{s ? getIpoStatusLabel(s) : 'All Statuses'}</option>)}
        </select>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : ipos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <p className="text-4xl mb-4">📋</p>
          <p className="font-semibold text-gray-700">No IPOs found</p>
          <Link to="/admin/ipos/create" className="text-indigo-600 text-sm hover:underline mt-1 inline-block">Create your first IPO →</Link>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Code</th><th>IPO Name</th><th>Price</th><th>Status</th><th>Start</th><th>End</th><th>Profit</th><th>Created By</th><th></th></tr></thead>
              <tbody>
                {ipos.map(ipo => (
                  <tr key={ipo.id}>
                    <td><code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{ipo.ipo_code}</code></td>
                    <td className="font-medium">{ipo.ipo_name}</td>
                    <td>{formatCurrency(ipo.ipo_price)}</td>
                    <td><span className={getIpoStatusBadgeClass(ipo.status)}>{getIpoStatusLabel(ipo.status)}</span></td>
                    <td className="text-xs text-gray-500">{formatDate(ipo.start_date)}</td>
                    <td className="text-xs text-gray-500">{formatDate(ipo.end_date)}</td>
                    <td>{ipo.overall_profit != null ? <span className="text-green-700 font-semibold">{formatCurrency(ipo.overall_profit)}</span> : '—'}</td>
                    <td className="text-xs text-gray-400">{ipo.profiles?.username ?? '—'}</td>
                    <td><Link to={`/admin/ipos/${ipo.id}`} className="text-indigo-600 text-xs font-medium hover:underline whitespace-nowrap">Manage →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary btn-sm">← Prev</button>
              <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {Math.ceil(total / PAGE_SIZE)}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= total} className="btn btn-secondary btn-sm">Next →</button>
            </div>
          )}
          <p className="text-xs text-gray-400 text-right">{total} IPOs total</p>
        </>
      )}
    </div>
  )
}
