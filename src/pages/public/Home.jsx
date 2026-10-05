import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getOpenIpos } from '../../services/ipoService'

const FEATURES = [
  { icon: '📋', title: 'Track IPO Participation', desc: "Record your group's participation — as Investors or Account Holders." },
  { icon: '📊', title: 'Result Management', desc: 'Admin imports Excel data. System validates, previews, and updates records atomically.' },
  { icon: '💰', title: 'Profit & Loss Analytics', desc: 'Each member sees their own results. Admin sees group-level analytics and reports.' },
  { icon: '🔒', title: 'Secure & Private', desc: 'Row-level security ensures no member sees another\'s financial data.' },
]

const STEPS = [
  { step: '01', title: 'Admin creates IPO',     desc: 'Admin opens a new IPO with name, price, and dates.' },
  { step: '02', title: 'Members apply',          desc: 'Group members log in and apply as Investor or Account Holder.' },
  { step: '03', title: 'Admin manages list',     desc: 'Admin views participants and copies the participant list.' },
  { step: '04', title: 'IPO process completes',  desc: 'External broker process runs. Admin receives Excel result data.' },
  { step: '05', title: 'Admin imports results',  desc: 'Admin pastes Excel data. System validates, previews, then commits.' },
  { step: '06', title: 'Members see results',    desc: 'Each member views their own allotment, profit, and settlement.' },
]

export default function Home() {
  const [openCount, setOpenCount] = useState(null)
  useEffect(() => { getOpenIpos().then(d => setOpenCount(d.length)).catch(() => setOpenCount(0)) }, [])

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-blue-800/50 rounded-full px-4 py-1.5 text-sm font-medium mb-6 border border-blue-500/40">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {openCount !== null ? (openCount > 0 ? `${openCount} IPO${openCount > 1 ? 's' : ''} currently open` : 'No active IPOs right now') : 'Loading…'}
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 text-balance">
              Group IPO Tracking<span className="text-blue-200"> Made Simple</span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 leading-relaxed max-w-2xl">
              Track your investment group's IPO participation, manage results from Excel, and see your profit & loss — all in one secure platform.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" className="btn btn-lg bg-white text-blue-700 hover:bg-blue-50 shadow-lg font-semibold">Get Started Free</Link>
              <Link to="/ipos" className="btn btn-lg border border-blue-400 text-white hover:bg-blue-600/50">View Open IPOs</Link>
            </div>
            <p className="mt-4 text-blue-300 text-xs">⚠ This platform tracks participation only. It does not submit applications to stock exchanges.</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything your group needs</h2>
          <p className="text-gray-500 max-w-xl mx-auto">A complete system for IPO participation tracking and result management.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="card p-6 hover:shadow-md transition-shadow duration-200">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">How It Works</h2>
            <p className="text-gray-400 max-w-xl mx-auto">From IPO creation to result settlement — a complete workflow.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {STEPS.map(s => (
              <div key={s.step} className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-colors">
                <span className="text-blue-400 font-mono font-bold text-2xl">{s.step}</span>
                <h3 className="text-white font-semibold mt-2 mb-1">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-blue-600 rounded-2xl p-10 md:p-14 text-center text-white">
          <h2 className="text-3xl font-bold mb-3">Ready to track your group's IPOs?</h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">Create an account and join your investment group.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn btn-lg bg-white text-blue-700 hover:bg-blue-50 font-semibold shadow-md">Create Account</Link>
            <Link to="/login"    className="btn btn-lg border border-blue-400 text-white hover:bg-blue-700">Sign In</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
