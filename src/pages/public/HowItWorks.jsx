const STEPS = [
  { n: 1, title: 'Admin Creates IPO', desc: 'The administrator creates a new IPO record with name, price, start date, and end date. The system auto-generates a unique IPO code (e.g., IPO1001).' },
  { n: 2, title: 'Members Register & Apply', desc: 'Group members create accounts and log in. They can view open IPOs and apply as Investor (with application number) or Account Holder.' },
  { n: 3, title: 'Admin Manages Participants', desc: 'Admin views all participants separated into Investors and Account Holders. Can generate and copy a formatted participant list for external use.' },
  { n: 4, title: 'IPO Process Completes', desc: 'The external broker runs the IPO allotment process. Admin receives a result Excel sheet with allotment, refund, profit, tax, and settlement data.' },
  { n: 5, title: 'Admin Imports Results', desc: 'Admin copies the Excel rows and pastes into the system. The system parses, validates, and matches each row to known participants.' },
  { n: 6, title: 'Preview & Confirm', desc: 'Admin reviews a preview of all parsed results. Valid rows are shown in green; invalid/unmatched rows are highlighted in red. Admin confirms to proceed.' },
  { n: 7, title: 'Results Committed', desc: 'The system atomically updates all result records and marks the IPO as COMPLETED. If anything fails, the entire transaction is rolled back.' },
  { n: 8, title: 'Members View Results', desc: 'Each member can view only their own result — allotment status, refund, profit, tax, and final settlement amount.' },
]

export default function HowItWorks() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-fade-in">
      <div className="text-center mb-12">
        <h1 className="page-title text-3xl mb-3">How It Works</h1>
        <p className="text-gray-500 max-w-xl mx-auto">A complete end-to-end workflow for group IPO tracking and result management.</p>
      </div>
      <div className="space-y-4">
        {STEPS.map(s => (
          <div key={s.n} className="card p-6 flex gap-5">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">{s.n}</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">{s.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 alert-info">
        <span>ℹ</span>
        <p className="text-sm"><strong>Privacy:</strong> All financial data is private. Members can only see their own results. Row-level database security enforces this at every level.</p>
      </div>
    </div>
  )
}
