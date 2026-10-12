import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminCreateUser } from '../../services/ipoService'

export default function CreateUser() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: 'user',
    autoApprove: true,
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [createdUser, setCreatedUser] = useState(null)

  const validate = () => {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.username.trim()) e.username = 'Username is required'
    else if (form.username.length < 3) e.username = 'Minimum 3 characters'
    else if (!/^[a-zA-Z0-9_.-]+$/.test(form.username)) e.username = 'Letters, numbers, _ . - only'
    if (!form.email.trim()) e.email = 'Email address is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'Minimum 6 characters'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setLoading(true)
    try {
      const res = await adminCreateUser({
        email: form.email.trim(),
        password: form.password,
        username: form.username.trim().toLowerCase(),
        fullName: form.fullName.trim(),
        role: form.role,
      })

      if (res?.error) {
        setApiError(res.error)
        return
      }

      setCreatedUser({
        id: res.user_id,
        email: form.email.trim(),
        username: form.username.trim().toLowerCase(),
        fullName: form.fullName.trim(),
        role: form.role,
        password: form.password,
      })
    } catch (err) {
      console.error('Create user error:', err)
      setApiError(err?.message || 'Failed to create user. Please verify email and username uniqueness.')
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }))
    setErrors(p => ({ ...p, [field]: '' }))
    setApiError('')
  }

  if (createdUser) {
    return (
      <div className="max-w-xl mx-auto py-10 animate-slide-up">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-luxury-card p-8 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 text-3xl">
            🎉
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">User Account Created!</h2>
          <p className="text-xs text-slate-500 mb-6">
            The user has been registered, auto-verified, and marked as <strong className="text-emerald-700">APPROVED</strong>.
          </p>

          {/* Credentials Summary Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 text-left text-xs space-y-2.5 mb-8">
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Full Name:</span>
              <span className="font-bold text-slate-900">{createdUser.fullName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Username:</span>
              <span className="font-mono font-semibold text-slate-800">@{createdUser.username}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Email:</span>
              <span className="font-mono text-slate-800">{createdUser.email}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Temporary Password:</span>
              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {createdUser.password}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500">Account Role:</span>
              <span className="uppercase font-bold text-slate-700">{createdUser.role}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {createdUser.id && (
              <Link
                to={`/admin/users/${createdUser.id}`}
                className="btn btn-primary w-full sm:w-auto px-5 py-2.5 shadow-sm"
              >
                View User Profile →
              </Link>
            )}
            <button
              onClick={() => {
                setCreatedUser(null)
                setForm({ fullName: '', username: '', email: '', password: '', role: 'user', autoApprove: true })
              }}
              className="btn btn-secondary w-full sm:w-auto px-5 py-2.5"
            >
              + Create Another User
            </button>
            <Link
              to="/admin/users"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 py-2 sm:py-0"
            >
              Return to Users List
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/users"
            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm transition-all"
          >
            ← Back
          </Link>
          <div>
            <h1 className="page-title">Manually Create User</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Add a new member directly with immediate access and approval.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-luxury-card p-6 sm:p-8">
        {apiError && (
          <div className="alert-error mb-6">
            <span>⚠</span>
            <span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label label-required" htmlFor="cu-fullname">Full Name</label>
              <input
                id="cu-fullname"
                type="text"
                value={form.fullName}
                onChange={set('fullName')}
                placeholder="e.g. Satish Kumar A"
                className={`input ${errors.fullName ? 'input-error' : ''}`}
                disabled={loading}
              />
              {errors.fullName && <p className="error-msg">{errors.fullName}</p>}
            </div>

            <div>
              <label className="label label-required" htmlFor="cu-username">Username</label>
              <input
                id="cu-username"
                type="text"
                value={form.username}
                onChange={set('username')}
                placeholder="e.g. satish56"
                className={`input ${errors.username ? 'input-error' : ''}`}
                disabled={loading}
              />
              {errors.username && <p className="error-msg">{errors.username}</p>}
            </div>
          </div>

          <div>
            <label className="label label-required" htmlFor="cu-email">Email Address</label>
            <input
              id="cu-email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="e.g. satish56@gmail.com"
              className={`input ${errors.email ? 'input-error' : ''}`}
              disabled={loading}
            />
            {errors.email && <p className="error-msg">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label label-required" htmlFor="cu-password">Temporary Password</label>
              <input
                id="cu-password"
                type="text"
                value={form.password}
                onChange={set('password')}
                placeholder="At least 6 characters"
                className={`input ${errors.password ? 'input-error' : ''}`}
                disabled={loading}
              />
              {errors.password && <p className="error-msg">{errors.password}</p>}
            </div>

            <div>
              <label className="label" htmlFor="cu-role">Role</label>
              <select
                id="cu-role"
                value={form.role}
                onChange={set('role')}
                className="input"
                disabled={loading}
              >
                <option value="user">Retailer / User</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
            <span className="text-xl">🛡️</span>
            <div>
              <p className="text-xs font-bold text-indigo-950">Immediate Approval &amp; Access</p>
              <p className="text-[11px] text-indigo-700/90 mt-0.5 leading-relaxed">
                Users created manually by an administrator are auto-approved and can log in immediately using these credentials without waiting in the pending review queue.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Link to="/admin/users" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary px-6 shadow-luxury-btn"
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Creating Account…
                </>
              ) : (
                'Create & Approve User'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
