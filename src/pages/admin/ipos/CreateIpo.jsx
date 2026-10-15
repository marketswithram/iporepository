import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { createIpo, createIpoWithDetails } from '../../../services/ipoService'
import { formatCurrency } from '../../../utils/formatters'
import { safeParseIpoJson } from '../../../utils/ipoJsonParser'
import { validateIpoJson } from '../../../utils/ipoJsonValidator'
import IpoPreview from '../../../components/ipo/IpoPreview'

export default function CreateIpo() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  // Mode: 'manual' | 'import'
  const [mode, setMode] = useState('manual')

  const [form, setForm] = useState({ ipoName: '', ipoPrice: '', startDate: '', endDate: '', status: 'OPEN' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  // JSON Import State
  const [jsonInput, setJsonInput] = useState('')
  const [parseError, setParseError] = useState('')
  const [parseWarnings, setParseWarnings] = useState([])
  const [isValidating, setIsValidating] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [pasteSuccess, setPasteSuccess] = useState('')

  const today = new Date().toISOString().split('T')[0]

  // Validate Manual Form
  const validateManual = () => {
    const e = {}
    if (!form.ipoName.trim()) e.ipoName = 'IPO name is required'
    if (!form.ipoPrice) e.ipoPrice = 'IPO price is required'
    else if (isNaN(Number(form.ipoPrice)) || Number(form.ipoPrice) <= 0) e.ipoPrice = 'Price must be a positive number'
    if (!form.startDate) e.startDate = 'Start date is required'
    if (!form.endDate) e.endDate = 'End date is required'
    else if (form.startDate && form.endDate < form.startDate) e.endDate = 'End date must be on or after start date'
    return e
  }

  // Submit Manual Form
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    setApiError('')
    const errs = validateManual()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const ipo = await createIpo({
        ipoName: form.ipoName.trim(),
        ipoPrice: Number(form.ipoPrice),
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
        createdBy: profile.id,
      })
      navigate(`/admin/ipos/${ipo.id}`)
    } catch (err) {
      setApiError(err?.message ?? 'Failed to create IPO.')
    } finally {
      setLoading(false)
    }
  }

  // Handle JSON Paste Action
  const handlePasteClipboard = async () => {
    setParseError('')
    setPasteSuccess('')
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        if (text) {
          setJsonInput(text)
          setPasteSuccess('Pasted from clipboard!')
          setTimeout(() => setPasteSuccess(''), 3000)
          return
        }
      }
    } catch {
      // Permission denied or not supported; gracefully notify user
    }
    setPasteSuccess('Please use Ctrl+V or Cmd+V to paste directly into the box.')
    setTimeout(() => setPasteSuccess(''), 4000)
  }

  // Handle JSON Clear Action
  const handleClearJson = () => {
    if (jsonInput.trim() && !window.confirm('Clear all entered JSON text?')) return
    setJsonInput('')
    setParseError('')
    setParseWarnings([])
    setPreviewData(null)
  }

  // Parse & Preview JSON (Does NOT write to Supabase)
  const handlePreviewJson = () => {
    setParseError('')
    setParseWarnings([])
    setApiError('')

    if (!jsonInput.trim()) {
      setParseError('Please paste an IPO JSON payload first.')
      return
    }

    setIsValidating(true)
    try {
      const parseRes = safeParseIpoJson(jsonInput)
      if (!parseRes.success) {
        setParseError(parseRes.error)
        setIsValidating(false)
        return
      }

      const valRes = validateIpoJson(parseRes.data)
      setParseWarnings(valRes.warnings || [])

      if (!valRes.isValid) {
        setParseError(valRes.errors.join(' | '))
        setIsValidating(false)
        return
      }

      // Store normalized canonical representation in React state
      setPreviewData(valRes.canonicalData)
    } catch (err) {
      setParseError(err?.message || 'An unexpected error occurred while analyzing the JSON.')
    } finally {
      setIsValidating(false)
    }
  }

  // Final confirmation to save the imported IPO to Supabase
  const handleConfirmImportCreate = async () => {
    if (!previewData) return
    setApiError('')
    setLoading(true)

    try {
      const created = await createIpoWithDetails({
        ipoName: previewData.ipo_name,
        ipoPrice: Number(previewData.ipo_price),
        startDate: previewData.start_date,
        endDate: previewData.end_date,
        status: 'OPEN',
        createdBy: profile.id,
        details: previewData.details,
      })

      if (created?.id) {
        navigate(`/admin/ipos/${created.id}`)
      } else {
        navigate('/admin/ipos')
      }
    } catch (err) {
      console.error('Failed to create IPO from JSON:', err)
      setApiError(err?.message || 'Failed to save IPO to database.')
    } finally {
      setLoading(false)
    }
  }

  const setManualField = (field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }))
    setErrors(p => ({ ...p, [field]: '' }))
    setApiError('')
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <Link to="/admin/ipos" className="text-sm text-indigo-600 hover:underline">← Back to IPOs</Link>
        <h1 className="page-title mt-2">Create New IPO</h1>
        <p className="text-gray-500 text-sm mt-1">
          Choose between manual 4-field entry or importing a complete JSON prospectus from IPO Gyani.
        </p>
      </div>

      {apiError && (
        <div className="alert-error">
          <span>⚠</span>
          <span>{apiError}</span>
        </div>
      )}

      {/* Mode Selection Tabs (Only show if not in preview mode) */}
      {!previewData && (
        <div className="flex border-b border-gray-200 gap-4">
          <button
            type="button"
            onClick={() => { setMode('manual'); setApiError('') }}
            className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${
              mode === 'manual'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ✍ Manual Entry
          </button>
          <button
            type="button"
            onClick={() => { setMode('import'); setApiError('') }}
            className={`pb-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-1.5 ${
              mode === 'import'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>📄 Import IPO JSON</span>
            <span className="badge badge-purple text-[10px] px-1.5 py-0.2">New</span>
          </button>
        </div>
      )}

      {/* 1. MANUAL ENTRY TAB */}
      {mode === 'manual' && !previewData && (
        <div className="max-w-xl mx-auto">
          <div className="card">
            <div className="card-body">
              <form onSubmit={handleManualSubmit} noValidate className="space-y-5">
                <div>
                  <label htmlFor="ipo-name" className="label label-required">IPO Name</label>
                  <input
                    id="ipo-name"
                    type="text"
                    value={form.ipoName}
                    onChange={setManualField('ipoName')}
                    className={`input ${errors.ipoName ? 'input-error' : ''}`}
                    placeholder="e.g. BTA, ABC Corp"
                    disabled={loading}
                  />
                  {errors.ipoName && <p className="error-msg">{errors.ipoName}</p>}
                </div>

                <div>
                  <label htmlFor="ipo-price" className="label label-required">IPO Price (₹)</label>
                  <input
                    id="ipo-price"
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.ipoPrice}
                    onChange={setManualField('ipoPrice')}
                    className={`input ${errors.ipoPrice ? 'input-error' : ''}`}
                    placeholder="e.g. 14919"
                    disabled={loading}
                  />
                  {errors.ipoPrice ? (
                    <p className="error-msg">{errors.ipoPrice}</p>
                  ) : (
                    form.ipoPrice && Number(form.ipoPrice) > 0 && (
                      <p className="helper-msg">= {formatCurrency(Number(form.ipoPrice))}</p>
                    )
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ipo-start" className="label label-required">Start Date</label>
                    <input
                      id="ipo-start"
                      type="date"
                      min={today}
                      value={form.startDate}
                      onChange={setManualField('startDate')}
                      className={`input ${errors.startDate ? 'input-error' : ''}`}
                      disabled={loading}
                    />
                    {errors.startDate && <p className="error-msg">{errors.startDate}</p>}
                  </div>
                  <div>
                    <label htmlFor="ipo-end" className="label label-required">End Date</label>
                    <input
                      id="ipo-end"
                      type="date"
                      min={form.startDate || today}
                      value={form.endDate}
                      onChange={setManualField('endDate')}
                      className={`input ${errors.endDate ? 'input-error' : ''}`}
                      disabled={loading}
                    />
                    {errors.endDate && <p className="error-msg">{errors.endDate}</p>}
                  </div>
                </div>

                <div>
                  <label className="label">Initial Status</label>
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, status: 'OPEN' }))}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                        form.status === 'OPEN'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      ✅ Publish Now (OPEN)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, status: 'DRAFT' }))}
                      className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                        form.status === 'DRAFT'
                          ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      📋 Save as Draft
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {form.status === 'OPEN' ? 'IPO will be immediately visible to users.' : 'IPO will be hidden from users until published.'}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    id="create-ipo-submit"
                    type="submit"
                    disabled={loading}
                    className="btn bg-indigo-600 text-white hover:bg-indigo-700 flex-1 btn-lg"
                  >
                    {loading ? <><span className="spinner" />Creating…</> : 'Create IPO'}
                  </button>
                  <Link to="/admin/ipos" className="btn btn-secondary btn-lg">Cancel</Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2. IMPORT JSON TAB (INPUT STAGE) */}
      {mode === 'import' && !previewData && (
        <div className="card">
          <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="section-title text-base">Paste IPO Gyani JSON</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Paste the full JSON object including <code>ipo_details</code>, <code>ipo_dates</code>, <code>gmp</code>, <code>subscription</code>, etc.
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="btn btn-secondary btn-sm"
              >
                📋 Paste JSON
              </button>
              <button
                type="button"
                onClick={handleClearJson}
                disabled={!jsonInput}
                className="btn btn-secondary btn-sm text-red-600 hover:text-red-700"
              >
                🗑 Clear
              </button>
            </div>
          </div>

          <div className="card-body space-y-4">
            {pasteSuccess && (
              <div className="alert-info text-xs py-2">
                <span>ℹ</span>
                <span>{pasteSuccess}</span>
              </div>
            )}

            {parseError && (
              <div className="alert-error">
                <span>⚠</span>
                <span className="text-xs font-mono">{parseError}</span>
              </div>
            )}

            <div>
              <label htmlFor="json-textarea" className="label flex justify-between items-center">
                <span>JSON Payload</span>
                <span className="text-xs text-gray-400 font-normal">
                  {jsonInput.length ? `${jsonInput.length} characters` : 'Double-quotes required'}
                </span>
              </label>
              <textarea
                id="json-textarea"
                rows={16}
                value={jsonInput}
                onChange={e => { setJsonInput(e.target.value); setParseError('') }}
                placeholder='{\n  "ipo_details": {\n    "ipo_name": "Sample IPO",\n    "maximum_price": 150,\n    "lot_size": 100\n  },\n  "ipo_dates": {\n    "opening_date": "2026-10-20",\n    "closing_date": "2026-10-24"\n  }\n}'
                className="w-full font-mono text-xs p-3.5 bg-gray-900 text-gray-100 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
                spellCheck="false"
              />
            </div>

            <div className="alert-info text-xs">
              <span>ℹ</span>
              <span>
                Clicking <strong>Preview IPO</strong> will parse and validate the JSON in your browser without saving anything to the database. You will see every detail and can edit it before creating.
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handlePreviewJson}
                disabled={isValidating || !jsonInput.trim()}
                className="btn bg-indigo-600 text-white hover:bg-indigo-700 flex-1 btn-lg shadow-sm"
              >
                {isValidating ? <><span className="spinner" />Validating…</> : '🔍 Preview IPO'}
              </button>
              <Link to="/admin/ipos" className="btn btn-secondary btn-lg">Cancel</Link>
            </div>
          </div>
        </div>
      )}

      {/* 3. IMPORT JSON PREVIEW STAGE */}
      {previewData && (
        <div className="space-y-4">
          {parseWarnings.length > 0 && (
            <div className="alert-warning text-xs space-y-1">
              <p className="font-semibold">Import Warnings & Notes:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {parseWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <IpoPreview
            canonicalData={previewData}
            onUpdateCanonical={setPreviewData}
            onConfirmCreate={handleConfirmImportCreate}
            onBackToEditor={() => setPreviewData(null)}
            creating={loading}
            apiError={apiError}
          />
        </div>
      )}
    </div>
  )
}
