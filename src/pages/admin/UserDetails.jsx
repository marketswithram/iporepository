import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAdminUserDetail, toggleUserActive, adminSetUserApproval } from '../../services/ipoService'
import { formatCurrency, formatDateTime } from '../../utils/formatters'

function StatCard({ label, value, icon, color = 'text-gray-900', sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div>
        <p className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default function UserDetails() {
  const { userId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const res = await getAdminUserDetail(userId)
      setData(res)
    } catch (err) {
      console.error('Failed to load user details:', err)
      setError('Failed to load user profile & participation data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [userId])

  const handleApproval = async (status) => {
    setActionLoading(true)
    setError('')
    setActionMsg('')
    try {
      await adminSetUserApproval(userId, status)
      setActionMsg(`User status updated to ${status}`)
      await load()
    } catch (err) {
      console.error('Approval error:', err)
      setError(err?.message || 'Failed to update approval status.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleActive = async () => {
    if (!data?.profile) return
    setActionLoading(true)
    setError('')
    try {
      const nextActive = !data.profile.is_active
      await toggleUserActive(userId, nextActive)
      setActionMsg(`User ${nextActive ? 'activated' : 'deactivated'} successfully`)
      await load()
    } catch (err) {
      console.error('Toggle error:', err)
      setError('Failed to update active state.')
    } finally {
      setActionLoading(false)
    }
  }

  // Derive metrics
  const profile = data?.profile
  const summary = data?.summary
  const participations = data?.participations ?? []
  const profitDetail = data?.profitDetail ?? []

  // Distinct IPOs and stats
  const distinctIposCount = summary?.total_ipos ?? profitDetail.length
  const allottedCount = summary?.total_allotted ?? participations.filter(p => {
    const r = Array.isArray(p.ipo_results) ? p.ipo_results[0] : p.ipo_results
    return r?.allotted === true
  }).length
  const notAllottedCount = Math.max(0, distinctIposCount - allottedCount)
  const winRate = distinctIposCount > 0 ? ((allottedCount / distinctIposCount) * 100).toFixed(1) : '0.0'
  const netProfit = Number(summary?.net_profit ?? 0)

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="card p-12 text-center text-slate-500">
        <p className="text-4xl mb-3">👤</p>
        <p className="font-bold text-lg text-slate-800">User Not Found</p>
        <p className="text-xs text-slate-400 mt-1">This user could not be located in the database.</p>
        <Link to="/admin/users" className="btn btn-secondary mt-5">← Back to Users</Link>
      </div>
    )
  }

  const isApproved = profile.is_approved === true
  const approvalStatus = profile.approval_status || (isApproved ? 'APPROVED' : 'PENDING')

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Top Bar & Navigation ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm transition-all"
            >
              ← All Users
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">{profile.full_name}</h1>
            <span className="text-xs font-mono font-medium text-slate-400">@{profile.username}</span>
          </div>
          <p className="text-xs text-slate-500">
            Registered on {formatDateTime(profile.created_at)} • Email: <span className="font-mono text-slate-700">{profile.email}</span>
          </p>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex items-center flex-wrap gap-2.5">
          {approvalStatus === 'PENDING' && (
            <>
              <button
                onClick={() => handleApproval('APPROVED')}
                disabled={actionLoading}
                className="btn btn-success btn-sm flex items-center gap-1.5 shadow-sm"
              >
                ✓ Approve User
              </button>
              <button
                onClick={() => handleApproval('REJECTED')}
                disabled={actionLoading}
                className="btn btn-danger btn-sm flex items-center gap-1.5"
              >
                ✕ Reject
              </button>
            </>
          )}

          {approvalStatus === 'APPROVED' && (
            <button
              onClick={() => handleApproval('REJECTED')}
              disabled={actionLoading}
              className="btn btn-secondary btn-sm text-rose-600 hover:bg-rose-50"
            >
              Revoke Approval
            </button>
          )}

          {approvalStatus === 'REJECTED' && (
            <button
              onClick={() => handleApproval('APPROVED')}
              disabled={actionLoading}
              className="btn btn-success btn-sm"
            >
              ✓ Re-Approve User
            </button>
          )}

          {profile.role !== 'admin' && (
            <button
              onClick={handleToggleActive}
              disabled={actionLoading}
              className={`btn btn-sm ${profile.is_active ? 'btn-danger' : 'btn-success'}`}
            >
              {profile.is_active ? 'Deactivate' : 'Activate'}
            </button>
          )}
        </div>
      </div>

      {/* ── Status Alerts ── */}
      {error && <div className="alert-error"><span>⚠</span><span>{error}</span></div>}
      {actionMsg && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-semibold">✓ {actionMsg}</div>}

      {/* ── User Overview Badges Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-bold text-2xl shadow-md">
            {profile.full_name?.slice(0, 2).toUpperCase() || 'US'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{profile.full_name}</h2>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                profile.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
              }`}>
                {profile.role}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">User ID: {profile.id}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 min-w-[120px]">
            <p className="text-[10px] uppercase font-bold text-slate-400">Account Access</p>
            <p className={`text-sm font-bold ${profile.is_active ? 'text-emerald-600' : 'text-rose-600'}`}>
              {profile.is_active ? '● Active' : '○ Inactive'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 min-w-[140px]">
            <p className="text-[10px] uppercase font-bold text-slate-400">Approval Status</p>
            <span className={`inline-block mt-0.5 text-xs font-bold px-2 py-0.5 rounded-md ${
              approvalStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
              approvalStatus === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
              'bg-amber-100 text-amber-800 animate-pulse'
            }`}>
              {approvalStatus}
            </span>
          </div>

          {profile.approved_at && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 min-w-[130px]">
              <p className="text-[10px] uppercase font-bold text-slate-400">Approved Date</p>
              <p className="text-xs font-medium text-slate-700 mt-0.5">
                {new Date(profile.approved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Performance & Summary Stat Cards ── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total IPOs"
          value={distinctIposCount}
          icon="📋"
          sub="Distinct IPO applications"
        />
        <StatCard
          label="Allotted"
          value={allottedCount}
          icon="✅"
          color="text-emerald-600"
          sub={`${winRate}% Allotment Rate`}
        />
        <StatCard
          label="Not Allotted"
          value={notAllottedCount}
          icon="❌"
          color="text-rose-600"
          sub="Refunded applications"
        />
        <StatCard
          label="Net Realized Profit"
          value={`${netProfit >= 0 ? '+' : ''}${formatCurrency(netProfit)}`}
          icon="💰"
          color={netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}
          sub="Total user earnings"
        />
        <StatCard
          label="Total Settlement"
          value={formatCurrency(summary?.total_settlement ?? 0)}
          icon="🏦"
          color="text-indigo-600"
          sub="Capital + gains returned"
        />
      </section>

      {/* ── Participated IPOs Table (Matches /user/dashboard) ── */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">IPO Participations &amp; Profit History</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete log of bids, allotment results, and individual profit shares for {profile.full_name}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {participations.length} {participations.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/70 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">IPO</th>
                <th className="py-3.5 px-6">Participation Role</th>
                <th className="py-3.5 px-6">Lots</th>
                <th className="py-3.5 px-6">Amount Contributed</th>
                <th className="py-3.5 px-6">Allotment Status</th>
                <th className="py-3.5 px-6 text-right">User Profit</th>
                <th className="py-3.5 px-6">Date</th>
                <th className="py-3.5 px-6 text-right">IPO Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participations.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-slate-400">
                    <p className="text-2xl mb-2">📋</p>
                    <p className="font-semibold text-slate-600">No IPO Participations Recorded</p>
                    <p className="text-xs text-slate-400 mt-0.5">This user has not submitted bids for any IPOs yet.</p>
                  </td>
                </tr>
              ) : (
                participations.map((p) => {
                  const ipo = Array.isArray(p.ipos) ? p.ipos[0] : (p.ipos || {})
                  const r = Array.isArray(p.ipo_results) ? p.ipo_results[0] : p.ipo_results
                  const ipoName = ipo.ipo_name || p.ipo_name || 'IPO'
                  const lots = Number(r?.lots || 1)
                  const contributed = Number(p.amount_contributed || (ipo.ipo_price ? ipo.ipo_price * lots : 0))

                  const uProfit = p.user_profit !== undefined
                    ? Number(p.user_profit)
                    : Number(r?.profit_amount ?? 0)

                  const isInvestor = p.investor_user_id === userId
                  const isHolder = p.user_id === userId
                  const roleLabel = isInvestor && isHolder ? 'Direct Investor (100%)'
                    : isInvestor ? 'Investor (80%)'
                    : isHolder ? 'Account Holder (20%)'
                    : p.participation_type

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* IPO */}
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div>
                          <p className="font-bold text-slate-900">{ipoName}</p>
                          {ipo.ipo_code && <p className="text-[10px] font-mono text-slate-400">{ipo.ipo_code}</p>}
                        </div>
                      </td>

                      {/* Participation Role */}
                      <td className="py-4 px-6">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          {roleLabel}
                        </span>
                      </td>

                      {/* Lots */}
                      <td className="py-4 px-6 font-mono font-medium text-slate-800">
                        {lots} Lot{lots > 1 ? 's' : ''}
                      </td>

                      {/* Amount Contributed */}
                      <td className="py-4 px-6 font-mono text-slate-700">
                        {contributed > 0 ? formatCurrency(contributed) : '—'}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 whitespace-nowrap">
                        {r?.allotted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Allotted
                          </span>
                        ) : r?.applied === false || r?.refund_amount ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Not Allotted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Pending
                          </span>
                        )}
                      </td>

                      {/* User Profit */}
                      <td className="py-4 px-6 text-right font-mono font-bold whitespace-nowrap">
                        {uProfit > 0 ? (
                          <span className="text-emerald-600 font-bold">+{formatCurrency(uProfit)}</span>
                        ) : uProfit < 0 ? (
                          <span className="text-rose-600 font-bold">-{formatCurrency(Math.abs(uProfit))}</span>
                        ) : (
                          <span className="text-slate-400 font-normal">₹0</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-6 text-slate-500 whitespace-nowrap text-xs">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>

                      {/* Manage IPO */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <Link
                          to={`/admin/ipos/${p.ipo_id || ipo.id}`}
                          className="inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          Manage IPO →
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Profit Distribution Breakdown (From user_ipo_profits) ── */}
      {profitDetail.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Per-IPO Profit Distribution Breakdown</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified 80/20 ledger splits recorded in <code className="font-mono text-indigo-600">user_ipo_profits</code> table
            </p>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">IPO Name</th>
                  <th className="py-3 px-4 text-right">As Investor (80–100%)</th>
                  <th className="py-3 px-4 text-right">As Account Holder (20%)</th>
                  <th className="py-3 px-4 text-right">Net Gained</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profitDetail.map((row) => (
                  <tr key={row.ipo_id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {row.ipo_name} <span className="text-slate-400 font-mono text-[10px]">({row.ipo_code})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">
                      {row.investor_share > 0 ? `+${formatCurrency(row.investor_share)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-indigo-600 font-semibold">
                      {row.account_holder_share > 0 ? `+${formatCurrency(row.account_holder_share)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {row.total_profit >= 0 ? `+${formatCurrency(row.total_profit)}` : formatCurrency(row.total_profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
