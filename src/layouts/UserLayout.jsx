import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getOpenIpos } from '../services/ipoService'

const LOGO_IMG = "https://lh3.googleusercontent.com/aida/AEtjO1UXDRDs-GGLZWyEflNzkZNRj376tAbR5k5qri2l2CMhEyPSqu2rpKzcqWgTEXfe9UUiSXtXTJEh_wfpDtBU85lxOD9a7r-q_DgscglxKXVhTqFVQwZp37LEzd8KwjV43h_Ar5gfE6XnmBG-sVOPC0SNaKWsx6FRIpiRJ5OPD8YhTVcK_jBlpakEM234osyaliYoamaSUvha0YoycbbTZoU9DRi47hfWkHm8S_dbDnJ0ghKYBNJmV9CQPA"

function DummyAvatar({ name, size = 'md' }) {
  const initials = (name || 'User')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U'

  if (size === 'sm') {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shadow-sm ring-1 ring-slate-300 select-none">
        {initials}
      </div>
    )
  }

  return (
    <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-indigo-500/25 shadow-sm select-none">
      {initials}
    </div>
  )
}

function Sidebar({ onClose, openCount = 3 }) {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [logoError, setLogoError] = useState(false)
  const [imgError, setImgError] = useState(false)

  const fullName = profile?.full_name || 'Satish Kumar'

  return (
    <aside className="w-full md:w-64 lg:w-72 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 h-full z-30 select-none">
      <div className="p-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 mb-7" data-purpose="brand-logo">
          <Link to="/" onClick={onClose} className="h-10 flex items-center gap-2.5">
            {!logoError ? (
              <img
                alt="IPO Monitor"
                className="h-9 w-auto object-contain"
                src={LOGO_IMG}
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-500/20">
                  IP
                </div>
                <div>
                  <span className="font-extrabold text-slate-900 tracking-tight text-base block leading-none">
                    IPO<span className="text-indigo-600">Monitor</span>
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">FINTECH ANALYTICS</span>
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* User Profile Badge */}
        <div className="p-3 mb-6 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/70 border border-slate-200/70 flex items-center gap-3.5 shadow-luxury-xs relative group" data-purpose="user-profile-badge">
          <div className="relative shrink-0">
            {profile?.avatar_url && !imgError ? (
              <img
                alt={fullName}
                className="h-11 w-11 rounded-full object-cover ring-2 ring-indigo-500/25 shadow-sm"
                src={profile.avatar_url}
                onError={() => setImgError(true)}
              />
            ) : (
              <DummyAvatar name={fullName} size="md" />
            )}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h4 className="text-sm font-bold text-slate-900 truncate tracking-tight">{fullName}</h4>
              <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-900 text-indigo-200 ring-1 ring-indigo-500/30 shrink-0">
                Retailer
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <svg className="w-3 h-3 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd"></path>
              </svg>
              <p className="text-xs text-slate-500 font-medium truncate font-mono">Verified User</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1.5" data-purpose="sidebar-nav">
          {/* Dashboard */}
          <NavLink
            to="/user/dashboard"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all ${isActive
                ? '!bg-[#0B1120] bg-slate-900 !text-white shadow-md shadow-slate-950/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <rect height="7" rx="1.5" width="7" x="3" y="3"></rect>
                  <rect height="7" rx="1.5" width="7" x="14" y="3"></rect>
                  <rect height="7" rx="1.5" width="7" x="14" y="14"></rect>
                  <rect height="7" rx="1.5" width="7" x="3" y="14"></rect>
                </svg>
                <span className={isActive ? '!text-white font-semibold' : ''}>Dashboard</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
              </>
            )}
          </NavLink>

          {/* Available IPOs */}
          <NavLink
            to="/user/ipos"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all ${isActive
                ? '!bg-[#0B1120] bg-slate-900 !text-white shadow-md shadow-slate-950/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" x2="8" y1="13" y2="13"></line>
                    <line x1="16" x2="8" y1="17" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <span className={isActive ? '!text-white font-semibold' : ''}>Available IPOs</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  }`}>
                  {openCount} Open
                </span>
              </>
            )}
          </NavLink>

          {/* IPO History */}
          <NavLink
            to="/user/history"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all ${isActive
                ? '!bg-[#0B1120] bg-slate-900 !text-white shadow-md shadow-slate-950/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span className={isActive ? '!text-white font-semibold' : ''}>IPO History</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
              </>
            )}
          </NavLink>

          {/* Profit & Loss */}
          <NavLink
            to="/user/profit-loss"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all ${isActive
                ? '!bg-[#0B1120] bg-slate-900 !text-white shadow-md shadow-slate-950/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="12" x2="12" y1="1" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                <span className={isActive ? '!text-white font-semibold' : ''}>Profit & Loss</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
              </>
            )}
          </NavLink>

          {/* My Profile */}
          <NavLink
            to="/user/profile"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all ${isActive
                ? '!bg-[#0B1120] bg-slate-900 !text-white shadow-md shadow-slate-950/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span className={isActive ? '!text-white font-semibold' : ''}>My Profile</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
              </>
            )}
          </NavLink>

          {/* Admin panel link if admin */}
          {isAdmin && (
            <Link
              to="/admin/dashboard"
              onClick={onClose}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-purple-700 hover:bg-purple-50 font-medium text-sm transition-colors mt-2"
            >
              <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>Admin Panel</span>
            </Link>
          )}
        </nav>
      </div>

      {/* Sign Out / Bottom section */}
      <div className="p-6 border-t border-slate-100" data-purpose="sidebar-footer">
        <button
          onClick={async () => {
            await signOut()
            navigate('/')
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50/70 font-semibold text-sm transition-colors group"
          type="button"
        >
          <svg className="w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" x2="9" y1="12" y2="12"></line>
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}

export default function UserLayout() {
  const [open, setOpen] = useState(false)
  const [openIposCount, setOpenIposCount] = useState(0)
  const { profile } = useAuth()

  useEffect(() => {
    getOpenIpos()
      .then((ipos) => {
        if (ipos) setOpenIposCount(ipos.length)
      })
      .catch(() => { })
  }, [])

  const fullName = profile?.full_name || 'Satish Kumar'
  const shortName = fullName.split(' ')[0] + (fullName.split(' ')[1] ? ` ${fullName.split(' ')[1][0]}.` : '')

  return (
    <div className="min-h-screen flex flex-col md:flex-row antialiased bg-[#F8FAFC] selection:bg-indigo-100 selection:text-indigo-900 font-sans text-slate-900">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 lg:w-72 fixed inset-y-0 left-0 z-40">
        <Sidebar openCount={openIposCount} />
      </div>

      {/* Mobile Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={() => setOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10">
            <Sidebar onClose={() => setOpen(false)} openCount={openIposCount} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 lg:ml-72 flex flex-col min-h-screen min-w-0">
        {/* Top Utility Bar */}
        <header className="h-16 px-4 sm:px-6 lg:px-10 bg-white/80 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-20" data-purpose="top-navigation">
          <div className="flex items-center gap-3 w-full max-w-xs md:max-w-md">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setOpen(true)}
              className="md:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Search input with frosted command key styling */}
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" x2="16.65" y1="21" x2="16.65"></line>
                </svg>
              </span>
              <input
                id="global-ipo-search"
                className="w-full pl-10 pr-12 py-2 bg-slate-50/90 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all shadow-luxury-xs"
                placeholder="Search IPOs, scrip name, application ID..."
                type="text"
              />
              <kbd className="hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded shadow-xs">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Action items */}
          <div className="flex items-center gap-3.5">
            {/* Notification button */}
            <button
              aria-label="Notifications"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors relative border border-transparent hover:border-slate-200"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full ring-2 ring-white"></span>
            </button>

            <div className="h-6 w-px bg-slate-200"></div>

            {/* Quick profile trigger */}
            <Link to="/user/profile" className="flex items-center gap-2 cursor-pointer pl-1 hover:opacity-85 transition-opacity">
              {profile?.avatar_url ? (
                <img
                  alt={fullName}
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-300"
                  src={profile.avatar_url}
                />
              ) : (
                <DummyAvatar name={fullName} size="sm" />
              )}
              <span className="hidden md:block text-xs font-semibold text-slate-700">{shortName}</span>
            </Link>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
