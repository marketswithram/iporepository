import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAdminUsers, toggleUserActive, adminSetUserApproval } from '../../services/ipoService'
import { formatDateTime, getInitials } from '../../utils/formatters'

export default function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL') // ALL, PENDING, APPROVED, INACTIVE
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState(null)
  const PAGE_SIZE = 20

  const load = () => {
    setLoading(true)
    setError('')
    const approvalParam = statusFilter === 'PENDING' ? 'PENDING' : statusFilter === 'APPROVED' ? 'APPROVED' : null
    getAdminUsers({ page, pageSize: PAGE_SIZE, search, approvalStatus: approvalParam })
      .then(({ data, count }) => {
        let list = data
        if (statusFilter === 'INACTIVE') {
          list = list.filter(u => !u.is_active)
        }
        setUsers(list)
        setTotal(count)
      })
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [page, search, statusFilter])

  const pendingCount = useMemo(() => {
    return users.filter(u => u.is_approved === false || u.approval_status === 'PENDING').length
  }, [users])

  const handleSearch = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleToggle = async (userId, currentActive, e) => {
    e.stopPropagation()
    setActionLoading(`toggle-${userId}`)
    try {
      const updated = await toggleUserActive(userId, !currentActive)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: updated.is_active } : u))
      setSuccess(`User ${updated.is_active ? 'activated' : 'deactivated'} successfully.`)
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('Failed to update user status.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproval = async (userId, newStatus, e) => {
    e.stopPropagation()
    setActionLoading(`approval-${userId}`)
    try {
      await adminSetUserApproval(userId, newStatus)
      setUsers(prev => prev.map(u => u.id === userId ? {
        ...u,
        is_approved: newStatus === 'APPROVED',
        approval_status: newStatus,
        approved_at: newStatus === 'APPROVED' ? new Date().toISOString() : null,
      } : u))
      setSuccess(`User has been marked as ${newStatus.toLowerCase()}.`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err?.message || 'Failed to update user approval status.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Title and Create User CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">User Management</h1>
            <span className="badge badge-blue">{total} Users</span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Manage registrations, verify pending approvals, review user IPO records, and create accounts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/users/create"
            className="btn btn-primary flex items-center gap-2 shadow-sm shadow-indigo-200"
          >
            <span>➕</span>
            <span>Create User</span>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      {/* Pending Approval Banner if any user needs review */}
      {statusFilter !== 'PENDING' && pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="font-semibold text-sm">Action Needed: Pending User Approvals</p>
              <p className="text-xs text-amber-700">
                Newly registered users cannot access the platform until you approve them.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white font-medium self-start sm:self-auto"
          >
            Filter Pending Approvals
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {[
            { id: 'ALL', label: 'All Users' },
            { id: 'PENDING', label: 'Pending Approval', countBadge: true },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'INACTIVE', label: 'Inactive' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{tab.label}</span>
              {tab.countBadge && pendingCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  statusFilter === tab.id ? 'bg-white text-indigo-700' : 'bg-amber-100 text-amber-800'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative min-w-[260px] max-w-sm">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search name, username, email…"
            className="input pl-9 py-1.5 text-sm w-full"
          />
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-gray-500 text-sm">Loading users…</p>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
          <p className="text-3xl mb-3">👥</p>
          <p className="font-medium text-gray-600">No users match the criteria</p>
          <p className="text-xs text-gray-400 mt-1">
            {statusFilter === 'PENDING' ? 'No pending approval requests right now.' : 'Try adjusting your search query or filters.'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-wrapper bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Approval Status</th>
                  <th>Account Status</th>
                  <th>Joined</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isPending = u.is_approved === false || u.approval_status === 'PENDING'
                  const isApproved = u.is_approved === true || u.approval_status === 'APPROVED'
                  const isRejected = u.approval_status === 'REJECTED'

                  return (
                    <tr
                      key={u.id}
                      onClick={() => navigate(`/admin/users/${u.id}`)}
                      className="cursor-pointer hover:bg-indigo-50/40 transition-colors"
                      title="Click to view full user details and IPO history"
                    >
                      {/* User Column */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {getInitials(u.full_name || u.username)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 hover:text-indigo-600 flex items-center gap-1.5">
                              <span>{u.full_name || 'No Name'}</span>
                              <span className="text-xs text-indigo-500">↗</span>
                            </div>
                            <div className="text-xs text-gray-500">@{u.username}</div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td>
                        <div className="text-xs font-mono text-gray-600">{u.email}</div>
                      </td>

                      {/* Role */}
                      <td>
                        <span className={u.role === 'admin' ? 'badge badge-purple' : 'badge badge-blue'}>
                          {u.role === 'admin' ? 'Admin' : 'Member'}
                        </span>
                      </td>

                      {/* Approval Status */}
                      <td>
                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending Approval
                          </span>
                        ) : isApproved ? (
                          <span className="badge badge-green flex items-center gap-1">
                            <span>✓</span> Approved
                          </span>
                        ) : isRejected ? (
                          <span className="badge badge-red flex items-center gap-1">
                            <span>✕</span> Rejected
                          </span>
                        ) : (
                          <span className="badge badge-gray">Standard</span>
                        )}
                      </td>

                      {/* Account Status */}
                      <td>
                        <span className={u.is_active ? 'badge badge-green' : 'badge badge-red'}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDateTime(u.created_at)}
                      </td>

                      {/* Action Buttons */}
                      <td className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Approve / Reject for Pending */}
                          {isPending && (
                            <>
                              <button
                                onClick={(e) => handleApproval(u.id, 'APPROVED', e)}
                                disabled={actionLoading === `approval-${u.id}`}
                                className="btn btn-sm btn-success text-xs py-1 px-2.5 shadow-sm"
                                title="Approve user so they can access the platform"
                              >
                                {actionLoading === `approval-${u.id}` ? '…' : '✓ Approve'}
                              </button>
                              <button
                                onClick={(e) => handleApproval(u.id, 'REJECTED', e)}
                                disabled={actionLoading === `approval-${u.id}`}
                                className="btn btn-sm btn-danger text-xs py-1 px-2.5 shadow-sm"
                                title="Reject user access"
                              >
                                {actionLoading === `approval-${u.id}` ? '…' : '✕ Reject'}
                              </button>
                            </>
                          )}

                          {/* View Detail Link */}
                          <Link
                            to={`/admin/users/${u.id}`}
                            className="btn btn-secondary btn-sm text-xs py-1 px-2.5"
                          >
                            Details
                          </Link>

                          {/* Toggle Active/Inactive */}
                          {u.role !== 'admin' && (
                            <button
                              onClick={(e) => handleToggle(u.id, u.is_active, e)}
                              disabled={actionLoading === `toggle-${u.id}`}
                              className={`btn btn-sm text-xs py-1 px-2.5 ${u.is_active ? 'text-red-600 hover:bg-red-50 border border-red-200' : 'btn-success'}`}
                              title={u.is_active ? 'Deactivate account' : 'Activate account'}
                            >
                              {actionLoading === `toggle-${u.id}` ? '…' : u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex justify-between items-center bg-white px-4 py-3 rounded-xl border border-gray-200 text-sm">
              <span className="text-gray-500">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} users
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary btn-sm"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg flex items-center">
                  Page {page} of {Math.ceil(total / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * PAGE_SIZE >= total}
                  className="btn btn-secondary btn-sm"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

