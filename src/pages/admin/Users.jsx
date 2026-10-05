import { useEffect, useState } from 'react'
import { getAdminUsers, toggleUserActive } from '../../services/ipoService'
import { formatDateTime } from '../../utils/formatters'

export default function AdminUsers() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const [toggling, setToggling] = useState(null)
  const PAGE_SIZE = 20

  const load = () => {
    setLoading(true)
    getAdminUsers({ page, pageSize: PAGE_SIZE, search })
      .then(({ data, count }) => { setUsers(data); setTotal(count) })
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, search])

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1) }

  const handleToggle = async (userId, currentActive) => {
    setToggling(userId)
    try {
      const updated = await toggleUserActive(userId, !currentActive)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: updated.is_active } : u))
    } catch {
      setError('Failed to update user status.')
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="text-gray-500 text-sm mt-1">{total} registered members</p>
        </div>
        <input type="text" value={search} onChange={handleSearch} placeholder="Search by name, username, email…"
          className="input max-w-xs" />
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
          <p className="text-3xl mb-3">👥</p>
          <p>No users found</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Username</th><th>Full Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Action</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="font-medium">@{u.username}</td>
                    <td>{u.full_name}</td>
                    <td className="text-gray-500 text-xs">{u.email}</td>
                    <td>
                      <span className={u.role === 'admin' ? 'badge badge-purple' : 'badge badge-blue'}>{u.role}</span>
                    </td>
                    <td>
                      <span className={u.is_active ? 'badge badge-green' : 'badge badge-red'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-xs text-gray-400">{formatDateTime(u.created_at)}</td>
                    <td>
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => handleToggle(u.id, u.is_active)}
                          disabled={toggling === u.id}
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                        >
                          {toggling === u.id ? <span className="spinner" /> : u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary btn-sm">← Prev</button>
              <span className="px-3 py-1.5 text-sm text-gray-600">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * PAGE_SIZE >= total} className="btn btn-secondary btn-sm">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
