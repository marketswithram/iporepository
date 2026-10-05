import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPublicIpos } from '../../services/ipoService'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function PublicIpos() {
  const [ipos,    setIpos]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const PAGE_SIZE = 10

  useEffect(() => {
    setLoading(true)
    getPublicIpos({ page, pageSize: PAGE_SIZE })
      .then(({ data, count }) => { setIpos(data); setTotal(count) })
      .catch(() => setError('Failed to load IPOs.'))
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title text-3xl">Open IPOs</h1>
        <p className="text-gray-500 mt-1">Currently available IPOs. Log in to participate.</p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <div className="alert-error">{error}</div>}

      {!loading && ipos.length === 0 && !error && (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">📋</p>
          <p className="text-xl font-semibold text-gray-700">No open IPOs right now</p>
          <p className="text-gray-400 mt-2">Check back later or register to get notified.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ipos.map(ipo => (
          <div key={ipo.id} className="card p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{ipo.ipo_name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{ipo.ipo_code}</p>
              </div>
              <span className="badge badge-green">Open</span>
            </div>
            <div className="space-y-1.5 text-sm text-gray-600 mb-4">
              <div className="flex justify-between">
                <span>Price</span>
                <span className="font-semibold text-gray-900">{formatCurrency(ipo.ipo_price)}</span>
              </div>
              <div className="flex justify-between">
                <span>Start Date</span>
                <span>{formatDate(ipo.start_date)}</span>
              </div>
              <div className="flex justify-between">
                <span>End Date</span>
                <span>{formatDate(ipo.end_date)}</span>
              </div>
            </div>
            <Link to="/login" className="btn btn-primary w-full">Log In to Apply</Link>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex justify-center gap-2 mt-8">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary btn-sm">← Prev</button>
          <span className="px-3 py-1.5 text-sm text-gray-600">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= total} className="btn btn-secondary btn-sm">Next →</button>
        </div>
      )}
    </div>
  )
}
