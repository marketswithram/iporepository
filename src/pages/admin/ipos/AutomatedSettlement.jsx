import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import {
  getAdminIpoDetail,
  getIpoParticipants,
  getAdminIpos,
  createImportSession,
  submitIpoResults,
  recordSettlementRun,
  getLatestSettlementRun,
} from '../../../services/ipoService'
import {
  generateSettlementPreview,
  roundTo,
} from '../../../utils/settlementCalculator'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getIpoStatusBadgeClass,
  getIpoStatusLabel,
} from '../../../utils/formatters'
import { getParticipantDisplayNames } from '../../../utils/adminParticipant'

export default function AutomatedSettlement() {
  const { ipoId: routeIpoId } = useParams()
  const { profile }           = useAuth()
  const navigate              = useNavigate()

  // --- Core State ---
  const [selectedIpoId, setSelectedIpoId]   = useState(routeIpoId || '')
  const [availableIpos, setAvailableIpos]   = useState([])
  const [ipo, setIpo]                       = useState(null)
  const [allApplicants, setAllApplicants]   = useState([])
  const [existingResults, setExistingResults] = useState(null)
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [infoMsg, setInfoMsg]               = useState('')

  // --- Calculation Configuration State ---
  const [taxRate, setTaxRate]               = useState(0.20)
  const [lotSizeInput, setLotSizeInput]     = useState(1)
  const [issuePriceInput, setIssuePriceInput] = useState('') // per-share cut-off / issue price

  // --- Selected Allotted Applicants State ---
  // Map of applicantId -> { sellingPrice: string|number, sellingCharge: string|number, lots: number }
  const [allottedInputs, setAllottedInputs] = useState({})
  const [applicantSearch, setApplicantSearch] = useState('')
  const [applicantFilter, setApplicantFilter] = useState('ALL') // ALL | SELECTED | UNSELECTED
  const [isDropdownOpen, setIsDropdownOpen]   = useState(false)
  const dropdownRef                         = useRef(null)

  // --- Preview & Results State ---
  const [preview, setPreview]               = useState(null)
  const [previewFilter, setPreviewFilter]   = useState('ALL') // ALL | ALLOTTED | NOT_ALLOTTED
  const [previewSearch, setPreviewSearch]   = useState('')
  const [calculating, setCalculating]       = useState(false)
  const [calculationErrors, setCalculationErrors] = useState([])

  // --- Publication State ---
  const [submitting, setSubmitting]         = useState(false)
  const [submitSuccess, setSubmitSuccess]   = useState(null)
  const [confirmRepublish, setConfirmRepublish] = useState(false)
  const [copyMsg, setCopyMsg]               = useState('')

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 1. Load available IPOs for selector
  useEffect(() => {
    getAdminIpos({ page: 1, pageSize: 100 })
      .then(({ data }) => setAvailableIpos(data || []))
      .catch(err => console.warn('Could not load IPOs list:', err))
  }, [])

  // Sync route param with state
  useEffect(() => {
    if (routeIpoId && routeIpoId !== selectedIpoId) {
      setSelectedIpoId(routeIpoId)
    }
  }, [routeIpoId])

  // 2. Load IPO details & participants when selectedIpoId changes
  useEffect(() => {
    if (!selectedIpoId) {
      setLoading(false)
      return
    }

    let isMounted = true
    setLoading(true)
    setError('')
    setInfoMsg('')
    setPreview(null)
    setSubmitSuccess(null)
    setCalculationErrors([])

    Promise.all([
      getAdminIpoDetail(selectedIpoId),
      getIpoParticipants(selectedIpoId),
      getLatestSettlementRun(selectedIpoId),
    ])
      .then(([ipoData, participants, latestRun]) => {
        if (!isMounted) return

        setIpo(ipoData)

        // Resolve lot size: prefer ipo_details.lot_size, fallback to 1
        const resolvedLotSize = Number(
          ipoData?.details?.lot_size ||
          ipoData?.lot_size ||
          ipoData?.details?.lot_size_details?.minimum_lot_size ||
          1
        )
        const safeLotSize = resolvedLotSize > 0 ? resolvedLotSize : 1
        setLotSizeInput(safeLotSize)

        // Resolve per-share issue price: ipos.ipo_price is the per-LOT application amount
        // (cut-off price × lot size), so the share price comes from ipo_details instead.
        const cutoff   = Number(ipoData?.details?.cutoff_price)
        const maxPrice = Number(ipoData?.details?.max_price)
        const perLot   = Number(ipoData?.ipo_price)
        const resolvedIssuePrice =
          cutoff > 0   ? cutoff :
          maxPrice > 0 ? maxPrice :
          perLot > 0   ? roundTo(perLot / safeLotSize, 2) : ''
        setIssuePriceInput(resolvedIssuePrice)

        // Normalize participants
        const normalized = (participants || []).map((p, idx) => {
          // The default admin participant shows "markets with ram" for both names
          const { investorName, accountHolderName: appliedFrom, isAdminDefault } = getParticipantDisplayNames(p)
          const amountContributed = Number(p.amount_contributed || ipoData?.ipo_price || 0)

          return {
            id: p.id,
            serial: idx + 1,
            investor_name: investorName,
            investor_username: p.investor?.username || p.profiles?.username || '',
            applied_from: appliedFrom,
            amount_contributed: amountContributed,
            applied_amount: amountContributed,
            lots: 1,
            application_number: p.application_number || '—',
            participation_type: p.participation_type,
            is_admin_default: isAdminDefault,
          }
        })
        setAllApplicants(normalized)

        // If latestRun exists, prefill previous inputs
        if (latestRun?.selected_applicants && Array.isArray(latestRun.selected_applicants)) {
          const prefill = {}
          latestRun.selected_applicants.forEach(sel => {
            if (sel.participationId || sel.id) {
              prefill[sel.participationId || sel.id] = {
                sellingPrice: sel.sellingPrice,
                sellingCharge: sel.sellingCharge,
                lots: sel.lots || 1,
              }
            }
          })
          setAllottedInputs(prefill)
          setInfoMsg('Restored previous settlement configuration from audit history.')
        } else {
          setAllottedInputs({})
        }

        if (ipoData?.status === 'COMPLETED') {
          setExistingResults(true)
        } else {
          setExistingResults(false)
        }
      })
      .catch(err => {
        if (isMounted) setError(err?.message || 'Failed to load IPO settlement data.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => { isMounted = false }
  }, [selectedIpoId])

  // --- Handlers for Applicant Selection ---
  const handleToggleApplicant = (applicantId) => {
    setAllottedInputs(prev => {
      const copy = { ...prev }
      if (copy[applicantId]) {
        delete copy[applicantId]
      } else {
        copy[applicantId] = {
          sellingPrice: '',
          sellingCharge: '',
          lots: 1,
        }
      }
      return copy
    })
    setPreview(null) // invalidate preview
  }

  const handleSelectAll = () => {
    const updated = { ...allottedInputs }
    allApplicants.forEach(app => {
      if (!updated[app.id]) {
        updated[app.id] = { sellingPrice: '', sellingCharge: '', lots: 1 }
      }
    })
    setAllottedInputs(updated)
    setPreview(null)
  }

  const handleClearAll = () => {
    setAllottedInputs({})
    setPreview(null)
  }

  const handleInputChange = (applicantId, field, value) => {
    setAllottedInputs(prev => ({
      ...prev,
      [applicantId]: {
        ...prev[applicantId],
        [field]: value,
      },
    }))
    setPreview(null)
  }

  // --- Filtering Applicants for Selection ---
  const filteredApplicants = useMemo(() => {
    return allApplicants.filter(app => {
      const isSelected = !!allottedInputs[app.id]
      if (applicantFilter === 'SELECTED' && !isSelected) return false
      if (applicantFilter === 'UNSELECTED' && isSelected) return false

      if (!applicantSearch.trim()) return true
      const q = applicantSearch.toLowerCase()
      return (
        app.investor_name?.toLowerCase().includes(q) ||
        app.applied_from?.toLowerCase().includes(q) ||
        app.application_number?.toLowerCase().includes(q) ||
        app.investor_username?.toLowerCase().includes(q)
      )
    })
  }, [allApplicants, allottedInputs, applicantFilter, applicantSearch])

  const selectedCount = Object.keys(allottedInputs).length
  const totalCount    = allApplicants.length
  const unselectedCount = totalCount - selectedCount

  // Total amount contributed across all applicants
  const totalContributedAll = useMemo(() => {
    return allApplicants.reduce((sum, a) => sum + (Number(a.amount_contributed) || 0), 0)
  }, [allApplicants])

  // --- Calculate Results Action ---
  const handleCalculate = () => {
    setCalculationErrors([])
    setError('')
    const errors = []

    if (!ipo) {
      errors.push('No IPO loaded.')
      setCalculationErrors(errors)
      return
    }

    if (allApplicants.length === 0) {
      errors.push('This IPO has no applicants. Settlement cannot be generated.')
      setCalculationErrors(errors)
      return
    }

    if (selectedCount === 0) {
      errors.push('At least one allotted applicant must be selected.')
      setCalculationErrors(errors)
      return
    }

    const lotSizeNum = Number(lotSizeInput)
    if (!Number.isFinite(lotSizeNum) || lotSizeNum <= 0) {
      errors.push('Lot size must be a positive integer.')
    }

    const issuePriceNum = Number(issuePriceInput)
    if (!Number.isFinite(issuePriceNum) || issuePriceNum <= 0) {
      errors.push('Cut-off / issue price must be a positive amount per share.')
    }

    const taxRateNum = Number(taxRate)
    if (!Number.isFinite(taxRateNum) || taxRateNum < 0 || taxRateNum > 1) {
      errors.push('Tax rate must be a valid number between 0 and 1 (e.g. 0.20 for 20%).')
    }

    // Build selected applicants array with validation
    const selectedList = []
    for (const [applicantId, input] of Object.entries(allottedInputs)) {
      const applicant = allApplicants.find(a => a.id === applicantId)
      const name = applicant ? applicant.applied_from : applicantId

      const price = parseFloat(String(input.sellingPrice).replace(/[^0-9.]/g, ''))
      const charge = input.sellingCharge === '' ? 0 : parseFloat(String(input.sellingCharge).replace(/[^0-9.]/g, ''))
      const lots = parseInt(input.lots || 1, 10)

      if (!Number.isFinite(price) || price <= 0) {
        errors.push(`Selling Price for ${name} must be a valid positive amount.`)
      }
      if (!Number.isFinite(charge) || charge < 0) {
        errors.push(`Selling Charge for ${name} must be a valid non-negative amount.`)
      }
      if (!Number.isFinite(lots) || lots <= 0) {
        errors.push(`Lots for ${name} must be a positive integer.`)
      }

      selectedList.push({
        participationId: applicantId,
        id: applicantId,
        sellingPrice: price,
        sellingCharge: charge,
        lots,
        investorName: name,
      })
    }

    if (errors.length > 0) {
      setCalculationErrors(errors)
      return
    }

    setCalculating(true)
    try {
      const previewResult = generateSettlementPreview({
        ipo: {
          ipo_name: ipo.ipo_name,
          ipo_price: issuePriceNum, // per-share cut-off price, not the per-lot amount
          lot_size: lotSizeNum,
        },
        allApplicants,
        selectedApplicants: selectedList,
        taxRate: taxRateNum,
      })

      setPreview(previewResult)
      setInfoMsg('Preview calculated successfully! Review the calculation summary and applicant rows below.')
    } catch (calcErr) {
      setCalculationErrors([calcErr?.message || 'Calculation error occurred.'])
    } finally {
      setCalculating(false)
    }
  }

  // --- Publish Results Action ---
  const handlePublish = async () => {
    if (!preview) {
      setError('Please calculate and verify the results preview before publishing.')
      return
    }

    if (existingResults && !confirmRepublish) {
      setError('Results have already been published. Check the confirmation box to republish.')
      return
    }

    if (!window.confirm(`Are you sure you want to publish settlement results for ${ipo.ipo_name}? This will complete the IPO and update user balances.`)) {
      return
    }

    setSubmitting(true)
    setError('')

    try {
      // 1. Create import session
      const session = await createImportSession({
        ipoId: ipo.id,
        importedBy: profile.id,
        sourceType: 'AUTOMATED',
        totalRows: preview.rows.length,
      })

      // 2. Prepare payload for submit_ipo_results RPC
      const resultsPayload = preview.rows.map(r => ({
        participation_id:        r.participationId,
        applied:                 true,
        allotted:                r.allotted,
        lots:                    r.lots || 0,
        applied_from:            r.appliedFrom,
        refund_amount:           r.refund,
        profit_amount:           r.profitShare,
        tax_amount:              r.taxReserve,
        final_settlement_amount: r.finalSettlement,
      }))

      // 3. Submit atomically to Supabase
      const submitRes = await submitIpoResults({
        ipoId: ipo.id,
        importId: session?.id || null,
        overallProfit: preview.overallProfit,
        results: resultsPayload,
      })

      if (!submitRes?.success) {
        throw new Error(submitRes?.error || 'Database submission failed.')
      }

      // 4. Audit settlement run snapshot
      const selectedAuditList = Object.entries(allottedInputs).map(([id, inp]) => ({
        participationId: id,
        sellingPrice: Number(inp.sellingPrice),
        sellingCharge: Number(inp.sellingCharge || 0),
        lots: Number(inp.lots || 1),
      }))

      await recordSettlementRun({
        ipoId: ipo.id,
        publishedBy: profile.id,
        effectiveSellingPrice: preview.summary.effectiveSellingPrice,
        totalSellingCharges: preview.summary.totalSellingCharges,
        totalAllottedLots: preview.summary.totalAllottedLots,
        totalProfit: preview.summary.totalProfit,
        totalTaxReserve: preview.summary.totalTaxReserve,
        distributableProfit: preview.summary.distributableProfit,
        totalContributed: preview.summary.totalAmountContributed,
        sumProfitShares: preview.summary.sumProfitShares,
        roundingResidual: preview.summary.roundingResidual,
        taxRate: preview.summary.taxRate,
        selectedApplicants: selectedAuditList,
        settlementSummary: preview.summary,
        status: 'PUBLISHED',
      })

      setSubmitSuccess({
        rowsSubmitted: submitRes.rows_submitted || preview.rows.length,
        overallProfit: preview.overallProfit,
        distributableProfit: preview.summary.distributableProfit,
      })
      setExistingResults(true)
    } catch (pubErr) {
      setError(pubErr?.message || 'Publication failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Copy TSV to Clipboard for Excel Verification ---
  const handleCopyTSV = () => {
    if (!preview?.rows) return
    const headers = [
      'S.NO',
      'INVESTOR NAME',
      'AMOUNT CONTRIBUTED',
      'APPLIED FROM',
      'LOTS',
      'APPLIED AMOUNT',
      'ALLOTTED?',
      'REFUND',
      'PROFIT SHARE',
      'TAX RESERVE',
      'FINAL SETTLEMENT',
    ]

    const lines = [headers.join('\t')]
    preview.rows.forEach(r => {
      lines.push([
        r.serial,
        r.investorName,
        r.amountContributed,
        r.appliedFrom,
        r.lots,
        r.appliedAmount,
        r.allotted ? 'Yes' : 'No',
        r.refund,
        r.profitShare,
        r.taxReserve,
        r.finalSettlement,
      ].join('\t'))
    })

    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => {
        setCopyMsg('✓ Copied 11-column settlement TSV to clipboard!')
        setTimeout(() => setCopyMsg(''), 4000)
      })
      .catch(() => setCopyMsg(' Could not copy to clipboard.'))
  }

  // --- Filtered Preview Rows ---
  const filteredPreviewRows = useMemo(() => {
    if (!preview?.rows) return []
    return preview.rows.filter(r => {
      if (previewFilter === 'ALLOTTED' && !r.allotted) return false
      if (previewFilter === 'NOT_ALLOTTED' && r.allotted) return false
      if (!previewSearch.trim()) return true
      const q = previewSearch.toLowerCase()
      return (
        r.investorName?.toLowerCase().includes(q) ||
        r.appliedFrom?.toLowerCase().includes(q)
      )
    })
  }, [preview, previewFilter, previewSearch])

  // --- Render Success State ---
  if (submitSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center animate-slide-up">
        <div className="card p-10 bg-white border border-gray-200 shadow-lg">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Settlement Published Successfully!</h2>
          <p className="text-gray-600 text-sm mb-6">
            Settlement results for <strong>{ipo?.ipo_name}</strong> have been published to all participants.
          </p>

          <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left border border-gray-200 grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-500 uppercase font-semibold">Total Results Published</span>
              <p className="text-lg font-bold text-gray-900">{submitSuccess.rowsSubmitted} records</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase font-semibold">Distributable Profit</span>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(submitSuccess.distributableProfit)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase font-semibold">Overall Recorded Profit</span>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(submitSuccess.overallProfit)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase font-semibold">New IPO Status</span>
              <p className="text-lg font-bold text-green-600">COMPLETED</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link to={`/admin/ipos/${ipo.id}`} className="btn btn-primary">
              ← Return to IPO Details
            </Link>
            <Link to={`/ipos/${ipo.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              View Public Page ↗
            </Link>
            <button onClick={() => setSubmitSuccess(null)} className="btn btn-ghost text-sm">
              Review Calculations Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link to="/admin/ipos" className="hover:text-indigo-600">IPO Management</Link>
            <span>/</span>
            {ipo ? (
              <Link to={`/admin/ipos/${ipo.id}`} className="hover:text-indigo-600">{ipo.ipo_name}</Link>
            ) : <span>Select IPO</span>}
            <span>/</span>
            <span className="text-gray-900 font-medium">Automated Settlement</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="page-title text-2xl font-bold text-gray-900">
              Automated IPO Settlement
            </h1>
            {ipo && (
              <span className={getIpoStatusBadgeClass(ipo.status)}>
                {getIpoStatusLabel(ipo.status)}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Deterministic profit calculation, tax reserve allocation, and settlement generation derived from the canonical Moneyview model.
          </p>
        </div>

        {/* Action Controls & IPO Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {availableIpos.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="ipo-selector" className="text-xs text-gray-500 font-medium whitespace-nowrap">Switch IPO:</label>
              <select
                id="ipo-selector"
                value={selectedIpoId}
                onChange={e => {
                  setSelectedIpoId(e.target.value)
                  navigate(`/admin/ipos/${e.target.value}/automated-settlement`)
                }}
                className="input text-xs py-1.5 px-2 w-auto max-w-[200px]"
              >
                <option value="">-- Choose IPO --</option>
                {availableIpos.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.ipo_name} ({i.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {ipo && (
            <Link to={`/admin/ipos/${ipo.id}`} className="btn btn-secondary btn-sm">
              ← Back to IPO
            </Link>
          )}
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="alert-error flex items-start justify-between">
          <span> {error}</span>
          <button onClick={() => setError('')} className="text-xs font-bold ml-2">×</button>
        </div>
      )}
      {infoMsg && (
        <div className="alert-info flex items-start justify-between">
          <span> {infoMsg}</span>
          <button onClick={() => setInfoMsg('')} className="text-xs font-bold ml-2">×</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !ipo ? (
        <div className="card p-12 text-center max-w-md mx-auto">
          <p className="text-4xl mb-3"> </p>
          <h3 className="text-lg font-bold text-gray-800 mb-1">Select an IPO to Begin Settlement</h3>
          <p className="text-xs text-gray-500 mb-4">Choose an active or processing IPO from the dropdown above to load its real applicants and generate results.</p>
          <Link to="/admin/ipos" className="btn btn-primary btn-sm">Browse IPOs</Link>
        </div>
      ) : (
        <>
          {/* Status & Warning Notice if Already Completed */}
          {existingResults && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-lg"> </span>
                <div>
                  <p className="font-semibold">Results Already Published</p>
                  <p className="text-xs text-amber-700">
                    This IPO is marked as <strong>COMPLETED</strong>. Re-calculating or publishing will update the existing published settlement rows.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-xs bg-white px-3 py-1.5 rounded-lg border border-amber-300">
                <input
                  type="checkbox"
                  checked={confirmRepublish}
                  onChange={e => setConfirmRepublish(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Allow Re-publication</span>
              </label>
            </div>
          )}

          {/* Top IPO Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="fintech-card p-4 rounded-xl">
              <span className="text-xs text-gray-500 font-medium">Cut-off / Issue Price (per share)</span>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-base font-bold text-gray-900">₹</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={issuePriceInput}
                  onChange={e => {
                    setIssuePriceInput(e.target.value)
                    setPreview(null)
                  }}
                  className="input py-0.5 px-2 text-base font-bold text-gray-900 w-24 h-8"
                />
              </div>
              <span className="text-[11px] text-gray-400">Per lot: {formatCurrency(ipo.ipo_price)}</span>
            </div>

            <div className="fintech-card p-4 rounded-xl">
              <div className="flex justify-between items-start">
                <span className="text-xs text-gray-500 font-medium">Lot Size (Shares)</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={lotSizeInput}
                  onChange={e => {
                    setLotSizeInput(e.target.value)
                    setPreview(null)
                  }}
                  className="input py-0.5 px-2 text-base font-bold text-gray-900 w-24 h-8"
                />
                <span className="text-xs text-gray-400">shares</span>
              </div>
              <span className="text-[11px] text-gray-400">From prospectus or custom</span>
            </div>

            <div className="fintech-card p-4 rounded-xl">
              <span className="text-xs text-gray-500 font-medium">Total Applicants</span>
              <p className="text-xl font-bold text-indigo-600 mt-1">{totalCount}</p>
              <span className="text-[11px] text-gray-400">Active participations</span>
            </div>

            <div className="fintech-card p-4 rounded-xl">
              <span className="text-xs text-gray-500 font-medium">Total Contributed</span>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalContributedAll)}</p>
              <span className="text-[11px] text-gray-400">Denominator for shares</span>
            </div>

            <div className="fintech-card p-4 rounded-xl">
              <span className="text-xs text-gray-500 font-medium">Tax Rate</span>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={taxRate}
                  onChange={e => {
                    setTaxRate(parseFloat(e.target.value) || 0)
                    setPreview(null)
                  }}
                  className="input py-0.5 px-2 text-base font-bold text-gray-900 w-20 h-8"
                />
                <span className="text-xs text-gray-600 font-semibold">({Math.round(taxRate * 100)}%)</span>
              </div>
              <span className="text-[11px] text-gray-400">Default 20% tax reserve</span>
            </div>
          </div>

          {/* SECTION A — Allotted Applicant Selection & Selling Inputs */}
          <div className="card shadow-sm border border-gray-200">
            <div className="card-header bg-gray-50/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>1. Allotted Applicant Selection & Selling Inputs</span>
                  <span className="badge badge-blue">{selectedCount} Selected</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select the applicants who received share allotment, then enter their selling price and transaction charges.
                </p>
              </div>

              {/* Quick Select Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  Select All ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={selectedCount === 0}
                  className="btn btn-secondary btn-sm text-xs text-red-600 hover:text-red-700"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            <div className="card-body space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={applicantSearch}
                    onChange={e => setApplicantSearch(e.target.value)}
                    placeholder="Search applicants by account holder, investor name, or app no..."
                    className="input text-xs pl-8"
                  />
                  <span className="absolute left-2.5 top-2.5 text-gray-400 text-xs"> </span>
                  {applicantSearch && (
                    <button
                      onClick={() => setApplicantSearch('')}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-100 text-xs">
                  {[
                    ['ALL', `All (${totalCount})`],
                    ['SELECTED', `Selected (${selectedCount})`],
                    ['UNSELECTED', `Remaining (${unselectedCount})`],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setApplicantFilter(key)}
                      className={`px-3 py-1 rounded-md font-medium transition-colors ${
                        applicantFilter === key
                          ? 'bg-white text-gray-900 shadow-xs font-semibold'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Applicant Checkbox Selector Chips & Dropdown Panel */}
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 max-h-52 overflow-y-auto">
                {filteredApplicants.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No matching applicants found.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filteredApplicants.map(app => {
                      const isSelected = !!allottedInputs[app.id]
                      return (
                        <label
                          key={app.id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-medium shadow-xs'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleApplicant(app.id)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold truncate">{app.applied_from}</span>
                              <span className="text-[10px] text-gray-400">#{app.serial}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 truncate">
                              Investor: {app.investor_name} · {formatCurrency(app.amount_contributed)}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Inputs Table for Selected Applicants */}
              {selectedCount > 0 ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Allotted Applicants Selling Details ({selectedCount})
                    </h3>
                    <span className="text-xs text-gray-400">
                      Arithmetic mean of selling prices will form the Effective Selling Price.
                    </span>
                  </div>

                  <div className="table-wrapper border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="table text-xs">
                      <thead className="bg-gray-100/75">
                        <tr>
                          <th className="w-12">#</th>
                          <th>Account Holder</th>
                          <th>Investor</th>
                          <th className="w-40">Share Sold At (₹) *</th>
                          <th className="w-40">Selling Charges (₹) *</th>
                          <th className="w-24">Lots</th>
                          <th className="w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {Object.keys(allottedInputs).map((applicantId, idx) => {
                          const applicant = allApplicants.find(a => a.id === applicantId)
                          const input = allottedInputs[applicantId] || {}
                          const priceVal = parseFloat(input.sellingPrice)
                          const chargeVal = parseFloat(input.sellingCharge)
                          const isPriceInvalid = input.sellingPrice !== '' && (!Number.isFinite(priceVal) || priceVal <= 0)
                          const isChargeInvalid = input.sellingCharge !== '' && (!Number.isFinite(chargeVal) || chargeVal < 0)

                          return (
                            <tr key={applicantId} className="hover:bg-gray-50/70">
                              <td className="text-gray-400 font-mono">{idx + 1}</td>
                              <td className="font-semibold text-gray-900">
                                {applicant ? applicant.applied_from : applicantId}
                              </td>
                              <td className="text-gray-600">
                                {applicant ? applicant.investor_name : '—'}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  placeholder="e.g. 59.23"
                                  value={input.sellingPrice ?? ''}
                                  onChange={e => handleInputChange(applicantId, 'sellingPrice', e.target.value)}
                                  className={`input py-1 px-2 text-xs font-mono ${isPriceInvalid ? 'input-error' : ''}`}
                                />
                                {isPriceInvalid && (
                                  <span className="text-[10px] text-red-500 block mt-0.5">Must be &gt; 0</span>
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="e.g. 40.93"
                                  value={input.sellingCharge ?? ''}
                                  onChange={e => handleInputChange(applicantId, 'sellingCharge', e.target.value)}
                                  className={`input py-1 px-2 text-xs font-mono ${isChargeInvalid ? 'input-error' : ''}`}
                                />
                                {isChargeInvalid && (
                                  <span className="text-[10px] text-red-500 block mt-0.5">Cannot be negative</span>
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={input.lots ?? 1}
                                  onChange={e => handleInputChange(applicantId, 'lots', parseInt(e.target.value, 10) || 1)}
                                  className="input py-1 px-2 text-xs font-mono text-center"
                                />
                              </td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  onClick={() => handleToggleApplicant(applicantId)}
                                  className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded"
                                  title="Deselect this applicant"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                  <p className="text-sm font-semibold text-gray-700">No allotted applicants selected yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Select one or more applicants above to enter their selling prices and calculate the settlement.</p>
                </div>
              )}

              {/* Validation Errors Box */}
              {calculationErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <span> </span> Please resolve the following before calculating:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    {calculationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Calculate Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCalculate}
                  disabled={selectedCount === 0 || calculating}
                  className="btn bg-indigo-600 text-white hover:bg-indigo-700 font-semibold px-6 py-2.5 shadow-sm"
                >
                  {calculating ? (
                    <>
                      <span className="spinner" /> Calculating...
                    </>
                  ) : (
                    <>
                      Calculate Results
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SECTION B & C — Preview & Calculation Summary (visible after calculation) */}
          {preview && (
            <div className="space-y-6 animate-slide-up">
              {/* SECTION B: Calculation Summary Card */}
              <div className="card shadow-sm border border-gray-200 bg-white">
                <div className="card-header bg-gradient-to-r from-gray-50 to-indigo-50/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <span>2. Calculation Summary & Financial Reconciliations</span>
                      {Math.abs(preview.summary.roundingResidual) <= 1 ? (
                        <span className="badge badge-green">✓ Reconciled within ₹1</span>
                      ) : (
                        <span className="badge badge-yellow">Residual Alert</span>
                      )}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Formula-verified metrics based on arithmetic selling price average and proportional distribution.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyTSV}
                    className="btn btn-secondary btn-sm text-xs font-semibold"
                  >
                    Copy 11-Col TSV for Excel
                  </button>
                </div>

                <div className="card-body">
                  {copyMsg && (
                    <div className="mb-4 text-xs font-medium text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                      {copyMsg}
                    </div>
                  )}

                  {/* Summary Metric Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-gray-50/80 p-3 rounded-lg border border-gray-200/80">
                      <span className="text-[11px] text-gray-500 font-medium">Effective Selling Price</span>
                      <p className="text-base font-bold text-gray-900 mt-0.5">
                        {formatCurrency(preview.summary.effectiveSellingPrice)}
                      </p>
                      <span className="text-[10px] text-gray-400">Mean of {preview.summary.allottedApplicants} prices</span>
                    </div>

                    <div className="bg-gray-50/80 p-3 rounded-lg border border-gray-200/80">
                      <span className="text-[11px] text-gray-500 font-medium">Total Selling Charges</span>
                      <p className="text-base font-bold text-gray-900 mt-0.5">
                        {formatCurrency(preview.summary.totalSellingCharges)}
                      </p>
                      <span className="text-[10px] text-gray-400">Sum of selected fees</span>
                    </div>

                    <div className="bg-gray-50/80 p-3 rounded-lg border border-gray-200/80">
                      <span className="text-[11px] text-gray-500 font-medium">Total IPO Profit</span>
                      <p className="text-base font-bold text-indigo-700 mt-0.5">
                        {formatCurrency(preview.summary.totalProfit)}
                      </p>
                      <span className="text-[10px] text-gray-400">(Avg Price - Cut-off) × Lot Size × Lots</span>
                    </div>

                    <div className="bg-gray-50/80 p-3 rounded-lg border border-gray-200/80">
                      <span className="text-[11px] text-gray-500 font-medium">Tax Reserve (20%)</span>
                      <p className="text-base font-bold text-gray-900 mt-0.5">
                        {formatCurrency(preview.summary.totalTaxReserve)}
                      </p>
                      <span className="text-[10px] text-gray-400">Reserved for allotted rows</span>
                    </div>

                    <div className="bg-gray-50/80 p-3 rounded-lg border border-gray-200/80">
                      <span className="text-[11px] text-gray-500 font-medium">Distributable Profit</span>
                      <p className="text-base font-bold text-emerald-700 mt-0.5">
                        {formatCurrency(preview.summary.distributableProfit)}
                      </p>
                      <span className="text-[10px] text-gray-400">Profit - Tax Reserve - Charges</span>
                    </div>

                    <div className="bg-gray-50/80 p-3 rounded-lg border border-gray-200/80">
                      <span className="text-[11px] text-gray-500 font-medium">Sum of Profit Shares</span>
                      <p className="text-base font-bold text-gray-900 mt-0.5">
                        {formatCurrency(preview.summary.sumProfitShares)}
                      </p>
                      <span className="text-[10px] text-gray-400">Distributed to all {totalCount}</span>
                    </div>
                  </div>

                  {/* Residuals & Reconciliation Note */}
                  <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-4 text-gray-600">
                      <span><strong>Total Allotted Lots:</strong> {preview.summary.totalAllottedLots}</span>
                      <span><strong>Total Contributed Denominator:</strong> {formatCurrency(preview.summary.totalAmountContributed)}</span>
                      <span>
                        <strong>Rounding Residual:</strong>{' '}
                        <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">
                          ₹{preview.summary.roundingResidual}
                        </code>
                      </span>
                    </div>

                    {preview.warnings && preview.warnings.length > 0 && (
                      <span className="text-amber-700 font-medium">
                        Note: {preview.warnings.join(' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION C: Complete Settlement Preview Table */}
              <div className="card shadow-sm border border-gray-200 bg-white">
                <div className="card-header bg-gray-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      3. Complete Settlement Preview (11 Columns)
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Includes all {totalCount} applicants. Each applicant receives a proportional profit share; allotted applicants receive tax reserve.
                    </p>
                  </div>

                  {/* Search & Filter within Preview Table */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={previewSearch}
                      onChange={e => setPreviewSearch(e.target.value)}
                      placeholder="Filter preview by name..."
                      className="input text-xs py-1 px-2.5 w-44"
                    />

                    <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5 bg-gray-100 text-xs">
                      {[
                        ['ALL', `All (${totalCount})`],
                        ['ALLOTTED', `Allotted (${preview.summary.allottedApplicants})`],
                        ['NOT_ALLOTTED', `Non-Allotted (${totalCount - preview.summary.allottedApplicants})`],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPreviewFilter(key)}
                          className={`px-2.5 py-0.5 rounded-md font-medium ${
                            previewFilter === key
                              ? 'bg-white text-gray-900 shadow-xs font-semibold'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="table-wrapper border-0 rounded-none overflow-x-auto">
                  <table className="table text-xs">
                    <thead>
                      <tr className="bg-gray-100/80 text-gray-600">
                        <th className="w-10">S.No</th>
                        <th>Investor Name</th>
                        <th className="text-right">Amount Contributed (₹)</th>
                        <th>Applied From</th>
                        <th className="text-center w-14">Lots</th>
                        <th className="text-right">Applied Amount (₹)</th>
                        <th className="text-center w-20">Allotted?</th>
                        <th className="text-right">Refund (₹)</th>
                        <th className="text-right">Profit Share (₹)</th>
                        <th className="text-right">Tax Reserve (₹)</th>
                        <th className="text-right font-bold text-gray-900">Final Settlement (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPreviewRows.map(row => (
                        <tr
                          key={row.participationId}
                          className={`hover:bg-gray-50/80 ${row.allotted ? 'bg-indigo-50/20' : ''}`}
                        >
                          <td className="text-gray-400 font-mono">{row.serial}</td>
                          <td className="font-semibold text-gray-900">{row.investorName}</td>
                          <td className="text-right font-mono text-gray-700">{formatCurrency(row.amountContributed)}</td>
                          <td className="text-gray-600">{row.appliedFrom}</td>
                          <td className="text-center font-mono">{row.lots}</td>
                          <td className="text-right font-mono text-gray-700">{formatCurrency(row.appliedAmount)}</td>
                          <td className="text-center">
                            {row.allotted ? (
                              <span className="badge badge-green font-semibold">Yes</span>
                            ) : (
                              <span className="badge badge-gray">No</span>
                            )}
                          </td>
                          <td className="text-right font-mono text-gray-700">{formatCurrency(row.refund)}</td>
                          <td className="text-right font-mono text-emerald-700 font-semibold">{formatCurrency(row.profitShare)}</td>
                          <td className="text-right font-mono text-gray-700">{formatCurrency(row.taxReserve)}</td>
                          <td className="text-right font-mono font-bold text-gray-900 bg-gray-50/50">
                            {formatCurrency(row.finalSettlement)}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Table Totals Footer */}
                    <tfoot className="bg-gray-100/90 font-bold text-gray-900 border-t-2 border-gray-200">
                      <tr>
                        <td colSpan={2} className="py-2.5">Totals ({preview.rows.length} applicants)</td>
                        <td className="text-right font-mono">{formatCurrency(preview.summary.totalAmountContributed)}</td>
                        <td colSpan={2}></td>
                        <td className="text-right font-mono">{formatCurrency(preview.summary.totalAmountContributed)}</td>
                        <td className="text-center">{preview.summary.allottedApplicants} Yes</td>
                        <td className="text-right font-mono">{formatCurrency(preview.summary.totalAmountContributed)}</td>
                        <td className="text-right font-mono text-emerald-800">{formatCurrency(preview.summary.sumProfitShares)}</td>
                        <td className="text-right font-mono">{formatCurrency(preview.summary.sumTaxReserves)}</td>
                        <td className="text-right font-mono font-extrabold text-indigo-900 bg-indigo-50/50">
                          {formatCurrency(roundTo(preview.summary.sumProfitShares + preview.summary.sumTaxReserves, 2))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* SECTION D: Publication Action Bar */}
              <div className="card shadow-md border-2 border-indigo-200 bg-gradient-to-r from-indigo-50/50 via-white to-emerald-50/30 p-6 rounded-xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <span>4. Review and Publish Results</span>
                      <span className="badge badge-blue">Ready to Publish</span>
                    </h3>
                    <p className="text-xs text-gray-600 mt-1 max-w-xl">
                      Publishing will atomically persist {preview.rows.length} result records, update the IPO status to <strong>COMPLETED</strong>, and distribute profit shares according to the 80/20 investor / account holder business rule.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      className="btn btn-secondary text-xs"
                      disabled={submitting}
                    >
                      Recalculate / Edit Inputs
                    </button>

                    <button
                      type="button"
                      onClick={handlePublish}
                      disabled={submitting || (existingResults && !confirmRepublish)}
                      className="btn bg-emerald-600 text-white hover:bg-emerald-700 font-bold px-6 py-2.5 text-sm shadow-sm"
                    >
                      {submitting ? (
                        <>
                          <span className="spinner" /> Publishing Results...
                        </>
                      ) : (
                        <>
                          Publish Results to Users
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}