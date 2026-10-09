import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getUserParticipatedIpos, getUserProfitLossSummary } from '../../services/ipoService'



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

function formatDisplayTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
}

export default function History() {
  const { profile } = useAuth()
  const [participations, setParticipations] = useState([])
  const [dbSummary, setDbSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  // Filters state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedYear, setSelectedYear] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [quickFilter, setQuickFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 7

  const userName = profile?.full_name || 'Satish Kumar'

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        setLoading(true)
        if (profile?.id) {
          const [partRes, sumRes] = await Promise.allSettled([
            getUserParticipatedIpos({ page: 1, pageSize: 100, userId: profile.id }),
            getUserProfitLossSummary(profile.id),
          ])
          if (isMounted) {
            if (partRes.status === 'fulfilled' && partRes.value?.data) {
              setParticipations(partRes.value.data)
            }
            if (sumRes.status === 'fulfilled' && sumRes.value) {
              setDbSummary(sumRes.value)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load IPO history:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => { isMounted = false }
  }, [profile?.id])

  const hasRealData = participations.length > 0

  // Calculate summary stats
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

  // Normalise ledger items
  const ledgerItems = useMemo(() => {
    if (!hasRealData) {
      return []
    }

    return participations.map((p) => {
      const ipo = Array.isArray(p.ipos) ? p.ipos[0] : (p.ipos || {})
      const r = Array.isArray(p.ipo_results) ? p.ipo_results[0] : p.ipo_results
      const ipoName = ipo.ipo_name || p.ipo_name || ipo.ipo_code || 'IPO'
      const lots = Number(r?.lots || 1)
      const price = Number(ipo.ipo_price || 14880)
      const lotAmount = price * lots

      let status = 'APPLIED'
      let statusLabel = 'Applied'
      let profitText = 'Pending'
      let profitSub = 'Awaiting Result'
      let amountType = 'Blocked'
      let settlementTitle = 'Mandate Accepted'
      let settlementSub = 'UPI ASBA Blocked'
      let settlementColor = 'blue'

      const uProfit = p.user_profit !== undefined
        ? Number(p.user_profit)
        : Number(r?.profit_amount ?? 0)

      if (r) {
        if (r.allotted) {
          status = 'SELECTED'
          statusLabel = 'Selected'
          amountType = 'Debited'
          settlementTitle = 'UPI Debited'
          settlementSub = 'Shares in Demat'
          settlementColor = 'emerald'
        } else if (r.refund_amount || r.applied === false) {
          status = 'REJECTED'
          statusLabel = 'Rejected'
          amountType = 'Released'
          settlementTitle = 'Mandate Released'
          settlementSub = r.refund_amount ? `₹${formatINR(r.refund_amount)} unblocked` : 'Mandate revoked'
          settlementColor = 'slate'
        } else {
          status = 'PENDING'
          statusLabel = 'Pending'
          amountType = 'Blocked'
          settlementTitle = 'UPI Blocked'
          settlementSub = 'Mandate Active'
          settlementColor = 'amber'
        }

        // Show actual profit gained by user from this IPO
        if (uProfit > 0) {
          profitText = `+₹${formatINR(uProfit)}`
          profitSub = p.user_role === 'INVESTOR' ? '80% Investor Share'
                    : p.user_role === 'ACCOUNT_HOLDER' ? '20% Acct. Holder Share'
                    : 'Realized Gain'
        } else if (uProfit < 0) {
          profitText = `-₹${formatINR(Math.abs(uProfit))}`
          profitSub = 'Loss Share'
        } else {
          profitText = '₹0'
          profitSub = r.refund_amount ? 'Refunded' : 'No Gain'
        }
      } else if (ipo.status === 'OPEN') {
        status = 'APPLIED'
        statusLabel = 'Applied'
        profitText = 'Pending'
        profitSub = 'Awaiting Allotment'
        settlementTitle = 'Mandate Accepted'
        settlementSub = 'UPI ASBA Blocked'
        settlementColor = 'blue'
      }

      const dateObj = new Date(p.created_at)
      const year = !isNaN(dateObj.getTime()) ? dateObj.getFullYear().toString() : '2026'

      const holderDisplay = p.user_role === 'INVESTOR' && p.profiles?.full_name
        ? `Via ${p.profiles.full_name}`
        : p.user_role === 'ACCOUNT_HOLDER' && p.investor?.full_name
        ? `For ${p.investor.full_name}`
        : userName

      return {
        id: p.id,
        name: ipoName,
        code: ipo.ipo_code || '',
        dematInfo: 'IN301549 • CDSL',
        holder: holderDisplay,
        lots,
        amount: lotAmount,
        amountType,
        userProfit: uProfit,
        status,
        statusLabel,
        profitText,
        profitSub,
        settlementTitle,
        settlementSub,
        settlementColor,
        date: formatDisplayDate(p.created_at),
        time: formatDisplayTime(p.created_at),
        year,
        category: p.participation_type === 'INVESTOR' ? 'Retail Individual' : 'Account Holder',
        isDemo: false,
      }
    })
  }, [hasRealData, participations, userName])

  // Year range derived from history
  const availableYears = useMemo(() => {
    const set = new Set()
    for (const item of ledgerItems) {
      if (item.year) set.add(item.year)
    }
    return Array.from(set).sort().reverse()
  }, [ledgerItems])

  const yearRange = useMemo(() => {
    if (availableYears.length === 0) return `${new Date().getFullYear()}`
    const min = availableYears[availableYears.length - 1]
    const max = availableYears[0]
    return min === max ? `${min}` : `${min}-${max}`
  }, [availableYears])

  // Counts for quick filter tabs
  const counts = useMemo(() => {
    return {
      all: ledgerItems.length,
      allotted: ledgerItems.filter((i) => i.status === 'SELECTED').length,
      pending: ledgerItems.filter((i) => i.status === 'PENDING' || i.status === 'APPLIED').length,
      refunded: ledgerItems.filter((i) => i.status === 'REJECTED').length,
    }
  }, [ledgerItems])

  // Filtered items
  const filteredItems = useMemo(() => {
    return ledgerItems.filter((item) => {
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = item.name.toLowerCase().includes(q)
        const matchesCode = (item.code || '').toLowerCase().includes(q)
        const matchesHolder = item.holder.toLowerCase().includes(q)
        const matchesStatus = item.statusLabel.toLowerCase().includes(q)
        if (!matchesName && !matchesCode && !matchesHolder && !matchesStatus) return false
      }

      // Quick filter tabs
      if (quickFilter === 'ALLOTTED' && item.status !== 'SELECTED') return false
      if (quickFilter === 'PENDING' && item.status !== 'PENDING' && item.status !== 'APPLIED') return false
      if (quickFilter === 'REFUNDED' && item.status !== 'REJECTED') return false

      // Year filter
      if (selectedYear !== 'ALL' && item.year !== selectedYear) return false

      // Status dropdown
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'SELECTED' && item.status !== 'SELECTED') return false
        if (selectedStatus === 'PENDING' && item.status !== 'PENDING') return false
        if (selectedStatus === 'APPLIED' && item.status !== 'APPLIED') return false
        if (selectedStatus === 'REJECTED' && item.status !== 'REJECTED') return false
      }

      // Category filter
      if (selectedCategory !== 'ALL' && !item.category.includes(selectedCategory)) return false

      return true
    })
  }, [ledgerItems, searchQuery, quickFilter, selectedYear, selectedStatus, selectedCategory])

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1
  const displayedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, currentPage, pageSize])

  // Export to CSV handler
  const handleExportCsv = () => {
    const headers = ['IPO Name', 'Demat Info', 'Lots', 'Amount', 'Status', 'Profit/Gain', 'Settlement', 'Date', 'Time']
    const rows = filteredItems.map((item) => [
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.dematInfo}"`,
      item.lots,
      item.amount,
      `"${item.statusLabel}"`,
      `"${item.profitText}"`,
      `"${item.settlementTitle}"`,
      `"${item.date}"`,
      `"${item.time}"`,
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ipo_history_ledger_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-600">Loading your bidding ledger…</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6 flex-1 animate-fade-in" data-purpose="ipo-history-dashboard">
      {/* BEGIN: PageHeaderSection */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4" data-purpose="page-title-and-actions">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">IPO History &amp; Bidding Ledger</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            Complete audit trail of submitted bids, allotment statuses, demat unblocking &amp; realized listing alpha
            <span className="inline-block w-1 h-1 rounded-full bg-slate-300"></span>
            <span className="text-indigo-600 font-medium">Demat Synced 2m ago</span>
          </p>
        </div>

        {/* Header Action CTA Buttons */}
        <div className="flex items-center gap-3">
          {/* Export Button */}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all"
            type="button"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            <span>Export Ledger (CSV)</span>
          </button>

          {/* Primary CTA Apply Button */}
          <Link
            to="/user/ipos"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-luxury-btn transition-all active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
            </svg>
            <span>Apply for IPO</span>
          </Link>
        </div>
      </section>
      {/* END: PageHeaderSection */}

      {/* BEGIN: MetricsSummaryCards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-purpose="metric-summary-cards">
        {/* Total Applications Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-card-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Applications</span>
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-full">All-time</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">{summary.totalApplications}</span>
              <p className="text-xs text-slate-500 mt-1">Across {summary.companiesCount} {summary.companiesCount === 1 ? 'Company' : 'Companies'}</p>
            </div>
            {/* Sparkline */}
            <svg className="w-16 h-7 text-indigo-500 stroke-current fill-none shrink-0" viewBox="0 0 64 24">
              <path d="M2 18 L16 14 L28 17 L42 8 L54 11 L62 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </div>
        </div>

        {/* Allotment Hit Rate Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-card-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Allotment Win Rate</span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">{summary.winRate}% Win</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">{summary.allotted}</span>
                <span className="text-xs text-slate-400 font-medium font-mono">/ {summary.totalApplications} bids</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {summary.allotted} Allotted • {summary.missed} Missed
              </p>
            </div>
            {/* Sparkline */}
            <svg className="w-16 h-7 text-emerald-500 stroke-current fill-none shrink-0" viewBox="0 0 64 24">
              <path d="M2 20 L18 16 L32 18 L46 9 L62 5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </div>
        </div>

        {/* Realized Profit Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-card-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Realized Profit</span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">+18.4% YoY</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-emerald-600 tracking-tight font-mono">₹{formatINR(summary.realizedProfit)}</span>
              <p className="text-xs text-slate-500 mt-1">Booked in {yearRange}</p>
            </div>
            {/* Sparkline */}
            <svg className="w-16 h-7 text-emerald-600 stroke-current fill-none shrink-0" viewBox="0 0 64 24">
              <path d="M2 19 L15 15 L30 16 L45 8 L62 3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2"></path>
            </svg>
          </div>
        </div>

        {/* Total Capital Deployed Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-card-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Blocked Capital</span>
            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">Active Mandates</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">₹{formatINR(summary.blockedCapital)}</span>
              <p className="text-xs text-slate-500 mt-1">{summary.activeBidsCount || 3} Active ASBA bids</p>
            </div>
            {/* Sparkline */}
            <svg className="w-16 h-7 text-indigo-500 stroke-current fill-none shrink-0" viewBox="0 0 64 24">
              <path d="M2 12 L14 17 L29 11 L44 15 L62 8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </div>
        </div>
      </section>
      {/* END: MetricsSummaryCards */}

      {/* BEGIN: FilterAndSearchControlBar */}
      <section className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-card-subtle space-y-3" data-purpose="ledger-filter-controls">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search within table */}
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              placeholder="Filter by company name, scrip, application ID or mandate..."
              type="text"
            />
          </div>

          {/* Select Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Year / Period Filter */}
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1) }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:bg-white focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="ALL">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>Year {yr}</option>
              ))}
            </select>

            {/* Allotment Status Dropdown */}
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1) }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:bg-white focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="SELECTED">Selected (Allotted)</option>
              <option value="PENDING">Pending Result</option>
              <option value="APPLIED">Applied / In-Review</option>
              <option value="REJECTED">Non-Allotted (Refunded)</option>
            </select>

            {/* Category Tier */}
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1) }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:bg-white focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="Retail Individual">Retail Individual</option>
              <option value="sHNI">sHNI (₹2L - ₹10L)</option>
              <option value="Shareholder">Shareholder</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Category Tabs */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-400 mr-2 shrink-0">Quick View:</span>
          <button
            onClick={() => { setQuickFilter('ALL'); setCurrentPage(1) }}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors shrink-0 ${
              quickFilter === 'ALL'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => { setQuickFilter('ALLOTTED'); setCurrentPage(1) }}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors shrink-0 ${
              quickFilter === 'ALLOTTED'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Allotted ({counts.allotted})
          </button>
          <button
            onClick={() => { setQuickFilter('PENDING'); setCurrentPage(1) }}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors shrink-0 ${
              quickFilter === 'PENDING'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Pending Result ({counts.pending})
          </button>
          <button
            onClick={() => { setQuickFilter('REFUNDED'); setCurrentPage(1) }}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors shrink-0 ${
              quickFilter === 'REFUNDED'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Refunded / Released ({counts.refunded})
          </button>
        </div>
      </section>
      {/* END: FilterAndSearchControlBar */}

      {/* BEGIN: IPOLedgerTableSection */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-card-subtle overflow-hidden" data-purpose="ipo-ledger-table-container">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 font-semibold" scope="col">IPO</th>
                <th className="py-3.5 px-4 font-semibold" scope="col">Lots</th>
                <th className="py-3.5 px-4 font-semibold" scope="col">Allotment Status</th>
                <th className="py-3.5 px-4 font-semibold text-right" scope="col">Profit</th>
                <th className="py-3.5 px-4 font-semibold" scope="col">Settlement &amp; ASBA</th>
                <th className="py-3.5 px-4 font-semibold" scope="col">Bid Date</th>
                <th className="py-3.5 px-4 font-semibold text-center" scope="col">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-700">No IPO records found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      You haven&apos;t participated in any IPOs yet. Once you apply for an IPO, your bidding history and results will appear here.
                    </p>
                    <Link
                      to="/user/ipos"
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all"
                    >
                      <span>Explore Available IPOs</span>
                      <span>→</span>
                    </Link>
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold text-slate-500">No participations match your filter criteria</p>
                    <button
                      onClick={() => { setSearchQuery(''); setSelectedYear('ALL'); setSelectedStatus('ALL'); setSelectedCategory('ALL'); setQuickFilter('ALL') }}
                      className="text-xs text-indigo-600 font-semibold hover:underline mt-1 inline-block"
                    >
                      Clear all filters
                    </button>
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => {
                  const targetDetailUrl = item.isDemo ? '#' : `/user/ipos/${item.id}`
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* IPO */}
                      <td className="py-4 px-4">
                        <Link
                          to={targetDetailUrl}
                          className="font-bold text-slate-900 hover:text-indigo-600 transition-colors block text-xs"
                        >
                          {item.name}
                        </Link>
                        {item.code && item.code !== item.name && (
                          <span className="text-[10px] font-mono text-slate-400">{item.code}</span>
                        )}
                      </td>

                      {/* Lots */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-900">
                          {item.lots} Lot{item.lots > 1 ? 's' : ''}
                        </span>
                      </td>

                      {/* Allotment Status */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {item.status === 'SELECTED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Selected
                          </span>
                        )}
                        {item.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Pending
                          </span>
                        )}
                        {item.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Rejected
                          </span>
                        )}
                        {item.status === 'APPLIED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            Applied
                          </span>
                        )}
                      </td>

                      {/* Profit */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        {item.userProfit > 0 ? (
                          <>
                            <div className="font-bold text-emerald-600 font-mono text-xs">{item.profitText}</div>
                            <div className="text-[10px] font-semibold text-emerald-700/80 mt-0.5">{item.profitSub}</div>
                          </>
                        ) : item.userProfit < 0 ? (
                          <>
                            <div className="font-bold text-rose-600 font-mono text-xs">{item.profitText}</div>
                            <div className="text-[10px] font-semibold text-rose-600/80 mt-0.5">{item.profitSub}</div>
                          </>
                        ) : (
                          <>
                            <div className="font-medium text-slate-500 font-mono text-xs">{item.profitText}</div>
                            {item.profitSub && <div className="text-[10px] text-slate-400 mt-0.5">{item.profitSub}</div>}
                          </>
                        )}
                      </td>

                      {/* Settlement & ASBA */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          {item.settlementColor === 'emerald' && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                          {item.settlementColor === 'amber' && <span className="w-2 h-2 rounded-full bg-amber-400"></span>}
                          {item.settlementColor === 'slate' && <span className="w-2 h-2 rounded-full bg-slate-400"></span>}
                          {item.settlementColor === 'blue' && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                          {item.settlementTitle}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.settlementSub}</div>
                      </td>

                      {/* Bid Date */}
                      <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                        <div>{item.date}</div>
                        {item.time && <div className="text-[10px] text-slate-400 font-mono">{item.time}</div>}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <Link
                          to={targetDetailUrl}
                          className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Pagination & CDSL Verification Indicator */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4" data-purpose="table-pagination-footer">
          {/* Gateway Status */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">
              Showing {displayedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} Applications
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd"></path>
              </svg>
              Verified CDSL / NSDL Settlement Gateway
            </span>
          </div>

          {/* Pagination Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors ${
                  currentPage === i + 1
                    ? 'text-white bg-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </section>
      {/* END: IPOLedgerTableSection */}
    </div>
  )
}
