import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Register() {
  const { signUp } = useAuth()
  const [form, setForm] = useState({ username: '', fullName: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)

  const validate = () => {
    const e = {}
    if (!form.username.trim()) e.username = 'Username is required'
    else if (form.username.length < 3) e.username = 'Min 3 characters'
    else if (!/^[a-zA-Z0-9_.-]+$/.test(form.username)) e.username = 'Letters, numbers, _ . - only'
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'Min 8 characters'
    if (!form.confirm) e.confirm = 'Please confirm password'
    else if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setApiError('')
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const { data, error } = await signUp({ email: form.email.trim(), password: form.password, username: form.username.trim().toLowerCase(), fullName: form.fullName.trim() })
      if (error) { setApiError(error.message?.includes('already registered') ? 'This email is already registered.' : error.message); return }
      if (data?.user?.identities?.length === 0) { setApiError('This email is already registered.'); return }
      setSuccess(true)
    } catch { setApiError('Unexpected error. Please try again.') }
    finally { setLoading(false) }
  }

  const set = (field) => (e) => { setForm(p => ({ ...p, [field]: e.target.value })); setErrors(p => ({ ...p, [field]: '' })); setApiError('') }

  if (success) return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center animate-slide-up">
        <div className="card p-10">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account created!</h2>
          <p className="text-gray-500 text-sm mb-6">Please check your email for a confirmation link, then sign in.</p>
          <Link to="/login" className="btn btn-primary">Go to Login</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md animate-slide-up">
        <div className="card">
          <div className="card-header text-center py-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <span className="text-white font-bold text-lg">IPO</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
          </div>
          <div className="card-body">
            {apiError && <div className="alert-error mb-4"><span>⚠</span><span>{apiError}</span></div>}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {[
                { id: 'reg-username', field: 'username', label: 'Username',     type: 'text',     placeholder: 'johndoe123', help: 'Letters, numbers, _ . - only. Min 3 chars.' },
                { id: 'reg-fullname', field: 'fullName', label: 'Full Name',    type: 'text',     placeholder: 'John Doe' },
                { id: 'reg-email',    field: 'email',    label: 'Email address', type: 'email',   placeholder: 'you@example.com' },
                { id: 'reg-password', field: 'password', label: 'Password',     type: 'password', placeholder: 'At least 8 characters' },
                { id: 'reg-confirm',  field: 'confirm',  label: 'Confirm Password', type: 'password', placeholder: 'Re-enter password' },
              ].map(({ id, field, label, type, placeholder, help }) => (
                <div key={field}>
                  <label htmlFor={id} className="label label-required">{label}</label>
                  <input id={id} type={type} value={form[field]} onChange={set(field)}
                    className={`input ${errors[field] ? 'input-error' : ''}`} placeholder={placeholder} disabled={loading} />
                  {errors[field] ? <p className="error-msg">{errors[field]}</p> : help && <p className="helper-msg">{help}</p>}
                </div>
              ))}
              <button id="register-submit" type="submit" disabled={loading} className="btn btn-primary w-full btn-lg mt-2">
                {loading ? <><span className="spinner" />Creating account…</> : 'Create Account'}
              </button>
            </form>
          </div>
          <div className="card-footer text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
