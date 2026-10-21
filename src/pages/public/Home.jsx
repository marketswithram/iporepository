import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { getAllPublicIpos } from '../../services/ipoService'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate, getIpoStatusBadgeClass, getIpoStatusLabel } from '../../utils/formatters'

const FEATURES = [
  { icon: '📋', title: 'Track IPO Participation', desc: "Record your group's participation seamlessly — as Investors or Account Holders." },
  { icon: '📊', title: 'Result Management', desc: 'Admin imports broker results from Excel. System parses, validates, and updates records atomically.' },
  { icon: '💰', title: 'Profit & Loss Analytics', desc: 'Each member sees their individual profit/loss and allotment. Admin gets comprehensive group-level summaries.' },
  { icon: '🔒', title: 'Secure & Private', desc: 'Row-level database security ensures complete financial privacy. No member sees another’s settlement numbers.' },
]

const WORKFLOW_STEPS = [
  { step: '01', title: 'Admin Creates IPO', desc: 'Admin opens a new IPO record with issue price, lot size, bidding start and end dates.' },
  { step: '02', title: 'Members Apply', desc: 'Group members log in and submit applications as Investors (with application numbers) or Account Holders.' },
  { step: '03', title: 'Admin Manages Participants', desc: 'Admin views all registered participants, monitors participation, and exports formatted lists.' },
  { step: '04', title: 'IPO Allotment Finalized', desc: 'External exchange/broker allotment completes. Admin receives official allotment & settlement Excel files.' },
  { step: '05', title: 'Admin Imports Excel Results', desc: 'Admin pastes Excel data. The system automatically matches rows to members with preview and validation.' },
  { step: '06', title: 'Atomic Result Settlement', desc: 'On admin confirmation, results are committed atomically with automated profit, tax, and refund calculation.' },
  { step: '07', title: 'Transparent P&L Settlement', desc: 'Automated 80/20 profit split between Investors and Account Holders, or 100% for direct applicants.' },
  { step: '08', title: 'Members View Results', desc: 'Each member views their personalized allotment status, refund amount, profit share, and final payout.' },
]

