import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { submitParticipation, checkExistingParticipation, getOpenIpos } from '../../services/ipoService'
import { formatCurrency } from '../../utils/formatters'

export default function Apply() {
  const { ipoId }   = useParams()
  const { profile } = useAuth()
  const [ipo,   setIpo]   = useState(null)
  const [type,  setType]  = useState('INVESTOR')
  const [appNo, setAppNo] = useState('')
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [appNoErr,   setAppNoErr]   = useState('')
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const ipos  = await getOpenIpos()
        const found = ipos.find(i => i.id === ipoId)
        if (!found) { setError('This IPO is not available or has been closed.'); return }
        setIpo(found)
        const exists = await checkExistingParticipation(ipoId)
        setAlreadyApplied(exists)
      } catch { setError('Failed to load IPO details.') }
      finally { setLoading(false) }
    }
    load()
  }, [ipoId])

  const validateAppNo = (v) => {
    if (type === 'ACCOUNT_HOLDER') return ''
    if (!v.trim()) return 'Application number is required for Investor'
    if (v.trim().length < 3) return 'Min 3 characters'
    if (v.trim().length > 50) return 'Max 50 characters'
    if (!/^[A-Za-z0-9/_-]+$/.test(v.trim())) return 'Letters, numbers, /, _, - only'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('')
    const err = validateAppNo(appNo)
    if (err) { setAppNoErr(err); return }
    setSubmitting(true)
    try {
      await submitParticipation({ ipoId, participationType: type, applicationNumber: type === 'INVESTOR' ? appNo.trim() : null, userId: profile.id })
      setSuccess(true)
    } catch (err) {
      if (err?.code === '23505') setError('You have already applied for this IPO.')
      else setError(err?.message ?? 'Submission failed. Please try again.')
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>

  if (success) return (
    <div className="max-w-lg mx-auto py-12 text-center animate-slide-up">
      <div className="card p-10">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
        <p className="text-gray-500 text-sm mb-2">Participation for <strong>{ipo?.ipo_name}</strong> recorded.</p>
        <p className="text-gray-500 text-sm mb-6">Type: <strong>{type === 'INVESTOR' ? 'Investor' : 'Account Holder'}</strong>{type === 'INVESTOR' && ` · App No: ${appNo}`}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/user/history" className="btn btn-primary">View My IPOs</Link>
          <Link to="/user/ipos"    className="btn btn-secondary">Back to IPOs</Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <div className="mb-6">
        <Link to="/user/ipos" className="text-sm text-blue-600 hover:underline">← Back to IPOs</Link>
        <h1 className="page-title mt-2">Apply for IPO</h1>
      </div>
      {alreadyApplied && (
        <div className="alert-warning mb-6"><span>⚠</span>
          <div><p className="font-semibold">Already Applied</p>
            <p className="text-sm">You have already submitted for this IPO.</p>
            <Link to="/user/history" className="text-sm underline font-medium mt-1 inline-block">View history →</Link>
          </div>
        </div>
      )}
      {error && <div className="alert-error mb-6"><span>⚠</span><span>{error}</span></div>}
      <div className="card">
        {ipo && (
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div><p className="font-bold text-blue-900 text-lg">{ipo.ipo_name}</p><p className="text-blue-500 text-xs">{ipo.ipo_code}</p></div>
              <div className="text-right"><p className="text-2xl font-bold text-blue-800">{formatCurrency(ipo.ipo_price)}</p><span className="badge badge-green">Open</span></div>
            </div>
          </div>
        )}
        <div className="card-body space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Username</label><input type="text" value={profile?.username ?? ''} readOnly className="input bg-gray-50 cursor-not-allowed" /></div>
            <div><label className="label">Full Name</label><input type="text" value={profile?.full_name ?? ''} readOnly className="input bg-gray-50 cursor-not-allowed" /></div>
          </div>
          <div>
            <label className="label">IPO Price</label>
            <input type="text" value={ipo ? formatCurrency(ipo.ipo_price) : '—'} readOnly className="input bg-gray-50 cursor-not-allowed font-semibold text-blue-700" />
          </div>
          <div>
            <label className="label label-required">Participation Type</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              {[['INVESTOR', '🏦 Investor', 'Application number required'], ['ACCOUNT_HOLDER', '👤 Account Holder', 'No application number needed']].map(([val, label, desc]) => (
                <button key={val} type="button" onClick={() => { setType(val); if (val === 'ACCOUNT_HOLDER') { setAppNo(''); setAppNoErr('') } }} disabled={alreadyApplied || submitting}
                  className={`p-4 rounded-xl border-2 text-left transition-all duration-150 ${type === val ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'} ${alreadyApplied ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>
          {type === 'INVESTOR' && (
            <div className="animate-fade-in">
              <label htmlFor="app-number" className="label label-required">Application Number</label>
              <input id="app-number" type="text" value={appNo} onChange={e => { setAppNo(e.target.value); setAppNoErr('') }}
                className={`input ${appNoErr ? 'input-error' : ''}`} placeholder="e.g. APP1234567" disabled={alreadyApplied || submitting} />
              {appNoErr ? <p className="error-msg">{appNoErr}</p> : <p className="helper-msg">Letters, numbers, /, _, - only. No spaces.</p>}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <button id="apply-submit" type="submit" disabled={alreadyApplied || submitting} className="btn btn-primary w-full btn-lg">
              {submitting ? <><span className="spinner" />Submitting…</> : alreadyApplied ? 'Already Applied' : 'Submit Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
