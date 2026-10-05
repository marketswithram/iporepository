import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminDashboardStats, getRecentIpos } from '../../services/ipoService'
import { formatCurrency, formatDate, getIpoStatusBadgeClass, getIpoStatusLabel } from '../../utils/formatters'

function StatCard({ label, value, icon, color = 'text-gray-900', sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null)
  const [recent,  setRecent]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    Promise.all([getAdminDashboardStats(), getRecentIpos(8)])
      .then(([s, r]) => { setStats(s); setRecent(r) })
      .catch(() => setError('Failed to load dashboard stats.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Group IPO performance overview</p>
        </div>
        <Link to="/admin/ipos/create" className="btn bg-indigo-600 text-white hover:bg-indigo-700">+ Create IPO</Link>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Users"         value={stats?.total_users ?? 0}                       icon="👥" />
        <StatCard label="Active IPOs"         value={stats?.active_ipos ?? 0}                       icon="📋" color="text-green-700" />
        <StatCard label="Completed IPOs"      value={stats?.completed_ipos ?? 0}                    icon="✅" color="text-purple-700" />
        <StatCard label="Total Participations" value={stats?.total_participations ?? 0}             icon="📊" />
        <StatCard label="Total Group Profit"  value={formatCurrency(stats?.total_group_profit ?? 0)} icon="💰" color="text-green-700" sub="From all completed IPOs" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { to: '/admin/ipos/create', label: 'Create IPO',   icon: '➕', desc: 'Open a new IPO for participation' },
          { to: '/admin/ipos',        label: 'Manage IPOs',  icon: '📋', desc: 'View and manage all IPOs' },
          { to: '/admin/reports',     label: 'Reports',      icon: '📈', desc: 'View group analytics' },
        ].map(item => (
          <Link key={item.to} to={item.to}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4 hover:shadow-md hover:border-indigo-200 transition-all duration-200 group">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="section-title">Recent IPOs</h2>
          <Link to="/admin/ipos" className="text-indigo-600 text-sm font-medium hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          {recent.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-3xl mb-3">📋</p>
              <p>No IPOs created yet</p>
              <Link to="/admin/ipos/create" className="text-indigo-600 text-sm hover:underline mt-1 inline-block">Create your first IPO →</Link>
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>IPO</th><th>Status</th><th>Overall Profit</th><th>Created</th><th></th></tr></thead>
              <tbody>
                {recent.map(ipo => (
                  <tr key={ipo.id}>
                    <td><p className="font-medium">{ipo.ipo_name}</p><p className="text-xs text-gray-400">{ipo.ipo_code}</p></td>
                    <td><span className={getIpoStatusBadgeClass(ipo.status)}>{getIpoStatusLabel(ipo.status)}</span></td>
                    <td>{ipo.overall_profit != null ? <span className="text-green-700 font-semibold">{formatCurrency(ipo.overall_profit)}</span> : <span className="text-gray-400 text-xs">—</span>}</td>
                    <td className="text-xs text-gray-400">{formatDate(ipo.created_at)}</td>
                    <td><Link to={`/admin/ipos/${ipo.id}`} className="text-indigo-600 text-xs font-medium hover:underline">Manage →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
