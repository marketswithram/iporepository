import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getParticipationWithResult } from '../../services/ipoService'
import { formatCurrency, formatDate, formatDateTime, getIpoStatusBadgeClass, getIpoStatusLabel, getResultStatusBadgeClass } from '../../utils/formatters'

function Row({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ?? 'text-gray-900'}`}>{value}</span>
    </div>
  )
}

export default function IpoResult() {
  const { participationId } = useParams()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    getParticipationWithResult(participationId)
      .then(setData)
      .catch(() => setError('Failed to load result. Please try again.'))
      .finally(() => setLoading(false))
  }, [participationId])

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  if (error)   return <div className="alert-error max-w-lg mx-auto mt-12">{error}</div>
  if (!data)   return null

  const ipo    = data.ipos
  const result = data.ipo_results?.[0]

  return (
    <div className="max-w-lg mx-auto animate-fade-in space-y-4">
      <div>
        <Link to="/user/history" className="text-sm text-blue-600 hover:underline">← Back to History</Link>
        <h1 className="page-title mt-2">{ipo?.ipo_name}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-gray-400 text-sm">{ipo?.ipo_code}</span>
          <span className={getIpoStatusBadgeClass(ipo?.status)}>{getIpoStatusLabel(ipo?.status)}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2 className="section-title">Participation Details</h2></div>
        <div className="card-body">
          <Row label="Participation Type" value={data.participation_type === 'INVESTOR' ? 'Investor' : 'Account Holder'} />
          {data.participation_type === 'INVESTOR' && (
            <Row label="Application Number" value={data.application_number ?? '—'} />
          )}
          <Row label="IPO Price"  value={formatCurrency(ipo?.ipo_price)} />
          <Row label="Applied On" value={formatDate(data.created_at)} />
        </div>
      </div>

      {!result ? (
        <div className="card p-8 text-center">
          <p className="text-3xl mb-3">⏳</p>
          <p className="font-semibold text-gray-700">Results Pending</p>
          <p className="text-sm text-gray-400 mt-1">The admin has not yet submitted results for this IPO.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="section-title">IPO Result</h2>
            <span className={getResultStatusBadgeClass(result.result_status)}>{result.result_status?.replace('_', ' ')}</span>
          </div>
          <div className="card-body">
            <Row label="Applied"    value={result.applied   ? '✅ Yes' : '❌ No'} />
            <Row label="Allotted"   value={result.allotted  ? '✅ Yes' : '❌ No'} />
            {result.allotted && <Row label="Lots" value={result.lots} />}
            {result.applied_from && <Row label="Applied From" value={result.applied_from} />}
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="card-header"><h2 className="section-title">Settlement Details</h2></div>
          <div className="card-body">
            <Row label="Refund Amount"     value={formatCurrency(result.refund_amount)} />
            <Row label="Profit"            value={formatCurrency(result.profit_amount)} highlight={result.profit_amount > 0 ? 'text-green-600' : undefined} />
            <Row label="Tax"               value={formatCurrency(result.tax_amount)} />
            <Row label="Final Settlement"  value={formatCurrency(result.final_settlement_amount)} highlight="text-blue-700" />
          </div>
        </div>
      )}

      {ipo?.completed_at && (
        <p className="text-xs text-gray-400 text-center">IPO completed on {formatDateTime(ipo.completed_at)}</p>
      )}
    </div>
  )
}
