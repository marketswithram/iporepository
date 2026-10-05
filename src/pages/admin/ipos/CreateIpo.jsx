import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { createIpo } from '../../../services/ipoService'
import { formatCurrency } from '../../../utils/formatters'

export default function CreateIpo() {
  const { profile } = useAuth()
  const navigate    = useNavigate()

  const [form, setForm] = useState({ ipoName: '', ipoPrice: '', startDate: '', endDate: '' })
  const [errors,   setErrors]   = useState({})
  const [loading,  setLoading]  = useState(false)
  const [apiError, setApiError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const validate = () => {
    const e = {}
    if (!form.ipoName.trim()) e.ipoName = 'IPO name is required'
    if (!form.ipoPrice)       e.ipoPrice = 'IPO price is required'
    else if (isNaN(Number(form.ipoPrice)) || Number(form.ipoPrice) <= 0) e.ipoPrice = 'Price must be a positive number'
    if (!form.startDate)      e.startDate = 'Start date is required'
    if (!form.endDate)        e.endDate = 'End date is required'
    else if (form.startDate && form.endDate < form.startDate) e.endDate = 'End date must be on or after start date'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setApiError('')
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const ipo = await createIpo({
        ipoName:   form.ipoName.trim(),
        ipoPrice:  Number(form.ipoPrice),
        startDate: form.startDate,
        endDate:   form.endDate,
        createdBy: profile.id,
      })
      navigate(`/admin/ipos/${ipo.id}`)
    } catch (err) {
      setApiError(err?.message ?? 'Failed to create IPO.')
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => { setForm(p => ({ ...p, [field]: e.target.value })); setErrors(p => ({ ...p, [field]: '' })); setApiError('') }

  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <div className="mb-6">
        <Link to="/admin/ipos" className="text-sm text-indigo-600 hover:underline">← Back to IPOs</Link>
        <h1 className="page-title mt-2">Create New IPO</h1>
        <p className="text-gray-500 text-sm mt-1">IPO code will be auto-generated (e.g., IPO1001)</p>
      </div>

      {apiError && <div className="alert-error mb-4"><span>⚠</span><span>{apiError}</span></div>}

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="ipo-name" className="label label-required">IPO Name</label>
              <input id="ipo-name" type="text" value={form.ipoName} onChange={set('ipoName')}
                className={`input ${errors.ipoName ? 'input-error' : ''}`} placeholder="e.g. BTA, ABC Corp" disabled={loading} />
              {errors.ipoName && <p className="error-msg">{errors.ipoName}</p>}
            </div>

            <div>
              <label htmlFor="ipo-price" className="label label-required">IPO Price (₹)</label>
              <input id="ipo-price" type="number" min="1" step="0.01" value={form.ipoPrice} onChange={set('ipoPrice')}
                className={`input ${errors.ipoPrice ? 'input-error' : ''}`} placeholder="e.g. 14919" disabled={loading} />
              {errors.ipoPrice ? <p className="error-msg">{errors.ipoPrice}</p>
                : form.ipoPrice && Number(form.ipoPrice) > 0 && <p className="helper-msg">= {formatCurrency(Number(form.ipoPrice))}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="ipo-start" className="label label-required">Start Date</label>
                <input id="ipo-start" type="date" min={today} value={form.startDate} onChange={set('startDate')}
                  className={`input ${errors.startDate ? 'input-error' : ''}`} disabled={loading} />
                {errors.startDate && <p className="error-msg">{errors.startDate}</p>}
              </div>
              <div>
                <label htmlFor="ipo-end" className="label label-required">End Date</label>
                <input id="ipo-end" type="date" min={form.startDate || today} value={form.endDate} onChange={set('endDate')}
                  className={`input ${errors.endDate ? 'input-error' : ''}`} disabled={loading} />
                {errors.endDate && <p className="error-msg">{errors.endDate}</p>}
              </div>
            </div>

            <div className="alert-info text-xs">
              <span>ℹ</span>
              <span>IPO will be created with status <strong>DRAFT</strong>. Change it to <strong>OPEN</strong> from the IPO details page to make it visible to users.</span>
            </div>

            <div className="flex gap-3">
              <button id="create-ipo-submit" type="submit" disabled={loading} className="btn bg-indigo-600 text-white hover:bg-indigo-700 flex-1 btn-lg">
                {loading ? <><span className="spinner" />Creating…</> : 'Create IPO'}
              </button>
              <Link to="/admin/ipos" className="btn btn-secondary btn-lg">Cancel</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
