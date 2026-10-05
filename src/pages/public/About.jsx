export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-fade-in">
      <h1 className="page-title mb-4">About IPO Tracker</h1>
      <p className="text-gray-600 leading-relaxed mb-6">
        IPO Tracker is a group investment management platform designed for investment collectives that participate in IPOs together.
        The platform helps track participation, manage results, and visualize profit & loss — all in one place.
      </p>
      <div className="card p-6 mb-6">
        <h2 className="section-title mb-3">⚠ Important Disclaimer</h2>
        <p className="text-gray-600 text-sm leading-relaxed">
          This application does <strong>NOT</strong> submit IPO applications to stock exchanges or brokers.
          It is a tracking and record-keeping tool only. All actual IPO applications must be submitted
          through authorised brokers and platforms as per SEBI regulations.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { title: 'For Members', points: ['View open IPOs', 'Record participation', 'Track your results', 'View profit & loss'] },
          { title: 'For Admins',  points: ['Create & manage IPOs', 'View all participants', 'Import Excel results', 'View group analytics'] },
        ].map(s => (
          <div key={s.title} className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">{s.title}</h3>
            <ul className="space-y-1.5">
              {s.points.map(p => (
                <li key={p} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-green-500 font-bold">✓</span>{p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
