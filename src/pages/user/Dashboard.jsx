import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getUserParticipatedIpos, getOpenIpos, getUserProfitLossSummary } from '../../services/ipoService'



const SCRIP_BADGE_STYLES = [
  'bg-indigo-50 border-indigo-100 text-indigo-700',
  'bg-amber-50 border-amber-200 text-amber-700',
  'bg-slate-100 border-slate-200 text-slate-700',
  'bg-teal-50 border-teal-200 text-teal-700',
  'bg-orange-50 border-orange-200 text-orange-700',
]

function formatINR(val) {
  const num = Number(val) || 0
  return num.toLocaleString('en-IN')
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function UserDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [participations, setParticipations] = useState([])
  const [openIpos, setOpenIpos] = useState([])
  const [dbSummary, setDbSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

  const userName = profile?.full_name || 'Satish Kumar'
  const firstName = userName.split(' ')[0] || 'Satish'

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      try {
        setLoading(true)
        const [partRes, openRes, sumRes] = await Promise.allSettled([
          profile?.id
            ? getUserParticipatedIpos({ page: 1, pageSize: 100, userId: profile.id })
            : Promise.resolve({ data: [] }),
          getOpenIpos(),
          profile?.id
            ? getUserProfitLossSummary(profile.id)
            : Promise.resolve(null),
        ])

        if (isMounted) {
          if (partRes.status === 'fulfilled' && partRes.value?.data) {
            setParticipations(partRes.value.data)
          }
          if (openRes.status === 'fulfilled' && openRes.value) {
            setOpenIpos(openRes.value)
          }
          if (sumRes.status === 'fulfilled' && sumRes.value) {
            setDbSummary(sumRes.value)
          }
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()
    return () => { isMounted = false }
  }, [profile?.id])

  const hasRealData = participations.length > 0

  // Calculate summary metrics
  const summary = useMemo(() => {
    if (!hasRealData && !dbSummary) {
      return {
        totalApplications: 0,
        companiesCount: 0,
        allotted: 0,
        missed: 0,
        winRate: '0.0',
        realizedProfit: 0,
        blockedCapital: 0,
        activeBidsCount: 0,
        totalCapital: 0,
      }
    }

    let allotted = 0
    let missed = 0
    let totalProfit = 0
    let blockedCap = 0
    let activeBids = 0
    let totalCap = 0
    const companySet = new Set()

    for (const p of participations) {
      const ipo = Array.isArray(p.ipos) ? p.ipos[0] : (p.ipos || {})
      if (ipo?.ipo_name) companySet.add(ipo.ipo_name)
      const r = Array.isArray(p.ipo_results) ? p.ipo_results[0] : p.ipo_results
      const price = Number(ipo?.ipo_price || 14880)
      const lots = Number(r?.lots || 1)
      const bidAmt = price > 0 ? price * lots : 14880
      totalCap += bidAmt

      if (r) {
        if (r.allotted) {
          allotted++
        } else if (r.applied || r.refund_amount) {
          missed++
        }
        // Use user's actual profit share (80% / 20% / 100%)
        const uProfit = p.user_profit !== undefined
          ? Number(p.user_profit)
          : Number(r.profit_amount ?? 0)
        totalProfit += uProfit
      } else {
        blockedCap += bidAmt
        activeBids++
      }
    }

    // Prefer the database table net_profit if available from user_ipo_profits
    const finalRealizedProfit = dbSummary?.net_profit !== undefined
      ? Number(dbSummary.net_profit)
      : totalProfit

    const totalApps = participations.length
    const winRate = totalApps > 0 ? ((allotted / totalApps) * 100).toFixed(1) : '0.0'

    return {
      totalApplications: totalApps,
      companiesCount: companySet.size || totalApps,
      allotted,
      missed,
      winRate,
      realizedProfit: finalRealizedProfit,
      blockedCapital: blockedCap > 0 ? blockedCap : (activeBids > 0 ? activeBids * 14880 : 0),
      activeBidsCount: activeBids,
      totalCapital: totalCap,
    }
  }, [hasRealData, participations, dbSummary])

  // Normalise table items
  const tableItems = useMemo(() => {
    if (!hasRealData) {
      return []
    }

    return participations.map((p, idx) => {
      const ipo = Array.isArray(p.ipos) ? p.ipos[0] : (p.ipos || {})
      const r = Array.isArray(p.ipo_results) ? p.ipo_results[0] : p.ipo_results
      const ipoName = ipo.ipo_name || p.ipo_name || ipo.ipo_code || 'IPO'
      const initials = (ipo.ipo_code || ipoName).replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'IPO'
      const lots = Number(r?.lots || 1)
      const price = Number(ipo.ipo_price || 14880)
      const lotAmount = price * lots

      let status = 'APPLIED'
      let profitText = 'Pending'
      let profitSub = 'Awaiting Allotment'

      if (r) {
        if (r.allotted) {
          status = 'SELECTED'
        } else if (r.refund_amount || r.applied === false) {
          status = 'REJECTED'
        } else {
          status = 'PENDING'
        }

        const pAmount = p.user_profit !== undefined ? Number(p.user_profit) : Number(r.profit_amount ?? 0)
        if (pAmount > 0) {
          profitText = `+₹${formatINR(pAmount)}`
          profitSub = p.user_role === 'INVESTOR' ? '80% Investor Share'
                    : p.user_role === 'ACCOUNT_HOLDER' ? '20% Acct. Holder Share'
                    : '+ Listing Gain'
        } else if (pAmount < 0) {
          profitText = `-₹${formatINR(Math.abs(pAmount))}`
          profitSub = 'Loss Share'
        } else {
          profitText = r.refund_amount ? 'Refunded' : '₹0'
          profitSub = r.refund_amount ? `₹${formatINR(r.refund_amount)} unblocked` : 'Mandate revoked'
        }
      } else if (ipo.status === 'OPEN') {
        status = 'APPLIED'
        profitText = 'Mandate Active'
        profitSub = 'ASBA Verified'
      }

      const holderDisplay = p.user_role === 'INVESTOR' && p.profiles?.full_name
        ? `Via ${p.profiles.full_name}`
        : p.user_role === 'ACCOUNT_HOLDER' && p.investor?.full_name
        ? `For ${p.investor.full_name}`
        : userName

      return {
        id: p.id,
        initials,
        colorIndex: idx % SCRIP_BADGE_STYLES.length,
        name: ipoName,
        code: ipo.ipo_code || '',
        holder: holderDisplay,
        lots,
        amount: lotAmount,
        status,
        profitText,
        profitSub,
        date: formatDisplayDate(p.created_at),
        isDemo: false,
      }
    })
  }, [hasRealData, participations, userName])

  // Latest available IPO
  const latestOpenIpo = openIpos.length > 0 ? openIpos[0] : null

  // Year Range derived from IPO history (participations)
  const yearRange = useMemo(() => {
    const items = hasRealData ? participations : []
    if (!items || items.length === 0) {
      return new Date().getFullYear().toString()
    }

    const years = []
    for (const item of items) {
      const dateVal =
        item.created_at ||
        (Array.isArray(item.ipos) ? item.ipos[0]?.start_date : item.ipos?.start_date) ||
        (Array.isArray(item.ipos) ? item.ipos[0]?.created_at : item.ipos?.created_at) ||
        item.date
      if (dateVal) {
        const yr = new Date(dateVal).getFullYear()
        if (!isNaN(yr)) years.push(yr)
      }
    }

    if (years.length === 0) {
      return new Date().getFullYear().toString()
    }

    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)

    return minYear === maxYear ? `${minYear}` : `${minYear}-${maxYear}`
  }, [hasRealData, participations])

  // Pagination
  const totalPages = Math.ceil(tableItems.length / pageSize) || 1
  const displayedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return tableItems.slice(start, start + pageSize)
  }, [tableItems, currentPage, pageSize])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-600">Loading your portfolio analytics…</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 space-y-7 max-w-7xl mx-auto w-full animate-fade-in">
      {/* BEGIN: Hero Welcome & Quick Action */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1" data-purpose="dashboard-header">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-midnight-950 tracking-tight flex items-center gap-2">
            Welcome, {firstName}
            <span className="inline-block hover:rotate-12 transition-transform duration-200 cursor-default">👋</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Portfolio &amp; IPO Participation Summary
          </p>
        </div>
        <Link
          to="/user/ipos"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:from-indigo-700 text-white font-semibold text-sm shadow-luxury-btn hover:shadow-indigo-500/40 transition-all fintech-interactive shrink-0"
          data-purpose="apply-ipo-action"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="12" x2="12" y1="5" y2="19"></line>
            <line x1="5" x2="19" y1="12" y2="12"></line>
          </svg>
          <span>Apply for IPO</span>
        </Link>
      </section>
      {/* END: Hero Welcome & Quick Action */}

      {/* BEGIN: 3 Premier Metric Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-purpose="metric-overview-grid">
        {/* Card 1: Total Applications */}
        <article className="fintech-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-slate-100/60 pointer-events-none transition-transform group-hover:scale-110"></div>
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Applications</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              All-time
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between relative z-10">
            <div>
              <p className="text-3xl font-extrabold text-midnight-950 font-mono tracking-tight">
                {summary.totalApplications}
              </p>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Across {summary.companiesCount} {summary.companiesCount === 1 ? 'Company' : 'Companies'}
              </p>
            </div>
            {/* Sparkline */}
            <div className="w-16 h-8 text-indigo-500 shrink-0">
              <svg className="w-full h-full" fill="none" viewBox="0 0 64 32">
                <path d="M2 26 C 14 24, 22 14, 34 18 C 46 22, 54 8, 62 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
              </svg>
            </div>
          </div>
        </article>

        {/* Card 2: Allotment Win Rate */}
        <article className="fintech-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-50/60 pointer-events-none transition-transform group-hover:scale-110"></div>
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Allotment Win Rate</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {summary.winRate}% Win
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between relative z-10">
            <div>
              <p className="text-3xl font-extrabold text-midnight-950 font-mono tracking-tight">
                {summary.allotted} <span className="text-sm font-semibold text-slate-400">/ {summary.totalApplications}</span>
              </p>
              <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                {summary.allotted} Allotted • {summary.missed} Missed
              </p>
            </div>
            {/* Sparkline */}
            <div className="w-16 h-8 text-emerald-500 shrink-0">
              <svg className="w-full h-full" fill="none" viewBox="0 0 64 32">
                <path d="M2 28 C 16 28, 24 16, 38 18 C 48 20, 54 8, 62 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
              </svg>
            </div>
          </div>
        </article>

        {/* Card 3: Realized Profit */}
        <article className="fintech-card rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-50/70 pointer-events-none transition-transform group-hover:scale-110"></div>
          <div className="flex items-start justify-between relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Realized Profit</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              +18.4% YoY
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between relative z-10">
            <div>
              <p className="text-3xl font-extrabold text-emerald-600 font-mono tracking-tight">
                ₹{formatINR(summary.realizedProfit)}
              </p>
              <p className="text-xs font-medium text-emerald-700/80 mt-1">
                Booked in {yearRange}
              </p>
            </div>
            {/* Sparkline */}
            <div className="w-16 h-8 text-emerald-500 shrink-0">
              <svg className="w-full h-full" fill="none" viewBox="0 0 64 32">
                <path d="M2 24 C 14 26, 26 14, 40 12 C 50 10, 56 4, 62 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
              </svg>
            </div>
          </div>
        </article>
      </section>
      {/* END: Metric Summary Cards */}

      {/* BEGIN: Quick Action & Shortcut Row */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5" data-purpose="quick-access-shortcuts">
        {/* Card 1: Available IPOs */}
        <div
          onClick={() => navigate('/user/ipos')}
          className="cursor-pointer bg-gradient-to-br from-white via-indigo-50/30 to-white border border-slate-200/80 hover:border-indigo-300 shadow-[0_4px_20px_-4px_rgba(79,70,229,0.08)] hover:shadow-[0_8px_30px_-6px_rgba(79,70,229,0.16)] transition-all duration-300 rounded-2xl p-5 group flex flex-col justify-between relative overflow-hidden"
        >
          <div className="space-y-3.5 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-200/60 text-indigo-600 flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" x2="12" y1="18" y2="12"></line>
                    <line x1="9" x2="15" y1="15" y2="15"></line>
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-midnight-950 group-hover:text-indigo-600 transition-colors">
                  Available IPOs
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {openIpos.length} OPEN
              </span>
            </div>

            {/* Dynamic IPO Name / Details */}
            <div className="space-y-1.5 pt-1 min-h-[50px] flex flex-col justify-center">
              {latestOpenIpo ? (
                <>
                  <p className="text-xs text-slate-500 font-medium">Latest Available IPO</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{latestOpenIpo.ipo_name}</span>
                    {latestOpenIpo.ipo_price && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ₹{formatINR(latestOpenIpo.ipo_price)}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500">No open IPOs currently available for bidding</p>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: IPO History & Bids */}
        <div
          onClick={() => navigate('/user/history')}
          className="cursor-pointer bg-gradient-to-br from-white via-emerald-50/25 to-white border border-slate-200/80 hover:border-emerald-300 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.08)] hover:shadow-[0_8px_30px_-6px_rgba(16,185,129,0.16)] transition-all duration-300 rounded-2xl p-5 group flex flex-col justify-between relative overflow-hidden"
        >
          <div className="space-y-3.5 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-200/60 text-emerald-600 flex items-center justify-center shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-midnight-950 group-hover:text-emerald-600 transition-colors">
                  IPO History &amp; Bids
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {summary.totalApplications} Total Applications
              </span>
            </div>

            {/* Replaced with how much applied and how much allotted */}
            <div className="space-y-2 pt-1 min-h-[50px] flex flex-col justify-center">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Applied:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {summary.totalApplications} {summary.totalApplications === 1 ? 'Application' : 'Applications'} • ₹{formatINR(summary.totalCapital)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Allotted:</span>
                <span className="font-bold text-emerald-600 font-mono">
                  {summary.allotted} Allotted ({summary.winRate}% Hit)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* END: Quick Action Cards */}

      {/* BEGIN: Recent Participations Table */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-luxury-card overflow-hidden" data-purpose="recent-participations-section">
        {/* Table Header Title Bar */}
        <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-midnight-950 tracking-tight">Recent IPO Participations</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed log of bids, allotment states, and recorded gains across demat accounts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs font-mono text-slate-400">Sync: 2m ago</span>
            <Link
              to="/user/history"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors px-3 py-1.5 rounded-lg bg-indigo-50/70 hover:bg-indigo-100/70"
            >
              <span>View All Records</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/70 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-6" scope="col">IPO</th>
                <th className="py-3 px-6" scope="col">Lots Applied</th>
                <th className="py-3 px-6" scope="col">Amount</th>
                <th className="py-3 px-6" scope="col">Status</th>
                <th className="py-3 px-6" scope="col">P&amp;L Gain</th>
                <th className="py-3 px-6" scope="col">Date</th>
                <th className="py-3 px-6 text-right" scope="col">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-700">No IPO records found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      You haven&apos;t participated in any IPOs yet. Once you apply, your bids will appear here.
                    </p>
                    <Link
                      to="/user/ipos"
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all"
                    >
                      <span>Explore Open IPOs</span>
                      <span>→</span>
                    </Link>
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => {
                  const badgeStyle = SCRIP_BADGE_STYLES[item.colorIndex % SCRIP_BADGE_STYLES.length]
                  const targetDetailUrl = item.isDemo ? '/user/history' : `/user/ipos/${item.id}`
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* IPO: initials badge, original name, and code */}
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${badgeStyle}`}>
                            {item.initials}
                          </div>
                          <div>
                            <Link
                              to={targetDetailUrl}
                              className="font-bold text-midnight-950 leading-tight hover:text-indigo-600 transition-colors block"
                            >
                              {item.name}
                            </Link>
                            {item.code && item.code !== item.name && (
                              <span className="text-[11px] font-mono text-slate-400">{item.code}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Lots Applied: only lots (no 30 sh) */}
                      <td className="py-4 px-6 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {item.lots} Lot{item.lots > 1 ? 's' : ''}
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-6 font-mono text-xs text-slate-600 whitespace-nowrap">
                        ₹{formatINR(item.amount)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {item.status === 'SELECTED' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Selected
                          </span>
                        )}
                        {item.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Pending
                          </span>
                        )}
                        {item.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Rejected
                          </span>
                        )}
                        {item.status === 'APPLIED' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            Applied
                          </span>
                        )}
                      </td>

                      {/* P&L Gain */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {item.status === 'SELECTED' && (
                          <>
                            <span className="font-bold text-emerald-600 font-mono text-xs">{item.profitText}</span>
                            <p className="text-[10px] font-semibold text-emerald-700/80 font-mono">{item.profitSub}</p>
                          </>
                        )}
                        {item.status === 'PENDING' && (
                          <>
                            <span className="font-semibold text-amber-600 font-mono text-xs">{item.profitText}</span>
                            <p className="text-[10px] text-slate-400 font-medium">{item.profitSub}</p>
                          </>
                        )}
                        {item.status === 'REJECTED' && (
                          <>
                            <span className="font-medium text-slate-400 text-xs">{item.profitText}</span>
                            <p className="text-[10px] text-slate-400 font-mono">{item.profitSub}</p>
                          </>
                        )}
                        {item.status === 'APPLIED' && (
                          <>
                            <span className="font-bold text-emerald-600 font-mono text-xs">{item.profitText}</span>
                            <p className="text-[10px] text-emerald-700/80 font-medium">{item.profitSub}</p>
                          </>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-6 text-slate-500 font-normal whitespace-nowrap text-xs">
                        {item.date}
                      </td>

                      {/* Action: Only "View Details" without arrow */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <Link
                          to={targetDetailUrl}
                          className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination Notice */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              Showing {displayedItems.length} of {tableItems.length}
            </span>
            <span className="text-slate-400"></span>
            <span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs"
            >
              Previous
            </button>
            <span className="px-2 font-mono text-slate-700 font-bold">{currentPage}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs"
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {/* END: Recent Participations Table */}
    </div>
  )
}
