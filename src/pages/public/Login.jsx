import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()

  const [form,     setForm]     = useState({ email: '', password: '' })
  const [errors,   setErrors]   = useState({})
  const [loading,  setLoading]  = useState(false)
  const [apiError, setApiError] = useState('')

  const validate = () => {
    const e = {}
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email address'
    if (!form.password) e.password = 'Password is required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setApiError('')
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const { data, error } = await signIn({ email: form.email.trim(), password: form.password })
      if (error) { setApiError(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message); return }
      const from = location.state?.from?.pathname
      navigate(from || '/user/dashboard', { replace: true })
    } catch { setApiError('Unexpected error. Please try again.') }
    finally { setLoading(false) }
  }

  const set = (field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }))
    setErrors(p => ({ ...p, [field]: '' }))
    setApiError('')
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md animate-slide-up">
        <div className="card">
          <div className="card-header text-center py-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <span className="text-white font-bold text-lg">IPO</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to your IPO Tracker account</p>
          </div>
          <div className="card-body">
            {apiError && <div className="alert-error mb-4"><span>⚠</span><span>{apiError}</span></div>}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="login-email" className="label label-required">Email address</label>
                <input id="login-email" type="email" autoComplete="email" value={form.email} onChange={set('email')}
                  className={`input ${errors.email ? 'input-error' : ''}`} placeholder="you@example.com" disabled={loading} />
                {errors.email && <p className="error-msg">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="login-password" className="label label-required">Password</label>
                <input id="login-password" type="password" autoComplete="current-password" value={form.password} onChange={set('password')}
                  className={`input ${errors.password ? 'input-error' : ''}`} placeholder="••••••••" disabled={loading} />
                {errors.password && <p className="error-msg">{errors.password}</p>}
              </div>
              <button id="login-submit" type="submit" disabled={loading} className="btn btn-primary w-full btn-lg mt-2">
                {loading ? <><span className="spinner" />Signing in…</> : 'Sign In'}
              </button>
            </form>
          </div>
          <div className="card-footer text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 font-semibold hover:underline">Register here</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