export default function Home() {
  const location = useLocation()
  const { isAuthenticated } = useAuth()

  const [ipos, setIpos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('open') // 'open' | 'upcoming' | 'closed' | 'all'
  const [searchTerm, setSearchTerm] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('ALL') // 'ALL' | 'Mainboard' | 'SME'

  // Fetch all public IPOs on mount
  useEffect(() => {
    let isMounted = true
    setLoading(true)

    getAllPublicIpos()
      .then(data => {
        if (!isMounted) return
        setIpos(data || [])
      })
      .catch(err => {
        if (!isMounted) return
        console.error('Failed to fetch public IPOs:', err)
        setError('Failed to load IPO data. Please refresh or try again later.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [])

  // Smooth scroll handler when hash changes or on route arrival
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '')
      const timer = setTimeout(() => {
        const el = document.getElementById(id)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 120)
      return () => clearTimeout(timer)
    }
  }, [location.hash])

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.pushState(null, '', `#${id}`)
    }
  }

  // Categorize IPOs into Open, Upcoming, and Recently Closed
  const categorized = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const open = []
    const upcoming = []
    const closed = []

    ipos.forEach(item => {
      const status = (item.status || '').toUpperCase()
      const startDate = item.start_date ? item.start_date.slice(0, 10) : null
      const endDate = item.end_date ? item.end_date.slice(0, 10) : null

      if (status === 'OPEN') {
        open.push(item)
      } else if (status === 'UPCOMING' || (startDate && startDate > todayStr && !['CLOSED', 'PROCESSING', 'COMPLETED'].includes(status))) {
        upcoming.push(item)
      } else if (['CLOSED', 'PROCESSING', 'COMPLETED'].includes(status) || (endDate && endDate < todayStr)) {
        closed.push(item)
      } else {
        closed.push(item)
      }
    })

    return {
      open,
      upcoming,
      closed,
      all: ipos,
    }
  }, [ipos])

  // Filter based on active tab, search term, and segment
  const displayedIpos = useMemo(() => {
    let list = categorized[activeTab] || []

    if (segmentFilter !== 'ALL') {
      list = list.filter(item => {
        const seg = (item.details?.market_segment || item.details?.ipo_type || '').toLowerCase()
        return seg.includes(segmentFilter.toLowerCase())
      })
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      list = list.filter(item =>
        (item.ipo_name && item.ipo_name.toLowerCase().includes(q)) ||
        (item.ipo_code && item.ipo_code.toLowerCase().includes(q)) ||
        (item.details?.company_name && item.details.company_name.toLowerCase().includes(q))
      )
    }

    return list
  }, [categorized, activeTab, segmentFilter, searchTerm])

  const openCount = categorized.open.length
  const upcomingCount = categorized.upcoming.length
  const closedCount = categorized.closed.length
  const totalCount = categorized.all.length

  return (
    <div className="animate-fade-in">
      {/* ── 1. Hero ────────────────────────────────────────── */}
      <section id="hero" className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-blue-800/50 rounded-full px-4 py-1.5 text-sm font-medium mb-6 border border-blue-500/40">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {!loading ? (openCount > 0 ? `${openCount} IPO${openCount > 1 ? 's' : ''} currently open for bidding` : 'No open IPOs right now') : 'Checking live IPOs…'}
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 text-balance tracking-tight">
              Group IPO Tracking<span className="text-blue-200"> Made Simple</span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 leading-relaxed max-w-2xl">
              Track your investment group's IPO participation, manage allotment results seamlessly from Excel, and see transparent profit & loss — all in one secure platform.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" className="btn btn-lg bg-white text-blue-700 hover:bg-blue-50 shadow-lg font-semibold">
                Get Started Free
              </Link>
              <button
                type="button"
                onClick={() => scrollTo('ipos')}
                className="btn btn-lg border border-blue-400 text-white hover:bg-blue-600/50 cursor-pointer"
              >
                View Available IPOs ↓
              </button>
            </div>
            <p className="mt-4 text-blue-300 text-xs">
              ⚠ This platform tracks participation and internal settlement only. It does not submit applications directly to stock exchanges.
            </p>
          </div>
        </div>
      </section>

      {/* ── 2. Public IPOs Hub (Available, Upcoming, Recently Closed) ── */}
      <section id="ipos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full mb-2 uppercase tracking-wider">
              <span>●</span> Market Opportunities
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Public IPO Directory
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Explore open IPOs available for participation, upcoming issues, and recently closed group investments.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 px-3 py-1 rounded-lg text-xs font-medium text-green-800">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {openCount} Available
            </span>
            <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg text-xs font-medium text-blue-800">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {upcomingCount} Upcoming
            </span>
            <span className="inline-flex items-center gap-1.5 bg-purple-50 border border-purple-200 px-3 py-1 rounded-lg text-xs font-medium text-purple-800">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              {closedCount} Recently Closed
            </span>
          </div>
        </div>

        {/* Filters and Tabs */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Category Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab('open')}
                className={
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ' +
                  (activeTab === 'open'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                }
              >
                <span>🟢 Available IPOs</span>
                <span className={activeTab === 'open' ? 'bg-blue-700 text-white px-2 py-0.5 rounded-full text-xs' : 'bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs'}>
                  {openCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('upcoming')}
                className={
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ' +
                  (activeTab === 'upcoming'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                }
              >
                <span>📅 Upcoming IPOs</span>
                <span className={activeTab === 'upcoming' ? 'bg-blue-700 text-white px-2 py-0.5 rounded-full text-xs' : 'bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs'}>
                  {upcomingCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('closed')}
                className={
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ' +
                  (activeTab === 'closed'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                }
              >
                <span>🏁 Recently Closed</span>
                <span className={activeTab === 'closed' ? 'bg-blue-700 text-white px-2 py-0.5 rounded-full text-xs' : 'bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs'}>
                  {closedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ' +
                  (activeTab === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                }
              >
                <span>All IPOs</span>
                <span className={activeTab === 'all' ? 'bg-blue-700 text-white px-2 py-0.5 rounded-full text-xs' : 'bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs'}>
                  {totalCount}
                </span>
              </button>
            </div>

            {/* Market Segment Pill Filter */}
            <div className="flex items-center gap-1.5 self-start lg:self-auto">
              <span className="text-xs text-gray-500 font-medium mr-1 hidden sm:inline">Segment:</span>
              {['ALL', 'Mainboard', 'SME'].map(seg => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setSegmentFilter(seg)}
                  className={
                    'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ' +
                    (segmentFilter === seg
                      ? 'bg-blue-100 text-blue-700 font-bold'
                      : 'text-gray-500 hover:bg-gray-100')
                  }
                >
                  {seg === 'ALL' ? 'All Segments' : seg}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              🔍
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by company name, IPO name, or IPO code (e.g. IPO1010)…"
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-500">Fetching public IPO records…</p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error mb-6">
            <span>⚠</span>
            <p>{error}</p>
          </div>
        )}

        {/* Empty States */}
        {!loading && !error && displayedIpos.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 px-6">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
              {activeTab === 'upcoming' ? '📅' : activeTab === 'open' ? '📋' : '🔍'}
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {activeTab === 'upcoming'
                ? 'No Upcoming IPOs Scheduled Right Now'
                : activeTab === 'open'
                ? 'No Open IPOs at This Exact Moment'
                : 'No Matching IPOs Found'}
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
              {activeTab === 'upcoming'
                ? 'New issue announcements and exchange draft filings will appear here as soon as dates are confirmed.'
                : activeTab === 'open'
                ? 'Check back soon for new IPO openings, or browse our recently closed issues to review historical performance.'
                : 'Try adjusting your search keywords or switching market segment filters.'}
            </p>
            {activeTab !== 'open' && openCount > 0 && (
              <button
                type="button"
                onClick={() => { setActiveTab('open'); setSearchTerm('') }}
                className="btn btn-secondary btn-sm"
              >
                View {openCount} Currently Open IPO{openCount > 1 ? 's' : ''} →
              </button>
            )}
          </div>
        )}

        {/* IPO Cards Grid */}
        {!loading && !error && displayedIpos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedIpos.map(ipo => {
              const details = ipo.details || {}
              const gmp = details.gmp_data || {}
              const isOpen = (ipo.status || '').toUpperCase() === 'OPEN'
              const isProcessing = (ipo.status || '').toUpperCase() === 'PROCESSING'
              const isCompleted = (ipo.status || '').toUpperCase() === 'COMPLETED'
              const isUpcoming = (ipo.status || '').toUpperCase() === 'UPCOMING' || (ipo.start_date && new Date(ipo.start_date) > new Date())

              return (
                <div
                  key={ipo.id}
                  className="card p-6 flex flex-col justify-between hover:shadow-lg transition-all duration-200 border border-gray-200/90 group"
                >
                  <div>
                    {/* Header tags */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60">
                          {details.ipo_type || details.market_segment || 'Mainboard'}
                        </span>
                        <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {ipo.ipo_code}
                        </span>
                      </div>

                      {/* Status badge */}
                      {isOpen ? (
                        <span className="badge badge-green flex items-center gap-1 font-semibold">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          Open
                        </span>
                      ) : isProcessing ? (
                        <span className="badge badge-yellow font-semibold">Allotment Ongoing</span>
                      ) : isCompleted ? (
                        <span className="badge badge-purple font-semibold">Closed</span>
                      ) : (
                        <span className={getIpoStatusBadgeClass(ipo.status)}>
                          {getIpoStatusLabel(ipo.status)}
                        </span>
                      )}
                    </div>

                    {/* Company / IPO Name */}
                    <div className="mb-4">
                      <Link
                        to={`/ipos/${ipo.id}`}
                        className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1"
                        title={ipo.ipo_name}
                      >
                        {ipo.ipo_name}
                      </Link>
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5" title={details.company_name || ipo.ipo_name}>
                        {details.company_name || ipo.ipo_name}
                      </p>
                    </div>

                    {/* GMP highlight if available */}
                    {gmp.premium !== undefined && gmp.premium !== null && (
                      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 mb-4 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-800">
                          <span className="font-bold">📈 GMP</span>
                          <span className="font-extrabold text-emerald-900">
                            +₹{gmp.premium}
                          </span>
                          {gmp.premium_percentage && (
                            <span className="text-emerald-700 font-semibold">
                              (+{gmp.premium_percentage}%)
                            </span>
                          )}
                        </div>
                        {gmp.estimated_listing_price && (
                          <div className="text-[11px] text-emerald-700">
                            Est: <strong className="text-emerald-900">₹{gmp.estimated_listing_price}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2x2 Grid of Key Metrics */}
                    <div className="grid grid-cols-2 gap-2 bg-gray-50/70 rounded-xl p-3 mb-4 text-xs">
                      <div>
                        <span className="text-gray-400 block mb-0.5">Issue Price</span>
                        <span className="font-bold text-gray-900 text-sm">
                          {formatCurrency(ipo.ipo_price)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Lot Size</span>
                        <span className="font-semibold text-gray-800">
                          {details.lot_size ? `${details.lot_size} Shares` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Min Investment</span>
                        <span className="font-semibold text-gray-800">
                          {formatCurrency(details.min_investment || ipo.ipo_price)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Issue Size</span>
                        <span className="font-semibold text-gray-800 truncate block">
                          {details.issue_size || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Timeline dates */}
                    <div className="space-y-1 text-xs text-gray-500 mb-5">
                      <div className="flex justify-between">
                        <span>Bidding Period:</span>
                        <span className="font-medium text-gray-800">
                          {formatDate(ipo.start_date)} — {formatDate(ipo.end_date)}
                        </span>
                      </div>
                      {details.listing_date && (
                        <div className="flex justify-between">
                          <span>Listing Date:</span>
                          <span className="font-medium text-gray-800">{formatDate(details.listing_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <Link
                      to={`/ipos/${ipo.id}`}
                      className="btn btn-secondary flex-1 text-xs font-semibold py-2"
                    >
                      View Details
                    </Link>

                    {isOpen ? (
                      isAuthenticated ? (
                        <Link
                          to={`/user/apply/${ipo.id}`}
                          className="btn btn-primary flex-1 text-xs font-semibold py-2 shadow-sm"
                        >
                          Apply Now →
                        </Link>
                      ) : (
                        <Link
                          to="/login"
                          className="btn btn-primary flex-1 text-xs font-semibold py-2 shadow-sm"
                        >
                          Log In to Apply →
                        </Link>
                      )
                    ) : (
                      <Link
                        to={`/ipos/${ipo.id}`}
                        className="btn btn-ghost flex-1 text-xs text-gray-600 hover:text-gray-900 py-2 border border-gray-200"
                      >
                        {isCompleted ? 'View Result' : 'View Timetable'}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 3. Features Section ────────────────────────────── */}
      <section id="features" className="bg-gray-100/70 border-y border-gray-200/60 py-20 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
              Everything Your Investment Group Needs
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base">
              A comprehensive platform engineered for tracking IPO participation, importing broker spreadsheets, and transparent profit distribution.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="card p-6 hover:shadow-md transition-shadow duration-200 bg-white">
                <div className="text-3xl mb-4 p-2.5 bg-blue-50 rounded-xl w-fit">{f.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. How It Works Section ────────────────────────── */}
      <section id="how-it-works" className="bg-gray-900 text-white py-20 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 bg-blue-900/50 px-3 py-1 rounded-full mb-3 uppercase tracking-wider border border-blue-700/50">
              Workflow & Operations
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight">
              How the Platform Works
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base">
              From IPO announcement to atomic result settlement — follow the step-by-step group investment lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            {WORKFLOW_STEPS.map(s => (
              <div
                key={s.step}
                className="bg-gray-800/90 rounded-2xl p-6 border border-gray-700/80 hover:border-blue-500/60 transition-colors flex flex-col justify-between"
              >
                <div>
                  <span className="text-blue-400 font-mono font-bold text-xl block mb-2">{s.step}</span>
                  <h3 className="text-white font-bold text-base mb-2">{s.title}</h3>
                  <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Privacy & Security Callout */}
          <div className="bg-blue-950/60 border border-blue-800/60 rounded-2xl p-6 max-w-4xl mx-auto flex items-start gap-4">
            <div className="text-2xl mt-0.5">🔒</div>
            <div>
              <h4 className="text-white font-bold text-sm sm:text-base mb-1">
                Strict Financial Privacy & Row-Level Security
              </h4>
              <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
                All participant details, application numbers, allotments, and profit shares are protected by PostgreSQL Row-Level Security (RLS). Group members only see their own financial data and settlement records.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. About Section ──────────────────────────────── */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-3 uppercase tracking-wider">
              About The Platform
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              About IPO Tracker
            </h2>
            <p className="text-gray-600 mt-2 leading-relaxed text-sm sm:text-base">
              IPO Tracker is a collaborative management and record-keeping tool created specifically for investment collectives, family offices, and informal groups participating in Initial Public Offerings together.
            </p>
          </div>

          {/* Regulatory Disclaimer Card */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8 flex items-start gap-4">
            <span className="text-2xl">⚠</span>
            <div>
              <h3 className="font-bold text-amber-900 text-sm sm:text-base mb-1">Important Regulatory Disclaimer</h3>
              <p className="text-amber-800 text-xs sm:text-sm leading-relaxed">
                This platform is an independent internal record-keeping and tracking system. It does <strong>NOT</strong> accept funds or execute bids on Indian stock exchanges (BSE/NSE) or through depository participants. All formal IPO applications must be submitted by individual account holders via ASBA or registered brokers as per SEBI regulations.
              </p>
            </div>
          </div>

          {/* Member vs Admin Capability Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="card p-6 bg-white border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">👤</span>
                <h3 className="font-bold text-gray-900 text-lg">For Group Members</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  'Browse open, upcoming, and past IPO details with GMP estimates',
                  'Register participation as Investor or Account Holder',
                  'View personal application status and allotment confirmation',
                  'Access transparent profit & loss calculations and refund details',
                  'Maintain historical participation and tax settlement records'
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="text-green-500 font-bold mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-6 bg-white border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">⚙</span>
                <h3 className="font-bold text-gray-900 text-lg">For Group Administrators</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  'Create new IPOs and publish comprehensive issue details',
                  'Export participant and application lists for broker submission',
                  'Import allotment Excel spreadsheets with visual row validation',
                  'Execute atomic settlements with automated 80/20 profit splitting',
                  'Generate group analytics, profit summaries, and audit histories'
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="text-blue-500 font-bold mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Profit Sharing Model Note */}
          <div className="card p-6 bg-gray-50 border border-gray-200">
            <h4 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
              🤝 Collaborative Investment & Profit Sharing Model
            </h4>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
              When group members apply as a direct Investor (applying with their own funds and account), they retain 100% of the net profit. In joint participations, where one member acts as the capital Investor and another provides the Demat Account, the system automatically computes an 80% Investor and 20% Account Holder profit allocation upon allotment.
            </p>
          </div>
        </div>
      </section>

      {/* ── 6. Call to Action ─────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-10 md:p-14 text-center text-white shadow-xl">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight">
            Ready to Streamline Your Group's IPOs?
          </h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto text-base">
            Join other investment groups who save hours managing participation lists and calculating allotment profits.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn btn-lg bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-md">
              Create Free Account
            </Link>
            <Link to="/login" className="btn btn-lg border border-blue-300 text-white hover:bg-blue-600/50 font-semibold">
              Sign In to Your Group
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
