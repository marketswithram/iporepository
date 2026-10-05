import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import {
  getIpoParticipants,
  getAdminIpoDetail,
  createImportSession,
  submitIpoResults,
} from '../../../services/ipoService'
import { parseImportText, matchRowsToParticipants } from '../../../utils/importParser'
import { formatCurrency } from '../../../utils/formatters'

export default function ImportResults() {
  const { ipoId }   = useParams()
  const { profile } = useAuth()

  const [ipo,           setIpo]           = useState(null)
  const [participants,  setParticipants]  = useState([])
  const [step,          setStep]          = useState('paste')  // paste | preview | done
  const [pasteText,     setPasteText]     = useState('')
  const [parseResult,   setParseResult]   = useState(null)
  const [overallProfit, setOverallProfit] = useState('')
  const [loading,       setLoading]       = useState(true)
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState('')
  const [submitResult,  setSubmitResult]  = useState(null)

  useEffect(() => {
    Promise.all([getAdminIpoDetail(ipoId), getIpoParticipants(ipoId)])
      .then(([ipoData, parts]) => { setIpo(ipoData); setParticipants(parts) })
      .catch(() => setError('Failed to load IPO data.'))
      .finally(() => setLoading(false))
  }, [ipoId])

  const handleParse = () => {
    if (!pasteText.trim()) { setError('Please paste result data first.'); return }
    setError('')
    const parsed  = parseImportText(pasteText)
    const matched = matchRowsToParticipants(parsed.rows, participants)
    setParseResult({ ...parsed, rows: matched })
    setStep('preview')
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setPasteText(ev.target.result)
    reader.readAsText(file)
  }

  const validRows   = parseResult?.rows.filter(r => r.isValid && r.matchStatus === 'MATCHED') ?? []
  const invalidRows = parseResult?.rows.filter(r => !r.isValid || r.matchStatus !== 'MATCHED') ?? []

  const handleConfirm = async () => {
    const num = parseFloat(String(overallProfit).replace(/[,₹\s]/g, ''))
    if (isNaN(num) || num < 0) { setError('Enter a valid non-negative overall profit.'); return }
    setError('')
    setSubmitting(true)
    try {
      const session = await createImportSession({
        ipoId, importedBy: profile.id, sourceType: 'PASTE', totalRows: parseResult.rows.length,
      })
      const results = validRows.map(row => ({
        participation_id:        row.participationId,
        applied:                 row.parsed.applied ?? false,
        allotted:                row.parsed.allotted ?? false,
        lots:                    row.parsed.lots ?? 0,
        applied_from:            row.parsed.applied_from ?? null,
        refund_amount:           row.parsed.refund ?? 0,
        profit_amount:           row.parsed.profit ?? 0,
        tax_amount:              row.parsed.tax ?? 0,
        final_settlement_amount: row.parsed.settlement ?? 0,
      }))
      const result = await submitIpoResults({ ipoId, importId: session.id, overallProfit: num, results })
      if (result?.success) { setSubmitResult(result); setStep('done') }
      else setError(result?.error ?? 'Submission failed.')
    } catch (err) {
      setError(err?.message ?? 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>

  // Done state
  if (step === 'done') return (
    <div className="max-w-lg mx-auto py-12 text-center animate-slide-up">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Results Submitted!</h2>
        <p className="text-gray-500 text-sm mb-2"><strong>{submitResult?.rows_submitted}</strong> results recorded for <strong>{ipo?.ipo_name}</strong>.</p>
        <p className="text-green-600 font-semibold mb-6">IPO status set to COMPLETED</p>
        <Link to={`/admin/ipos/${ipoId}`} className="btn bg-indigo-600 text-white hover:bg-indigo-700">← Back to IPO</Link>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link to={`/admin/ipos/${ipoId}`} className="text-sm text-indigo-600 hover:underline">← Back to {ipo?.ipo_name}</Link>
        <h1 className="page-title mt-2">Import IPO Results</h1>
        <p className="text-gray-500 text-sm mt-1">{ipo?.ipo_name} · {ipo?.ipo_code} · {participants.length} participants registered</p>
      </div>

      {error && <div className="alert-error"><span>⚠</span><span>{error}</span></div>}

      {/* STEP 1: Paste */}
      {step === 'paste' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="section-title">Step 1 — Paste or Upload Result Data</h2>
            <p className="text-sm text-gray-500 mt-1">Copy rows from Excel and paste below. Supports tab-separated and CSV formats.</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-3">
              <label htmlFor="csv-upload" className="btn btn-secondary btn-sm cursor-pointer">📁 Upload CSV / TXT</label>
              <input id="csv-upload" type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              <span className="text-sm text-gray-400">— or paste directly below —</span>
            </div>
            <textarea id="result-paste-area" value={pasteText} onChange={e => { setPasteText(e.target.value); setError('') }}
              className="input font-mono text-xs h-64 resize-y whitespace-pre"
              placeholder={`Paste CSV/Excel data here. Your column format:\nS.NO,INVESTOR NAME,AMOUNT CONTRIBUTED,APPLIED FROM,LOTS,APPLIED AMOUNT,ALLOTED?,REFUND,PROFIT SHARE,TAX RESERVE,FINAL SETTLEMENT\n1,Satish Kumar A 45,14880,Ramprakash,1,14880,No,14880,222,0,222\n2,Satish Kumar A 56,14880,Karthika Ram,1,14880,No,14880,222,888,222`} />
            <div className="alert-info text-xs">
              <span>ℹ</span>
              <div>
                <strong>Your CSV columns (in order):</strong>{' '}
                S.NO · INVESTOR NAME · AMOUNT CONTRIBUTED · APPLIED FROM · LOTS ·
                APPLIED AMOUNT · ALLOTED? · REFUND · PROFIT SHARE · TAX RESERVE · FINAL SETTLEMENT
                <br /><span className="text-gray-500">Matching order: Username → Full Name. Copy rows directly from Excel or upload as .csv</span>
              </div>
            </div>
            <button id="parse-btn" onClick={handleParse} disabled={!pasteText.trim()} className="btn bg-indigo-600 text-white hover:bg-indigo-700">
              Parse & Preview →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === 'preview' && parseResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{parseResult.rows.length}</p>
              <p className="text-sm text-gray-500">Total Detected</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{validRows.length}</p>
              <p className="text-sm text-gray-500">Valid & Matched</p>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{invalidRows.length}</p>
              <p className="text-sm text-gray-500">Invalid / Unmatched</p>
            </div>
          </div>

          {parseResult.headerErrors.length > 0 && (
            <div className="alert-warning">
              <span>⚠</span>
              <div>
                <p className="font-semibold text-sm">Header issues:</p>
                {parseResult.headerErrors.map((e, i) => <p key={i} className="text-xs mt-0.5">{e}</p>)}
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="section-title">Step 2 — Preview & Review</h2>
              <p className="text-xs text-gray-400 mt-1">🔴 Red rows will be skipped. Fix source data and re-paste to include them.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Match</th><th>Applied</th>
                    <th>Allotted</th><th>Lots</th><th>Refund</th>
                    <th>Profit</th><th>Tax</th><th>Settlement</th><th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.rows.map(row => (
                    <tr key={row.rowNumber} className={!row.isValid || row.matchStatus !== 'MATCHED' ? 'bg-red-50' : ''}>
                      <td className="text-gray-400">{row.rowNumber}</td>
                      <td className="font-medium">
                        {row.parsed.name || <span className="text-red-400">—</span>}
                        {row.matchedProfile && <p className="text-green-600">@{row.matchedProfile.username}</p>}
                      </td>
                      <td>
                        <span className={row.matchStatus === 'MATCHED' ? 'badge badge-green' : row.matchStatus === 'AMBIGUOUS' ? 'badge badge-yellow' : 'badge badge-red'}>
                          {row.matchStatus}
                        </span>
                      </td>
                      <td>{row.parsed.applied === true ? '✅' : row.parsed.applied === false ? '❌' : '?'}</td>
                      <td>{row.parsed.allotted === true ? '✅' : row.parsed.allotted === false ? '❌' : '?'}</td>
                      <td>{row.parsed.lots ?? '?'}</td>
                      <td>{row.parsed.refund != null ? formatCurrency(row.parsed.refund) : '?'}</td>
                      <td className={row.parsed.profit > 0 ? 'text-green-600' : ''}>{row.parsed.profit != null ? formatCurrency(row.parsed.profit) : '?'}</td>
                      <td>{row.parsed.tax != null ? formatCurrency(row.parsed.tax) : '?'}</td>
                      <td>{row.parsed.settlement != null ? formatCurrency(row.parsed.settlement) : '?'}</td>
                      <td>{row.errors.length > 0 && <ul className="text-red-600 space-y-0.5">{row.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overall Profit */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
            <label htmlFor="overall-profit" className="label label-required">Overall IPO Profit (group-level)</label>
            <input id="overall-profit" type="number" min="0" step="0.01" value={overallProfit} onChange={e => { setOverallProfit(e.target.value); setError('') }}
              className="input max-w-xs" placeholder="e.g. 5000" />
            <p className="helper-msg">Total group profit for this IPO. Enter numeric value (no ₹ symbol needed).</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => setStep('paste')} className="btn btn-secondary">← Re-paste Data</button>
            {validRows.length > 0 ? (
              <button id="confirm-submit-btn" onClick={handleConfirm} disabled={submitting} className="btn bg-green-600 text-white hover:bg-green-700">
                {submitting ? <><span className="spinner" />Submitting…</> : `✅ Confirm & Submit ${validRows.length} Results`}
              </button>
            ) : (
              <div className="alert-warning"><span>⚠</span><span>No valid matched records to submit.</span></div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
