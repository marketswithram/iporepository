import { useAuth } from '../../context/AuthContext'
import { formatDateTime } from '../../utils/formatters'

export default function UserProfile() {
  const { profile } = useAuth()
  if (!profile) return null

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
            ['Username',   profile.username],
            ['Full Name',  profile.full_name],
            ['Email',      profile.email],
            ['Role',       profile.role],
            ['Status',     profile.is_active ? 'Active' : 'Inactive'],
            ['Member Since', formatDateTime(profile.created_at)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-500">{label}</span>
              <span className="text-sm font-semibold text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="alert-info text-xs">
        <span>ℹ</span>
        <span>To update your profile information, please contact the administrator.</span>
      </div>
    </div>
  )
}
