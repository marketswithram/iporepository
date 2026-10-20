import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateMyPan } from '../../services/ipoService'
import { formatDateTime } from '../../utils/formatters'
import { isValidPan, normalizePan } from '../../utils/pan'

export default function UserProfile() {
  const { profile, refreshProfile } = useAuth()
  const [panInput, setPanInput] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [panError, setPanError] = useState('')
  const [panMsg,   setPanMsg]   = useState('')

  if (!profile) return null

  const handleSavePan = async (e) => {
    e.preventDefault()
    setPanError(''); setPanMsg('')
    const pan = normalizePan(panInput)
    if (!pan) { setPanError('Enter your PAN number.'); return }
    if (!isValidPan(pan)) { setPanError('Invalid PAN. Format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)'); return }
    setSaving(true)
    try {
      await updateMyPan(pan)
      await refreshProfile()
      setPanInput('')
      setPanMsg('PAN saved. It will now be used as your application number when you apply for IPOs.')
    } catch (err) {
      setPanError(err?.message ?? 'Could not save PAN. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <h1 className="page-title">My Profile</h1>
      <div className="card">
        <div className="card-body flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-2xl">{profile.full_name?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{profile.full_name}</p>
            <p className="text-gray-500">@{profile.username}</p>
            <span className={`badge mt-1 ${profile.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>{profile.role}</span>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h2 className="section-title">Account Details</h2></div>
        <div className="card-body space-y-3">
          {[
            ['Username',   profile.username],
            ['Full Name',  profile.full_name],
            ['Email',      profile.email],
            ['PAN Number', profile.pan_number || 'Not added'],
            ['Role',       profile.role],
            ['Status',     profile.is_active ? 'Active' : 'Inactive'],
            ['Member Since', formatDateTime(profile.created_at)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">{label}</span>
              <span className={`text-sm font-semibold ${label === 'PAN Number' && !profile.pan_number ? 'text-gray-400 font-normal' : 'text-gray-900'}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2 className="section-title">{profile.pan_number ? 'Update PAN Number' : 'Add PAN Number'}</h2></div>
        <form onSubmit={handleSavePan} noValidate className="card-body space-y-3">
          <p className="text-xs text-gray-500">
            Optional. When your profile has a PAN, it is filled in as your application number when you apply for an IPO,
            so you don&apos;t have to type one each time.
          </p>
          {panError && <div className="alert-error"><span> </span><span>{panError}</span></div>}
          {panMsg && <div className="alert-info text-xs"><span>✓</span><span>{panMsg}</span></div>}
          <div className="flex gap-2">
            <input
              id="profile-pan"
              type="text"
              value={panInput}
              onChange={e => { setPanInput(e.target.value.toUpperCase()); setPanError(''); setPanMsg('') }}
              maxLength={10}
              autoComplete="off"
              placeholder="ABCDE1234F"
              disabled={saving}
              className={`input flex-1 ${panError ? 'input-error' : ''}`}
            />
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <><span className="spinner" />Saving…</> : 'Save PAN'}
            </button>
          </div>
        </form>
      </div>

      <div className="alert-info text-xs">
        <span> </span>
        <span>To update any other profile information, please contact the administrator.</span>
      </div>
    </div>
  )
}