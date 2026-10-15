import { useState } from 'react'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function IpoPreview({
  canonicalData,
  onUpdateCanonical,
  onConfirmCreate,
  onBackToEditor,
  creating = false,
  apiError = '',
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditingKeyFields, setIsEditingKeyFields] = useState(false)
  const [showRawJson, setShowRawJson] = useState(false)

  if (!canonicalData) return null

  const d = canonicalData.details || {}
  const gmp = d.gmp || {}
  const sub = d.subscription || {}
  const quota = d.reservation_quota || {}
  const issue = d.issue_details || {}
  const lots = d.lot_size_details || []
  const kpi = d.kpi || {}
  const fin = d.financials || {}
  const comp = d.company_details || {}
  const contact = d.company_contact || {}
  const docs = d.official_documents || {}
  const faqs = d.faq || []

  // Helper to handle inline edits of top-level canonical fields
  const handleFieldChange = (field, value) => {
    onUpdateCanonical(prev => ({
      ...prev,
      [field]: value,
      details: {
        ...prev.details,
        [field]: value,
      },
    }))
  }

  // Helper to format values cleanly, respecting 0 and false
  const renderValue = (val, suffix = '') => {
    if (val === null || val === undefined || val === '') return <span className="text-gray-400 italic">Not Available</span>
    if (typeof val === 'boolean') return <span className="font-medium text-gray-800">{val ? 'Yes' : 'No'}</span>
    return <span className="font-medium text-gray-900">{val}{suffix}</span>
  }

  // Financial periods table rows
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
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Actions Bar */}
      <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-purple">JSON Import Preview</span>
            <span className="badge badge-gray">Draft State</span>
            <span className="text-xs text-gray-400">Source: {d.source || 'IPO Gyani'}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mt-1">{canonicalData.ipo_name}</h2>
          <p className="text-sm text-gray-500">{canonicalData.company_name} · {d.ipo_type || 'Mainboard'} · {d.market_segment || 'BSE, NSE'}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onBackToEditor}
            disabled={creating}
            className="btn btn-secondary btn-sm"
          >
            ← Back to JSON
          </button>
          <button
            type="button"
            onClick={() => setIsEditingKeyFields(!isEditingKeyFields)}
            disabled={creating}
            className="btn btn-secondary btn-sm"
          >
            {isEditingKeyFields ? 'Done Editing' : '✏ Edit Key Fields'}
          </button>
          <button
            type="button"
            onClick={onConfirmCreate}
            disabled={creating}
            className="btn bg-indigo-600 text-white hover:bg-indigo-700 btn-sm shadow"
          >
            {creating ? <><span className="spinner" />Creating IPO…</> : '✓ Create IPO'}
          </button>
        </div>
      </div>

      {apiError && (
        <div className="alert-error">
          <span>⚠</span>
          <span>{apiError}</span>
        </div>
      )}

      {/* Inline Key Fields Editor Modal/Box */}
      {isEditingKeyFields && (
        <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-indigo-900 text-sm">Quick Edit Key IPO Parameters</h3>
            <span className="text-xs text-indigo-600">Changes apply immediately to this preview</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label text-xs">IPO Name</label>
              <input
                type="text"
                className="input input-sm"
                value={canonicalData.ipo_name}
                onChange={e => handleFieldChange('ipo_name', e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">IPO Price / Lot (₹)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                className="input input-sm"
                value={canonicalData.ipo_price}
                onChange={e => handleFieldChange('ipo_price', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label text-xs">Opening Date</label>
              <input
                type="date"
                className="input input-sm"
                value={canonicalData.start_date || ''}
                onChange={e => handleFieldChange('start_date', e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Closing Date</label>
              <input
                type="date"
                className="input input-sm"
                value={canonicalData.end_date || ''}
                onChange={e => handleFieldChange('end_date', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Key Metric Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Issue Price Band</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {d.min_price && d.max_price
              ? `₹${d.min_price} – ₹${d.max_price}`
              : d.max_price
              ? `₹${d.max_price}`
              : formatCurrency(canonicalData.ipo_price)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Face Value: ₹{d.face_value ?? '—'}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Min Investment (1 Lot)</p>
          <p className="text-lg font-bold text-indigo-700 mt-1">
            {formatCurrency(canonicalData.ipo_price)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Lot Size: {d.lot_size ? `${d.lot_size} shares` : '—'}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Total Issue Size</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{d.issue_size || '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Fresh / OFS: {d.fresh_issue === false ? '100% OFS' : 'Fresh & OFS'}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Bidding Window</p>
          <p className="text-sm font-bold text-gray-900 mt-1">
            {formatDate(canonicalData.start_date)}
          </p>
          <p className="text-xs text-gray-500">to {formatDate(canonicalData.end_date)}</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview', label: '1. Overview & Dates' },
          { id: 'gmp_sub', label: '2. GMP & Subscription' },
          { id: 'lots_issue', label: '3. Lots & Quota' },
          { id: 'financials', label: '4. KPIs & Financials' },
          { id: 'company', label: '5. Company & Contacts' },
          { id: 'docs_faq', label: '6. Docs & FAQs' },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`py-3 px-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview & Dates */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="section-title text-base mb-4">Important Schedule Dates</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'IPO Opens', val: canonicalData.start_date },
                { label: 'IPO Closes', val: canonicalData.end_date },
                { label: 'Basis of Allotment', val: d.allotment_date },
                { label: 'Initiation of Refunds', val: d.refund_date },
                { label: 'Credit to Demat', val: d.demat_credit_date },
                { label: 'Listing Date', val: d.listing_date },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                  <p className="text-sm font-bold text-gray-900">{formatDate(item.val)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="section-title text-base mb-4">Issue Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">IPO Type</span>
                {renderValue(d.ipo_type)}
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Market Segment</span>
                {renderValue(d.market_segment)}
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Exchanges</span>
                <span className="font-medium text-gray-900">{d.exchanges?.length ? d.exchanges.join(', ') : 'BSE, NSE'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Sale Type</span>
                {renderValue(d.sale_type)}
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Cut-off Price</span>
                {renderValue(d.cutoff_price ? `₹${d.cutoff_price}` : null)}
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Fresh Issue</span>
                {renderValue(d.fresh_issue)}
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">OFS Percentage</span>
                {renderValue(d.ofs_percentage, '%')}
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Pre-issue Shares</span>
                {renderValue(d.pre_issue_shares ? d.pre_issue_shares.toLocaleString('en-IN') : null)}
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Post-issue Shares</span>
                {renderValue(d.post_issue_shares ? d.post_issue_shares.toLocaleString('en-IN') : null)}
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Company Proceeds</span>
                {renderValue(d.company_proceeds !== null ? `₹${d.company_proceeds}` : null)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: GMP & Subscription */}
      {activeTab === 'gmp_sub' && (
        <div className="space-y-6">
          {/* GMP Card */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="section-title text-base">Grey Market Premium (GMP)</h3>
                <span className="text-xs text-gray-400">Updated: {gmp.source_update_label || 'Recent'}</span>
              </div>
              <span className={`badge ${gmp.is_official ? 'badge-blue' : 'badge-yellow'}`}>
                {gmp.is_official ? 'Official Exchange Data' : 'Unofficial Market Estimate'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <p className="text-xs text-emerald-700 font-medium">Current Premium</p>
                <p className="text-2xl font-bold text-emerald-800 mt-1">
                  {gmp.premium !== null ? `+₹${gmp.premium}` : '—'}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {gmp.premium_percentage !== null ? `(${gmp.premium_percentage}%)` : ''}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 font-medium">Estimated Listing Price</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {gmp.estimated_listing_price ? `₹${gmp.estimated_listing_price}` : '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{gmp.estimated_listing_price_formula || 'Issue + GMP'}</p>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
                <p className="text-xs text-indigo-700 font-medium">Est. Profit / Lot</p>
                <p className="text-2xl font-bold text-indigo-800 mt-1">
                  {gmp.estimated_profit_per_lot ? `₹${gmp.estimated_profit_per_lot.toLocaleString('en-IN')}` : '—'}
                </p>
                <p className="text-xs text-indigo-600 mt-0.5">{gmp.lot_size ? `Lot size: ${gmp.lot_size}` : ''}</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 font-medium">GMP Data Source</p>
                <p className="text-base font-semibold text-gray-800 mt-2">IPO Gyani Tracker</p>
                <p className="text-xs text-gray-400 mt-1">Subject to daily volatility</p>
              </div>
            </div>

            {/* Source Disclaimer Alert */}
            <div className="alert-warning text-xs">
              <span>⚠</span>
              <div>
                <p className="font-semibold">Disclaimer & Advisory</p>
                <p className="mt-0.5 text-amber-900">{gmp.disclaimer}</p>
              </div>
            </div>
          </div>

          {/* Subscription Card */}
          <div className="card p-5">
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

            {sub.disclaimer && (
              <p className="text-xs text-gray-400 mt-3 italic">{sub.disclaimer}</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Lots & Quota */}
      {activeTab === 'lots_issue' && (
        <div className="space-y-6">
          {/* Reservation Quota */}
          <div className="card p-5">
            <h3 className="section-title text-base mb-3">Reservation Quota</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                <p className="text-xs text-indigo-600 font-medium">QIB Quota</p>
                <p className="text-xl font-bold text-indigo-900 mt-1">
                  {quota.qib_percentage !== null ? `${quota.qib_percentage}%` : '—'}
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs text-blue-600 font-medium">Retail Quota</p>
                <p className="text-xl font-bold text-blue-900 mt-1">
                  {quota.retail_percentage !== null ? `${quota.retail_percentage}%` : '—'}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                <p className="text-xs text-purple-600 font-medium">NII / HNI Quota</p>
                <p className="text-xl font-bold text-purple-900 mt-1">
                  {quota.nii_percentage !== null ? `${quota.nii_percentage}%` : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Lot Size Breakdown Table */}
          <div className="card p-5">
            <h3 className="section-title text-base mb-3">Lot Size & Investment Breakdown</h3>
            {lots.length > 0 ? (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Application Category</th>
                      <th className="text-right">Lots</th>
                      <th className="text-right">Shares</th>
                      <th className="text-right">Application Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((l, idx) => (
                      <tr key={idx}>
                        <td className="font-medium text-gray-900">{l.category}</td>
                        <td className="text-right">{l.lots ?? '—'}</td>
                        <td className="text-right">{l.shares ? l.shares.toLocaleString('en-IN') : '—'}</td>
                        <td className="text-right font-semibold text-gray-900">
                          {l.amount ? formatCurrency(l.amount) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No lot size breakdown available in source data.</p>
            )}
          </div>

          {/* Objects of the issue */}
          <div className="card p-5">
            <h3 className="section-title text-base mb-3">Objects of the Issue</h3>
            {issue.objects_of_the_issue?.length > 0 ? (
              <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-700">
                {issue.objects_of_the_issue.map((obj, i) => (
                  <li key={i}>{obj}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic">Not specified in import.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: KPIs & Financial Statements */}
      {activeTab === 'financials' && (
        <div className="space-y-6">
          {/* Financial Statements Comparison Table */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
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
                      <th className="w-1/3">Key Financial Metric</th>
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
              <p className="text-sm text-gray-400 italic">No structured period financial data available.</p>
            )}
          </div>

          {/* KPI Ratios Grid */}
          <div className="card p-5">
            <h3 className="section-title text-base mb-4">Key Performance Indicators (KPIs)</h3>
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

      {/* Tab 5: Company & Contacts */}
      {activeTab === 'company' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="section-title text-base mb-3">Company Profile</h3>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              {comp.summary || 'No company summary provided in import.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4">
              <div>
                <span className="text-gray-500 text-xs block">Industry</span>
                <span className="font-semibold text-gray-900">{comp.industry || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Incorporation</span>
                <span className="font-semibold text-gray-900">{comp.incorporation_month || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Customer Count</span>
                <span className="font-semibold text-gray-900">{comp.customer_count ?? '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Promoters</span>
                <span className="font-semibold text-gray-900">{comp.promoters?.join(', ') || '—'}</span>
              </div>
            </div>

            {comp.manufacturing_locations?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Manufacturing Facilities</span>
                <div className="flex flex-wrap gap-2">
                  {comp.manufacturing_locations.map((loc, i) => (
                    <span key={i} className="badge badge-gray">{loc}</span>
                  ))}
                </div>
              </div>
            )}

            {comp.countries_exported_to?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Export Markets</span>
                <div className="flex flex-wrap gap-2">
                  {comp.countries_exported_to.map((c, i) => (
                    <span key={i} className="badge badge-blue">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="section-title text-base mb-3">Lead Managers & Registrar</h3>
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
                      <a href={issue.registrar.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                        {issue.registrar.website}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="section-title text-base mb-3">Company Contact Information</h3>
            <div className="space-y-1 text-sm text-gray-700">
              <p><span className="text-gray-500">Address:</span> {contact.address || '—'}</p>
              <p><span className="text-gray-500">Phone:</span> {contact.phone || '—'}</p>
              <p><span className="text-gray-500">Email:</span> {contact.email || '—'}</p>
              {contact.website && (
                <p>
                  <span className="text-gray-500">Website:</span>{' '}
                  <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                    {contact.website}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Docs & FAQs */}
      {activeTab === 'docs_faq' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h3 className="section-title text-base mb-3">Official Offer Documents</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Draft Red Herring Prospectus (DRHP)</h4>
                  <p className="text-xs text-gray-400 mt-0.5">SEBI Filing Document</p>
                </div>
                {docs.drhp_link ? (
                  <a
                    href={docs.drhp_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    Open DRHP ↗
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
                    Open RHP ↗
                  </a>
                ) : (
                  <span className="text-xs text-gray-400 italic">Not available</span>
                )}
              </div>
            </div>
            {docs.document_notes && (
              <p className="text-xs text-gray-500 mt-3 italic">{docs.document_notes}</p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="section-title text-base mb-3">Frequently Asked Questions ({faqs.length})</h3>
            {faqs.length > 0 ? (
              <div className="space-y-3">
                {faqs.map((f, i) => (
                  <div key={i} className="border border-gray-100 bg-gray-50/50 rounded-lg p-3.5">
                    <h4 className="font-semibold text-gray-900 text-sm">{f.question}</h4>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{f.answer}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No FAQs provided in this import.</p>
            )}
          </div>
        </div>
      )}

      {/* Raw JSON Debugging Drawer / Toggle */}
      <div className="card p-4">
        <button
          type="button"
          onClick={() => setShowRawJson(!showRawJson)}
          className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1.5"
        >
          <span>{showRawJson ? '▼ Hide' : '► Inspect'} Raw Imported JSON Payload</span>
        </button>
        {showRawJson && (
          <pre className="mt-3 bg-gray-900 text-gray-100 p-4 rounded-xl text-xs overflow-x-auto max-h-96">
            {JSON.stringify(d.raw_json || canonicalData, null, 2)}
          </pre>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur border border-indigo-200 shadow-xl rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-gray-500">
          <span>Ready to save? This IPO will be created as </span>
          <span className="font-bold text-gray-800">DRAFT</span>
          <span>. You can publish it to </span>
          <span className="font-bold text-green-700">OPEN</span>
          <span> when ready.</span>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onBackToEditor}
            disabled={creating}
            className="btn btn-secondary flex-1 sm:flex-none"
          >
            ← Back to Editor
          </button>
          <button
            type="button"
            onClick={onConfirmCreate}
            disabled={creating}
            className="btn bg-indigo-600 text-white hover:bg-indigo-700 flex-1 sm:flex-none"
          >
            {creating ? <><span className="spinner" />Creating IPO…</> : '✓ Create IPO'}
          </button>
        </div>
      </div>
    </div>
  )
}
