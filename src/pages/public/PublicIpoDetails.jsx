import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getIpoWithDetails } from '../../services/ipoService'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function PublicIpoDetails() {
  const { ipoId } = useParams()
  const { isAuthenticated, isAdmin } = useAuth()

  const [ipo, setIpo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    let isMounted = true

    getIpoWithDetails(ipoId)
      .then(data => {
        if (!isMounted) return
        if (!data) {
          setError('IPO not found.')
          return
        }
        // If not admin and not OPEN, do not expose to public
        if (!isAdmin && data.status !== 'OPEN') {
          setError('This IPO is currently not published for public viewing.')
          return
        }
        setIpo(data)
      })
      .catch(err => {
        if (!isMounted) return
        console.error('Error loading IPO:', err)
        setError('Failed to load IPO details. Please try again later.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [ipoId, isAdmin])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !ipo) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">IPO Details Unavailable</h2>
        <p className="text-gray-500 mb-6">{error || 'The requested IPO could not be found.'}</p>
        <Link to="/ipos" className="btn btn-primary">← Browse Open IPOs</Link>
      </div>
    )
  }

  const d = ipo.details || {}
  const gmp = d.gmp_data || d.gmp || {}
  const sub = d.subscription_data || d.subscription || {}
  const quota = d.reservation_quota || {}
  const issue = d.issue_details || {}
  const lots = d.lot_size_details || []
  const kpi = d.kpi_data || d.kpi || {}
  const fin = d.financials_data || d.financials || {}
  const comp = d.company_details || {}
  const contact = d.company_contact || {}
  const docs = d.official_documents || {}
  const faqs = d.faq_data || d.faq || []

  const finPeriods = fin.periods && typeof fin.periods === 'object' && !Array.isArray(fin.periods)
    ? fin.periods
    : {}
  const periodKeys = Object.keys(finPeriods)

  const finMetrics = [
    { key: 'total_income', label: 'Total Income' },
    { key: 'net_profit', label: 'Net Profit / PAT' },
    { key: 'ebitda', label: 'EBITDA' },
    { key: 'borrowings', label: 'Borrowings' },
    { key: 'roe', label: 'ROE' },
    { key: 'roce', label: 'ROCE' },
    { key: 'assets', label: 'Total Assets' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-fade-in">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link to="/ipos" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <span>←</span> Back to All IPOs
        </Link>
        <span className="badge badge-green">Open for Bidding</span>
      </div>

      {/* Hero Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="badge badge-blue">{d.ipo_type || 'Mainboard IPO'}</span>
            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{ipo.ipo_code}</span>
            <span className="text-xs text-gray-400">{d.market_segment || 'BSE, NSE'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{ipo.ipo_name}</h1>
          <p className="text-gray-500 text-sm mt-1">{d.company_name || ipo.ipo_name}</p>
        </div>

        {/* Call-to-action button (Apply or Login) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {isAuthenticated ? (
            <Link
              to={`/user/apply/${ipo.id}`}
              className="btn btn-primary btn-lg shadow-md hover:shadow-lg transition-all text-center"
            >
              🚀 Apply for this IPO
            </Link>
          ) : (
            <div className="flex flex-col gap-1 text-center">
              <Link
                to={`/login?redirect=/ipos/${ipo.id}`}
                className="btn btn-primary btn-lg shadow-md hover:shadow-lg transition-all"
              >
                Log In to Apply
              </Link>
              <span className="text-[11px] text-gray-400">Authenticated members only</span>
            </div>
          )}
        </div>
      </div>

      {/* Key Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Issue Price Band</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {d.min_price && d.max_price
              ? `₹${d.min_price} – ₹${d.max_price}`
              : d.max_price
              ? `₹${d.max_price}`
              : formatCurrency(ipo.ipo_price)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Face Value: ₹{d.face_value ?? '10'}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Lot Size & Min Investment</p>
          <p className="text-xl font-bold text-blue-700 mt-1">
            {formatCurrency(ipo.ipo_price)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{d.lot_size ? `${d.lot_size} shares per lot` : '1 Lot'}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Issue Size</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{d.issue_size || '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Fresh / OFS: {d.fresh_issue === false ? '100% OFS' : 'Fresh & OFS'}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Bidding Window</p>
          <p className="text-sm font-bold text-gray-900 mt-1">
            {formatDate(ipo.start_date)}
          </p>
          <p className="text-xs text-gray-500">to {formatDate(ipo.end_date)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview', label: 'Overview & Schedule' },
          { id: 'gmp_sub', label: 'GMP & Subscription' },
          { id: 'lots_quota', label: 'Lots & Quotas' },
          { id: 'financials', label: 'Financials & KPIs' },
          { id: 'company', label: 'Company & Promoters' },
          { id: 'docs_faq', label: 'Documents & FAQs' },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`py-3 px-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview & Schedule */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="section-title text-base mb-4">Important IPO Dates</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'IPO Opens', val: ipo.start_date },
                { label: 'IPO Closes', val: ipo.end_date },
                { label: 'Basis of Allotment', val: d.allotment_date },
                { label: 'Initiation of Refunds', val: d.refund_date },
                { label: 'Credit to Demat', val: d.demat_credit_date },
                { label: 'Listing Date', val: d.listing_date },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3.5 text-center border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                  <p className="text-sm font-bold text-gray-900">{formatDate(item.val)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="section-title text-base mb-4">Issue Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Issue Type</span>
                <span className="font-medium text-gray-900">{d.issue_type || d.sale_type || 'Book Built Issue'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Exchanges</span>
                <span className="font-medium text-gray-900">{d.exchanges?.length ? d.exchanges.join(', ') : 'BSE, NSE'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Face Value</span>
                <span className="font-medium text-gray-900">₹{d.face_value ?? '10'} per share</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Cut-off Price</span>
                <span className="font-medium text-gray-900">{d.cutoff_price ? `₹${d.cutoff_price}` : '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Fresh Issue</span>
                <span className="font-medium text-gray-900">{d.fresh_issue === false ? 'No (100% OFS)' : 'Yes'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Pre-issue Shares</span>
                <span className="font-medium text-gray-900">{d.pre_issue_shares ? d.pre_issue_shares.toLocaleString('en-IN') : '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Post-issue Shares</span>
                <span className="font-medium text-gray-900">{d.post_issue_shares ? d.post_issue_shares.toLocaleString('en-IN') : '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Company Proceeds</span>
                <span className="font-medium text-gray-900">{d.company_proceeds !== null && d.company_proceeds !== undefined ? `₹${d.company_proceeds}` : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: GMP & Subscription */}
      {activeTab === 'gmp_sub' && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title text-base">Grey Market Premium (GMP)</h3>
                <span className="text-xs text-gray-400">Updated: {gmp.source_update_label || 'Recent'}</span>
              </div>
              <span className={`badge ${gmp.is_official ? 'badge-blue' : 'badge-yellow'}`}>
                {gmp.is_official ? 'Official Data' : 'Unofficial Market Estimate'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <p className="text-xs text-emerald-700 font-medium">Estimated Premium</p>
                <p className="text-3xl font-bold text-emerald-800 mt-1">
                  {gmp.premium !== null && gmp.premium !== undefined ? `+₹${gmp.premium}` : '—'}
                </p>
                {gmp.premium_percentage !== null && gmp.premium_percentage !== undefined && (
                  <p className="text-xs text-emerald-600 mt-0.5">({gmp.premium_percentage}%)</p>
                )}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 font-medium">Estimated Listing Price</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {gmp.estimated_listing_price ? `₹${gmp.estimated_listing_price}` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{gmp.estimated_listing_price_formula || 'Issue Price + GMP'}</p>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
                <p className="text-xs text-indigo-700 font-medium">Est. Profit / Lot</p>
                <p className="text-3xl font-bold text-indigo-800 mt-1">
                  {gmp.estimated_profit_per_lot ? `₹${gmp.estimated_profit_per_lot.toLocaleString('en-IN')}` : '—'}
                </p>
                <p className="text-xs text-indigo-600 mt-0.5">{gmp.lot_size ? `Lot: ${gmp.lot_size} shares` : ''}</p>
              </div>
            </div>

            <div className="alert-warning text-xs">
              <span>⚠</span>
              <div>
                <p className="font-semibold">Disclaimer</p>
                <p className="mt-0.5 text-amber-900">
                  {gmp.disclaimer || 'GMP is unofficial and for informational purposes only. It is not official exchange data and does not guarantee listing gains.'}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title text-base">Subscription Status</h3>
                <span className="text-xs text-gray-400">{sub.period_label || 'Current Period'}</span>
              </div>
              <span className="badge badge-blue">{sub.tracker_status || 'Live Tracker'}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 font-medium">Total Subscription</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{sub.total || '—'}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 font-medium">Retail (RII)</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{sub.retail || '—'}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 font-medium">NII / HNI</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{sub.nii || '—'}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 font-medium">QIB</p>
                <p className="text-2xl font-bold text-indigo-700 mt-1">{sub.qib || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Lots & Quotas */}
      {activeTab === 'lots_quota' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="section-title text-base mb-3">Reservation Quota</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-xs text-indigo-600 font-medium">QIB Quota</p>
                <p className="text-2xl font-bold text-indigo-900 mt-1">
                  {quota.qib_percentage !== null && quota.qib_percentage !== undefined ? `${quota.qib_percentage}%` : '—'}
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs text-blue-600 font-medium">Retail Quota</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {quota.retail_percentage !== null && quota.retail_percentage !== undefined ? `${quota.retail_percentage}%` : '—'}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <p className="text-xs text-purple-600 font-medium">NII / HNI Quota</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {quota.nii_percentage !== null && quota.nii_percentage !== undefined ? `${quota.nii_percentage}%` : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="section-title text-base mb-4">Lot Size & Application Breakdown</h3>
            {lots.length > 0 ? (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Application Category</th>
                      <th className="text-right">Lots</th>
                      <th className="text-right">Shares</th>
                      <th className="text-right">Investment Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((l, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold text-gray-900">{l.category}</td>
                        <td className="text-right">{l.lots ?? '—'}</td>
                        <td className="text-right">{l.shares ? l.shares.toLocaleString('en-IN') : '—'}</td>
                        <td className="text-right font-bold text-gray-900">
                          {l.amount ? formatCurrency(l.amount) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No lot size breakdown available.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Financials & KPIs */}
      {activeTab === 'financials' && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title text-base">Financial Statements Comparison</h3>
                <p className="text-xs text-gray-400">Unit: {fin.unit || '₹ in Crores'} · Currency: {fin.currency || 'INR'}</p>
              </div>
            </div>

            {periodKeys.length > 0 ? (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-1/3">Financial Metric</th>
                      {periodKeys.map(p => (
                        <th key={p} className="text-right font-bold text-gray-800">{p}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {finMetrics.map(m => (
                      <tr key={m.key}>
                        <td className="font-medium text-gray-700">{m.label}</td>
                        {periodKeys.map(p => {
                          const val = finPeriods[p]?.[m.key]
                          return (
                            <td key={p} className="text-right font-semibold text-gray-900">
                              {val !== undefined && val !== null ? val : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Financial statements data is not available.</p>
            )}
          </div>

          <div className="card p-6">
            <h3 className="section-title text-base mb-4">Financial Ratios & Key Indicators</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'ROE', val: kpi.roe },
                { label: 'ROCE', val: kpi.roce },
                { label: 'Debt / Equity', val: kpi.debt_to_equity },
                { label: 'RONW', val: kpi.ronw },
                { label: 'PAT Margin', val: kpi.pat_margin },
                { label: 'EBITDA Margin', val: kpi.ebitda_margin },
                { label: 'Price to Book (P/BV)', val: kpi.price_to_book },
                { label: 'Pre-IPO P/E', val: kpi.pre_ipo_pe },
                { label: 'Post-IPO P/E', val: kpi.post_ipo_pe },
                { label: 'Pre-IPO EPS', val: kpi.pre_ipo_eps },
                { label: 'Post-IPO EPS', val: kpi.post_ipo_eps },
                { label: 'Pre-IPO Promoter Holding', val: kpi.pre_ipo_promoter_holding },
                { label: 'Post-IPO Promoter Holding', val: kpi.post_ipo_promoter_holding },
                { label: 'Market Cap', val: kpi.market_capitalization },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                  <p className="font-bold text-gray-900">{item.val !== null && item.val !== undefined ? item.val : '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Company & Promoters */}
      {activeTab === 'company' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="section-title text-base mb-3">About the Company</h3>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              {comp.summary || 'Company overview not provided.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4">
              <div>
                <span className="text-gray-500 text-xs block">Industry Segment</span>
                <span className="font-semibold text-gray-900">{comp.industry || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Incorporation</span>
                <span className="font-semibold text-gray-900">{comp.incorporation_month || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Customer Base</span>
                <span className="font-semibold text-gray-900">{comp.customer_count ?? '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Key Promoters</span>
                <span className="font-semibold text-gray-900">{comp.promoters?.join(', ') || '—'}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="section-title text-base mb-3">Intermediaries & Registrar</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-2">Book Running Lead Managers</h4>
                {issue.lead_managers?.length > 0 ? (
                  <ul className="space-y-1 text-gray-700">
                    {issue.lead_managers.map((lm, i) => (
                      <li key={i}>• {lm}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-400 italic">None listed</p>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-2">Issue Registrar</h4>
                <div className="space-y-1 text-gray-700">
                  <p className="font-bold text-gray-900">{issue.registrar?.name || '—'}</p>
                  {issue.registrar?.phone && <p>Phone: {issue.registrar.phone}</p>}
                  {issue.registrar?.email && <p>Email: {issue.registrar.email}</p>}
                  {issue.registrar?.website && (
                    <p>
                      <a href={issue.registrar.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {issue.registrar.website}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="section-title text-base mb-3">Contact Details</h3>
            <div className="space-y-1 text-sm text-gray-700">
              <p><span className="text-gray-500">Registered Office:</span> {contact.address || '—'}</p>
              <p><span className="text-gray-500">Phone:</span> {contact.phone || '—'}</p>
              <p><span className="text-gray-500">Email:</span> {contact.email || '—'}</p>
              {contact.website && (
                <p>
                  <span className="text-gray-500">Website:</span>{' '}
                  <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {contact.website}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Docs & FAQs */}
      {activeTab === 'docs_faq' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="section-title text-base mb-4">Official Prospectus Documents</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Draft Red Herring Prospectus (DRHP)</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Filed with SEBI</p>
                </div>
                {docs.drhp_link ? (
                  <a
                    href={docs.drhp_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    View DRHP ↗
                  </a>
                ) : (
                  <span className="text-xs text-gray-400 italic">Not available</span>
                )}
              </div>

              <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Red Herring Prospectus (RHP)</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Registered with ROC</p>
                </div>
                {docs.rhp_link ? (
                  <a
                    href={docs.rhp_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    View RHP ↗
                  </a>
                ) : (
                  <span className="text-xs text-gray-400 italic">Not available</span>
                )}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="section-title text-base mb-4">Frequently Asked Questions</h3>
            {faqs.length > 0 ? (
              <div className="space-y-3">
                {faqs.map((f, i) => (
                  <div key={i} className="border border-gray-100 bg-gray-50/50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 text-sm">{f.question}</h4>
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{f.answer}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No FAQs available for this IPO.</p>
            )}
          </div>
        </div>
      )}

      {/* Floating Apply Call to Action */}
      <div className="card p-4 sm:p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-gray-900">Interested in participating in {ipo.ipo_name}?</h4>
          <p className="text-xs text-gray-600 mt-0.5">
            Bidding is open until {formatDate(ipo.end_date)}. Members can track their bids and group allocation.
          </p>
        </div>
        {isAuthenticated ? (
          <Link to={`/user/apply/${ipo.id}`} className="btn btn-primary whitespace-nowrap">
            Apply Now →
          </Link>
        ) : (
          <Link to={`/login?redirect=/ipos/${ipo.id}`} className="btn btn-primary whitespace-nowrap">
            Log In to Apply →
          </Link>
        )}
      </div>
    </div>
  )
}
