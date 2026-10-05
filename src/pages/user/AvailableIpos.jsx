import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOpenIpos } from '../../services/ipoService'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function AvailableIpos() {
  const [ipos,    setIpos]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    getOpenIpos()
      .then(setIpos)
      .catch(() => setError('Failed to load IPOs. Please refresh.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Available IPOs</h1>
        <p className="text-gray-500 text-sm mt-1">Open IPOs you can apply for</p>
      </div>
      {error && <div className="alert-error">{error}</div>}
      {!error && ipos.length === 0 && (
        <div className="text-center py-20 card">
          <p className="text-4xl mb-4">📋</p>
          <p className="text-xl font-semibold text-gray-700">No open IPOs right now</p>
          <p className="text-gray-400 mt-2 text-sm">Check back later when the admin opens new IPOs.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ipos.map(ipo => (
          <div key={ipo.id} className="card p-6 flex flex-col hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{ipo.ipo_name}</h2>
                <p className="text-xs text-gray-400">{ipo.ipo_code}</p>
              </div>
              <span className="badge badge-green">Open</span>
            </div>
            <div className="space-y-1.5 text-sm text-gray-600 flex-1 mb-4">
              <div className="flex justify-between items-center">
                <span>Price</span>
                <span className="font-bold text-blue-700 text-lg">{formatCurrency(ipo.ipo_price)}</span>
              </div>
              <div className="flex justify-between"><span>Opens</span><span>{formatDate(ipo.start_date)}</span></div>
              <div className="flex justify-between"><span>Closes</span><span>{formatDate(ipo.end_date)}</span></div>
            </div>
            <Link to={`/user/apply/${ipo.id}`} className="btn btn-primary w-full">Apply Now</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
