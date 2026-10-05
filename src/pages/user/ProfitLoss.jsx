import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getUserParticipatedIpos } from '../../services/ipoService'
import { formatCurrency, formatProfitLoss } from '../../utils/formatters'

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

// Compute full P&L summary from raw data — no RPC needed
function computeSummary(data) {
  let totalIpos = 0, allotted = 0, notAllotted = 0
  let totalProfit = 0, totalLoss = 0, totalRefund = 0, totalTax = 0, totalSettlement = 0

  for (const p of data) {
    const r = Array.isArray(p.ipo_results) ? p.ipo_results[0] : p.ipo_results
    if (!r) continue
    totalIpos++
    if (r.allotted)       allotted++
    else if (r.applied)   notAllotted++

    const profit     = Number(r.profit_amount ?? 0)
    const refund     = Number(r.refund_amount ?? 0)
    const tax        = Number(r.tax_amount ?? 0)
    const settlement = Number(r.final_settlement_amount ?? 0)

    if (profit > 0) totalProfit += profit
    if (profit < 0) totalLoss  += Math.abs(profit)
    totalRefund     += refund
    totalTax        += tax
    totalSettlement += settlement
  }

  return {
    total_ipos: totalIpos,
    total_allotted: allotted,
    total_not_allotted: notAllotted,
    total_profit: totalProfit,
    total_loss: totalLoss,
    net_profit: totalProfit - totalLoss,
    total_refund: totalRefund,
    total_tax: totalTax,
    total_settlement: totalSettlement,
  }
}

export default function ProfitLoss() {
  const { profile } = useAuth()
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    const load = async () => {
      try {
        const { data } = await getUserParticipatedIpos({ page: 1, pageSize: 100, userId: profile.id })
        // All participations that have results
        const withResults = data.filter(p => {
          const r = Array.isArray(p.ipo_results) ? p.ipo_results[0] : p.ipo_results
          return r != null
        })
        setHistory(withResults)
        setSummary(computeSummary(data))
      } catch (err) {
        console.error('ProfitLoss load error:', err)
        setSummary(null)
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

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="page-title">Profit &amp; Loss</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <SummaryCard label="Total IPOs"   value={summary?.total_ipos ?? 0}                       icon="📋" />
        <SummaryCard label="Allotted"     value={summary?.total_allotted ?? 0}                    icon="✅" color="text-green-700" />
        <SummaryCard label="Not Allotted" value={summary?.total_not_allotted ?? 0}                icon="❌" color="text-red-600" />
        <SummaryCard label="Total Profit" value={formatCurrency(summary?.total_profit ?? 0)}      icon="📈" color="text-green-600" />
        <SummaryCard label="Total Loss"   value={formatCurrency(summary?.total_loss ?? 0)}        icon="📉" color="text-red-600" />
        <SummaryCard label="Net Profit"   value={formatCurrency(summary?.net_profit ?? 0)}        icon="💰"
          color={(summary?.net_profit ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'} />
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

      {history.length > 0 ? (
        <div className="card">
          <div className="card-header"><h2 className="section-title">IPO-by-IPO Breakdown</h2></div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>IPO</th><th>Allotted</th><th>Refund</th><th>Profit / Loss</th><th>Tax</th><th>Settlement</th><th></th></tr>
              </thead>
              <tbody>
                {history.map(p => {
                  const ipo = p.ipos
                  const r   = Array.isArray(p.ipo_results) ? p.ipo_results[0] : p.ipo_results
                  if (!r) return null
                  const { formatted, colorClass } = formatProfitLoss(r.profit_amount)
                  return (
                    <tr key={p.id}>
                      <td>
                        <p className="font-medium">{ipo?.ipo_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{ipo?.ipo_code ?? ''}</p>
                      </td>
                      <td>
                        {r.allotted
                          ? <span className="text-green-600 font-semibold">Yes ({r.lots} lot{r.lots !== 1 ? 's' : ''})</span>
                          : <span className="text-red-500">No</span>}
                      </td>
                      <td>{formatCurrency(r.refund_amount)}</td>
                      <td><span className={colorClass}>{formatted}</span></td>
                      <td>{formatCurrency(r.tax_amount)}</td>
                      <td className="font-semibold text-blue-700">{formatCurrency(r.final_settlement_amount)}</td>
                      <td><Link to={`/user/ipos/${p.id}`} className="text-blue-600 text-xs hover:underline">View →</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
