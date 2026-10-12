import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function PendingApproval() {
  const { profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const handleRefresh = async () => {
    await refreshProfile()
    if (profile?.is_approved || profile?.role === 'admin') {
      navigate('/user/dashboard', { replace: true })
    }
  }

  const isRejected = profile?.approval_status === 'REJECTED'

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-lg animate-slide-up">
        <div className="card shadow-luxury-card border border-slate-200/90 text-center p-8 sm:p-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm text-3xl
            bg-amber-50 border border-amber-200">
            {isRejected ? '🛑' : '⏳'}
          </div>

          <h1 className="text-2xl font-bold text-midnight-950 mb-2">
            {isRejected ? 'Account Review Decision' : 'Account Pending Admin Approval'}
          </h1>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4
            bg-amber-100/70 text-amber-800 border border-amber-300/80">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Status: {profile?.approval_status || 'PENDING'}
          </div>

          <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-md mx-auto">
            {isRejected ? (
              <>
                Your registration application was reviewed and could not be approved at this time. Please contact the group administrator for further assistance.
              </>
            ) : (
              <>
                Welcome <span className="font-semibold text-slate-900">{profile?.full_name || 'Member'}</span>! Your email has been verified. 
                For group investment security, every new account must be verified and approved by the administrator before accessing the IPO dashboard.
              </>
            )}
          </p>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-left text-xs text-slate-600 space-y-2 mb-8">
            <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
              <span className="text-slate-400">Account Username:</span>
              <span className="font-mono font-semibold text-slate-800">@{profile?.username || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
              <span className="text-slate-400">Email:</span>
              <span className="font-mono text-slate-800">{profile?.email || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Registration Date:</span>
              <span className="font-medium text-slate-800">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleRefresh}
              className="btn btn-primary w-full sm:w-auto px-6 py-2.5 shadow-luxury-btn"
            >
              🔄 Check Approval Status
            </button>
            <button
              onClick={async () => { await signOut(); navigate('/login') }}
              className="btn btn-secondary w-full sm:w-auto px-6 py-2.5"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
