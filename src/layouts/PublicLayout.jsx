import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getInitials } from '../utils/formatters'

function Navbar() {
  const { isAuthenticated, isAdmin, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('hero')

  const navItems = [
    { id: 'hero', label: 'Home' },
    { id: 'ipos', label: 'IPOs' },
    { id: 'how-it-works', label: 'How It Works' },
    { id: 'about', label: 'About' },
  ]

  // Track active section on scroll when on home page
  useEffect(() => {
    if (location.pathname !== '/') {
      setActiveSection('')
      return
    }

    const checkActiveSection = () => {
      const scrollPos = window.scrollY + 160
      const sections = ['about', 'how-it-works', 'ipos', 'hero']

      for (const sId of sections) {
        if (sId === 'hero') {
          setActiveSection('hero')
          break
        }
        const el = document.getElementById(sId)
        if (el && scrollPos >= el.offsetTop) {
          setActiveSection(sId)
          break
        }
      }
    }

    window.addEventListener('scroll', checkActiveSection, { passive: true })
    checkActiveSection()
    return () => window.removeEventListener('scroll', checkActiveSection)
  }, [location.pathname])

  const scrollToSection = (id) => {
    setOpen(false)
    if (location.pathname === '/') {
      if (id === 'hero') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        window.history.pushState(null, '', '/')
      } else {
        const el = document.getElementById(id)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          window.history.pushState(null, '', `#${id}`)
        }
      }
    } else {
      if (id === 'hero') {
        navigate('/')
      } else {
        navigate(`/#${id}`)
      }
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <button
          type="button"
          onClick={() => scrollToSection('hero')}
          className="flex items-center gap-2 group text-left cursor-pointer focus:outline-none"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-700 transition-colors shadow-sm">
            <span className="text-white font-bold text-xs">IPO</span>
          </div>
          <span className="font-bold text-gray-900 hidden sm:block">IPO Tracker</span>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => {
            const isActive = location.pathname === '/' && activeSection === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={
                  'px-3.5 py-2 text-sm rounded-lg font-medium transition-colors cursor-pointer ' +
                  (isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')
                }
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link to={isAdmin ? '/admin/dashboard' : '/user/dashboard'} className="btn btn-secondary btn-sm hidden sm:flex">
                {isAdmin ? '⚙ Admin' : '📊 Dashboard'}
              </Link>
              <div className="relative group">
                <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100">
                  <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{getInitials(profile?.full_name)}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">{profile?.username}</span>
                </button>
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1
                                opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                  <Link to="/user/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">My Profile</Link>
                  <button onClick={async () => { await signOut(); navigate('/') }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Sign Out</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link to="/login"    className="btn btn-ghost btn-sm">Log In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
            </>
          )}
          <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {open ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-2 animate-fade-in shadow-lg">
          {navItems.map(item => {
            const isActive = location.pathname === '/' && activeSection === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={
                  'w-full text-left px-3 py-2.5 text-sm rounded-lg font-medium mb-1 transition-colors ' +
                  (isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50')
                }
              >
                {item.label}
              </button>
            )
          })}
          {isAuthenticated && (
            <Link to={isAdmin ? '/admin/dashboard' : '/user/dashboard'} onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-sm text-blue-700 font-medium">Dashboard</Link>
          )}
        </div>
      )}
    </header>
  )
}

function Footer() {
  const navigate = useNavigate()
  const location = useLocation()

  const scrollToSection = (id) => {
    if (location.pathname === '/') {
      if (id === 'hero') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        window.history.pushState(null, '', '/')
      } else {
        const el = document.getElementById(id)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          window.history.pushState(null, '', `#${id}`)
        }
      }
    } else {
      if (id === 'hero') {
        navigate('/')
      } else {
        navigate(`/#${id}`)
      }
    }
  }

  return (
    <footer className="bg-gray-900 text-gray-400 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <button
              type="button"
              onClick={() => scrollToSection('hero')}
              className="flex items-center gap-2 mb-3 text-left focus:outline-none cursor-pointer"
            >
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">IPO</span>
              </div>
              <span className="text-white font-bold text-sm">IPO Tracker</span>
            </button>
            <p className="text-sm text-gray-400 leading-relaxed">
              Track IPO participation and manage group investment results. Built for transparency and collaborative investment collectives.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {[
                { id: 'hero', label: 'Home' },
                { id: 'ipos', label: 'Available & Upcoming IPOs' },
                { id: 'how-it-works', label: 'How It Works' },
                { id: 'about', label: 'About & Disclaimer' }
              ].map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Account & Access</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/login" className="hover:text-white transition-colors">Member Sign In</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Register Account</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} IPO Monitoring & Group Investment Tracker. All rights reserved.</p>
          <p className="mt-1 text-gray-600">Does not submit IPO applications directly to stock exchanges. Tracking, allotment verification, and result management only.</p>
        </div>
      </div>
    </footer>
  )
}

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  )
}
