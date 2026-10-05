import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getInitials } from '../utils/formatters'

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard',      icon: '📊', end: true },
  { to: '/admin/ipos',      label: 'IPO Management', icon: '📋' },
  { to: '/admin/users',     label: 'Users',          icon: '👥' },
  { to: '/admin/reports',   label: 'Reports',        icon: '📈' },
]

function Sidebar({ onClose }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col h-full">
      <div className="px-4 py-5 border-b border-gray-800">
        <Link to="/admin/dashboard" className="flex items-center gap-2" onClick={onClose}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">⚙</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">IPO Tracker</p>
            <p className="text-indigo-400 text-xs">Admin Panel</p>
          </div>
        </Link>
      </div>
      <div className="px-4 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">{getInitials(profile?.full_name)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile?.full_name}</p>
            <p className="text-xs text-indigo-400 truncate">Administrator</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose}
            className={({ isActive }) =>
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ' +
              (isActive ? 'bg-indigo-900/60 text-indigo-300 border-l-2 border-indigo-500' : 'text-gray-400 hover:bg-gray-800 hover:text-white')}>
            <span>{item.icon}</span>{item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-800 space-y-1">
        <Link to="/user/dashboard" onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
          <span>👤</span>User View
        </Link>
        <button onClick={async () => { await signOut(); navigate('/') }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors">
          <span>🚪</span>Sign Out
        </button>
      </div>
    </aside>
  )
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen flex bg-gray-100">
      <div className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 z-40">
        <Sidebar />
      </div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 z-50"><Sidebar onClose={() => setOpen(false)} /></div>
        </div>
      )}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <div className="md:hidden bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold">Admin Panel</span>
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full"><Outlet /></main>
      </div>
    </div>
  )
}
