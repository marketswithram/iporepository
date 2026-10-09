import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getUserProfitLossSummary, getUserIpoProfitDetail } from '../../services/ipoService'
import { formatCurrency } from '../../utils/formatters'

function SummaryCard({ label, value, icon, color = 'text-gray-900' }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

export default function ProfitLoss() {
  const { profile } = useAuth()
  const [summary,  setSummary]  = useState(null)
  const [ipoBreakdown, setIpoBreakdown] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryData, breakdown] = await Promise.all([
          getUserProfitLossSummary(profile?.id),
          getUserIpoProfitDetail(profile?.id),
        ])
        setSummary(summaryData)
        setIpoBreakdown(breakdown ?? [])
      } catch (err) {
        console.error('ProfitLoss load error:', err)
        setError('Failed to load profit data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile?.id])

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // Compute breakdown totals as a reference
  const breakdownNet = ipoBreakdown.reduce((s, r) => s + Number(r.total_profit ?? 0), 0)
  const breakdownProfit = ipoBreakdown.reduce((s, r) => s + (Number(r.total_profit ?? 0) > 0 ? Number(r.total_profit) : 0), 0)
  const breakdownLoss = ipoBreakdown.reduce((s, r) => s + (Number(r.total_profit ?? 0) < 0 ? Math.abs(Number(r.total_profit)) : 0), 0)

  // Use the verified table totals if breakdown is available
  const displayTotalProfit = ipoBreakdown.length > 0 ? breakdownProfit : Number(summary?.total_profit ?? 0)
  const displayTotalLoss = ipoBreakdown.length > 0 ? breakdownLoss : Number(summary?.total_loss ?? 0)
  const netProfit = ipoBreakdown.length > 0 ? breakdownNet : Number(summary?.net_profit ?? 0)
  // Distinct IPO counts
  const displayTotalIpos = summary?.total_ipos !== undefined
    ? Number(summary.total_ipos)
    : (ipoBreakdown.length > 0 ? ipoBreakdown.length : 0)

  const displayAllotted = summary?.total_allotted !== undefined
    ? Math.min(Number(summary.total_allotted), displayTotalIpos)
    : Math.min(ipoBreakdown.filter(r => Number(r.total_profit ?? 0) > 0).length, displayTotalIpos)

  const displayNotAllotted = summary?.total_not_allotted !== undefined
    ? Math.min(Number(summary.total_not_allotted), displayTotalIpos)
    : Math.max(0, displayTotalIpos - displayAllotted)

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="page-title">Profit &amp; Loss</h1>

      {error && <div className="alert-error"><span>⚠</span><span>{error}</span></div>}

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard label="Total IPOs"   value={displayTotalIpos}                icon="📋" />
        <SummaryCard label="Allotted"     value={displayAllotted}                 icon="✅" color="text-green-700" />
        <SummaryCard label="Not Allotted" value={displayNotAllotted}              icon="❌" color="text-red-600" />
        <SummaryCard label="Total Profit" value={formatCurrency(displayTotalProfit)} icon="📈" color="text-green-600" />
        <SummaryCard label="Total Loss"   value={formatCurrency(displayTotalLoss)}   icon="📉" color="text-red-600" />
        <SummaryCard label="Net Profit"   value={formatCurrency(netProfit)} icon="💰"
          color={netProfit >= 0 ? 'text-green-700' : 'text-red-700'} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-sm text-gray-500 mb-1">Total Refund</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(summary?.total_refund ?? 0)}</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-sm text-gray-500 mb-1">Total Tax Paid</p>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(summary?.total_tax ?? 0)}</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-sm text-gray-500 mb-1">Total Settlement</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(summary?.total_settlement ?? 0)}</p>
        </div>
      </div>

      {/* ── Per-IPO breakdown using user_ipo_profits (80/20 split applied) ── */}
      {ipoBreakdown.length > 0 ? (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="section-title">IPO-by-IPO Profit Breakdown</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Your share after profit distribution (100% if you invested with your own account · 80% as investor / 20% as account holder)
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>IPO</th>
                  <th className="text-right">As Investor (80–100%)</th>
                  <th className="text-right">As Acct. Holder (20%)</th>
                  <th className="text-right">Your Total Profit</th>
                </tr>
              </thead>
              <tbody>
                {ipoBreakdown.map(row => {
                  const total    = Number(row.total_profit ?? 0)
                  const investor = Number(row.investor_share ?? 0)
                  const holder   = Number(row.account_holder_share ?? 0)
                  return (
                    <tr key={row.ipo_id}>
                      <td>
                        <p className="font-medium">{row.ipo_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{row.ipo_code ?? ''}</p>
                      </td>
                      <td className="text-right">
                        {investor > 0
                          ? <span className="text-green-600 font-semibold">+{formatCurrency(investor)}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="text-right">
                        {holder > 0
                          ? <span className="text-indigo-600 font-semibold">+{formatCurrency(holder)}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="text-right">
                        <span className={`font-bold text-base ${total >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {total >= 0 ? '+' : ''}{formatCurrency(total)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr>
                  <td className="font-semibold text-gray-700">Total</td>
                  <td className="text-right font-semibold text-green-600">
                    +{formatCurrency(ipoBreakdown.reduce((s, r) => s + Number(r.investor_share ?? 0), 0))}
                  </td>
                  <td className="text-right font-semibold text-indigo-600">
                    +{formatCurrency(ipoBreakdown.reduce((s, r) => s + Number(r.account_holder_share ?? 0), 0))}
                  </td>
                  <td className="text-right font-bold text-green-700">
                    +{formatCurrency(ipoBreakdown.reduce((s, r) => s + Number(r.total_profit ?? 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Profit distribution legend */}
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex flex-wrap gap-4 text-xs text-gray-500">
            <span>📊 <strong>As Investor:</strong> Your share when you are the actual investor (80% or 100%)</span>
            <span>🏦 <strong>As Acct. Holder:</strong> Your share when another person invested using your account (20%)</span>
          </div>
        </div>
      ) : (
        <div className="card py-16 text-center">
          <p className="text-4xl mb-4">💰</p>
          <p className="font-semibold text-gray-700">No completed results yet</p>
          <p className="text-gray-400 text-sm mt-1">Results will appear once the admin submits IPO result data.</p>
        </div>
      )}
    </div>
  )
}
