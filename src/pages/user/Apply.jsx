import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { submitParticipation, checkExistingParticipation, getOpenIpos, getRegisteredUsers } from '../../services/ipoService'
import { formatCurrency } from '../../utils/formatters'

export default function Apply() {
  const { ipoId }   = useParams()
  const { profile } = useAuth()
  const [ipo,   setIpo]   = useState(null)
  const [type,  setType]  = useState('INVESTOR')
  const [appNo, setAppNo] = useState('')  // typed only by users who have no PAN on their profile
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')
  const [appNoErr,   setAppNoErr]   = useState('')
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [success, setSuccess] = useState(false)

  // Investor selection (for ACCOUNT_HOLDER type)
  const [allUsers,        setAllUsers]        = useState([])
  const [investorSearch,  setInvestorSearch]  = useState('')
  const [selectedInvestor, setSelectedInvestor] = useState(null)
  const [investorDropOpen, setInvestorDropOpen] = useState(false)
  const [investorErr,     setInvestorErr]     = useState('')
  const [usersLoading,    setUsersLoading]    = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      try {
        const ipos  = await getOpenIpos()
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

  // Load users when Account Holder type is selected
  useEffect(() => {
    if (type === 'ACCOUNT_HOLDER' && allUsers.length === 0) {
      setUsersLoading(true)
      getRegisteredUsers()
        .then(users => setAllUsers(users.filter(u => u.id !== profile?.id)))
        .catch(() => setError('Failed to load users list.'))
        .finally(() => setUsersLoading(false))
    }
  }, [type, allUsers.length, profile?.id])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setInvestorDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredUsers = allUsers.filter(u =>
    investorSearch.trim() === '' ||
    u.full_name.toLowerCase().includes(investorSearch.toLowerCase()) ||
    u.username.toLowerCase().includes(investorSearch.toLowerCase())
  )

  // The signed-in user's own PAN (from My Profile) is their application number for BOTH
  // Investor and Account Holder applications, and is read-only here — it can only be changed
  // in My Profile. Only users with no PAN on their profile type an application number.
  const profilePan = profile?.pan_number ?? ''
  const appNoValue = profilePan || appNo

  const handleSelectInvestor = (user) => {
    setSelectedInvestor(user)
    setInvestorSearch('')
    setInvestorDropOpen(false)
    setInvestorErr('')
  }

  const validateAppNo = (v) => {
    if (!v.trim()) return 'Application number is required'
    if (v.trim().length < 3) return 'Min 3 characters'
    if (v.trim().length > 50) return 'Max 50 characters'
    if (!/^[A-Za-z0-9/_-]+$/.test(v.trim())) return 'Letters, numbers, /, _, - only'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('')
    if (type === 'ACCOUNT_HOLDER' && !selectedInvestor) {
      setInvestorErr('Please select the actual investor from the list.')
      return
    }
    const err = validateAppNo(appNoValue)
    if (err) { setAppNoErr(err); return }
    setSubmitting(true)
    try {
      await submitParticipation({
        ipoId,
        participationType: type,
        applicationNumber: appNoValue.trim(),
        userId: profile.id,
        investorUserId: type === 'ACCOUNT_HOLDER' ? selectedInvestor.id : null,
        amountContributed: ipo?.ipo_price ?? null,
      })
      setSuccess(true)
    } catch (err) {
      if (err?.code === '23505') setError('You have already applied for this IPO.')
      else setError(err?.message ?? 'Submission failed. Please try again.')
    } finally { setSubmitting(false) }
  }

  // Application number field, shared by Investor and Account Holder applications.
  // Read-only (the profile PAN) when the user has a PAN, otherwise a mandatory text input.
  const appNumberField = (id) => (
    <div className="animate-fade-in">
      <label htmlFor={id} className={profilePan ? 'label' : 'label label-required'}>Application Number</label>
      <input id={id} type="text" value={appNoValue}
        readOnly={!!profilePan}
        onChange={e => { setAppNo(e.target.value); setAppNoErr('') }}
        className={`input ${appNoErr ? 'input-error' : ''} ${profilePan ? 'bg-gray-50 cursor-not-allowed font-mono' : ''}`}
        placeholder="e.g. APP1234567"
        disabled={alreadyApplied || submitting} />
      {appNoErr
        ? <p className="error-msg">{appNoErr}</p>
        : profilePan
          ? <p className="helper-msg">
              Your PAN from <Link to="/user/profile" className="underline">My Profile</Link> is used as the application number.
              To change it, update your PAN in My Profile.
            </p>
          : <p className="helper-msg">
              Letters, numbers, /, _, - only. No spaces. Add your PAN in{' '}
              <Link to="/user/profile" className="underline">My Profile</Link> and it will be filled in automatically.
            </p>}
    </div>
  )

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>

  if (success) return (
    <div className="max-w-lg mx-auto py-12 text-center animate-slide-up">
      <div className="card p-10">
        <div className="text-5xl mb-4"> </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
        <p className="text-gray-500 text-sm mb-2">Participation for <strong>{ipo?.ipo_name}</strong> recorded.</p>
        {type === 'INVESTOR' && (
          <p className="text-gray-500 text-sm mb-2">Type: <strong>Investor</strong> · App No: {appNoValue}</p>
        )}
        {type === 'ACCOUNT_HOLDER' && (
          <p className="text-gray-500 text-sm mb-2">
            Type: <strong>Account Holder</strong> · Investor: <strong>{selectedInvestor?.full_name}</strong> · App No: {appNoValue}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
          <Link to="/user/history" className="btn btn-primary">View My IPOs</Link>
          <Link to="/user/ipos"    className="btn btn-secondary">Back to IPOs</Link>
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
        <div className="alert-warning mb-6"><span> </span>
          <div><p className="font-semibold">Already Applied</p>
            <p className="text-sm">You have already submitted for this IPO.</p>
            <Link to="/user/history" className="text-sm underline font-medium mt-1 inline-block">View history →</Link>
          </div>
        </div>
      )}
      {error && <div className="alert-error mb-6"><span> </span><span>{error}</span></div>}
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
              {[
                ['INVESTOR',      ' Investor',      'You are the actual investor'],
                ['ACCOUNT_HOLDER',' Account Holder', 'Another person invests via your account'],
              ].map(([val, label, desc]) => (
                <button key={val} type="button"
                  onClick={() => {
                    setType(val)
                    setAppNo('')
                    setAppNoErr('')
                    if (val === 'INVESTOR') {
                      setSelectedInvestor(null)
                      setInvestorSearch('')
                      setInvestorErr('')
                    }
                  }}
                  disabled={alreadyApplied || submitting}
                  className={`p-4 rounded-xl border-2 text-left transition-all duration-150 ${type === val ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'} ${alreadyApplied ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* INVESTOR type: Application Number field */}
          {type === 'INVESTOR' && appNumberField('app-number')}

          {/* ACCOUNT_HOLDER type: Searchable investor dropdown */}
          {type === 'ACCOUNT_HOLDER' && (
            <div className="animate-fade-in space-y-2">
              <label className="label label-required">Select Actual Investor</label>
              <p className="text-xs text-gray-500">
                You are the <strong>Account Holder</strong> (your account is being used).
                Select the person who is the <strong>actual investor</strong>.
              </p>

              {/* Selected investor badge */}
              {selectedInvestor && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {selectedInvestor.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-indigo-900 truncate">{selectedInvestor.full_name}</p>
                    <p className="text-xs text-indigo-500">@{selectedInvestor.username}</p>
                  </div>
                  <button type="button" onClick={() => { setSelectedInvestor(null); setInvestorDropOpen(true) }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    Change
                  </button>
                </div>
              )}

              {/* Searchable dropdown */}
              {!selectedInvestor && (
                <div ref={dropRef} className="relative">
                  <div className="relative">
                    <input
                      id="investor-search"
                      type="text"
                      value={investorSearch}
                      onChange={e => { setInvestorSearch(e.target.value); setInvestorDropOpen(true); setInvestorErr('') }}
                      onFocus={() => setInvestorDropOpen(true)}
                      placeholder="Search by name or username…"
                      disabled={alreadyApplied || submitting || usersLoading}
                      className={`input pr-10 ${investorErr ? 'input-error' : ''}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      {usersLoading ? (
                        <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                      ) : ' '}
                    </span>
                  </div>

                  {investorDropOpen && !usersLoading && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                      {filteredUsers.length === 0 ? (
                        <div className="py-4 text-center text-sm text-gray-400">
                          {investorSearch ? 'No users match your search.' : 'No other users available.'}
                        </div>
                      ) : (
                        filteredUsers.map(user => (
                          <button key={user.id} type="button"
                            onMouseDown={() => handleSelectInvestor(user)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {user.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                              <p className="text-xs text-gray-500">@{user.username}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              {investorErr && <p className="error-msg">{investorErr}</p>}

              {/* Account holder's own application number (their profile PAN) */}
              {selectedInvestor && appNumberField('holder-app-number')}

              {selectedInvestor && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Summary:</strong> {selectedInvestor.full_name} is the <strong>Investor</strong>.
                    You ({profile?.full_name}) are the <strong>Account Holder</strong>.
                    Investor will receive 80% of profit; you will receive 20%.
                  </p>
                </div>
              )}
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