import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  getAdminIpoDetail,
  getIpoParticipants,
  updateIpoStatus,
  getFormattedParticipantList,
} from '../../../services/ipoService'
import { formatCurrency, formatDate, formatDateTime, getIpoStatusBadgeClass, getIpoStatusLabel } from '../../../utils/formatters'

const STATUS_TRANSITIONS = {
  DRAFT:      ['OPEN', 'CANCELLED'],
  OPEN:       ['CLOSED', 'CANCELLED'],
  CLOSED:     ['PROCESSING', 'OPEN'],
  PROCESSING: ['COMPLETED', 'CLOSED'],
  COMPLETED:  [],
  CANCELLED:  [],
}

const STATUS_BTN_CLASS = {
  OPEN:       'btn bg-green-600 text-white hover:bg-green-700',
  CLOSED:     'btn bg-yellow-600 text-white hover:bg-yellow-700',
  PROCESSING: 'btn bg-blue-600 text-white hover:bg-blue-700',
  COMPLETED:  'btn bg-purple-600 text-white hover:bg-purple-700',
  CANCELLED:  'btn btn-danger',
}

export default function IpoDetails() {
  const { ipoId }  = useParams()
  const navigate   = useNavigate()

  const [ipo,          setIpo]          = useState(null)
  const [participants, setParticipants] = useState([])
  const [tab,          setTab]          = useState('investors')   // 'investors' | 'account_holders'
  const [loading,      setLoading]      = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [copying,      setCopying]      = useState(false)
  const [error,        setError]        = useState('')
  const [copyMsg,      setCopyMsg]      = useState('')

  const load = useCallback(async () => {
    try {
      const [ipoData, parts] = await Promise.all([
        getAdminIpoDetail(ipoId),
        getIpoParticipants(ipoId),
      ])
      setIpo(ipoData)
      setParticipants(parts)
    } catch (err) {
      setError('Failed to load IPO details.')
    } finally {
      setLoading(false)
    }
  }, [ipoId])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (newStatus) => {
    if (!window.confirm(`Change status to "${getIpoStatusLabel(newStatus)}"?`)) return
    setStatusLoading(true)
    try {
      const updated = await updateIpoStatus(ipoId, newStatus)
      setIpo(prev => ({ ...prev, ...updated }))
    } catch (err) {
      setError(err?.message ?? 'Failed to update status.')
    } finally {
      setStatusLoading(false)
    }
  }

  const handleCopyList = async () => {
    setCopying(true)
    try {
      const rows = await getFormattedParticipantList(ipoId)
      const text = rows.map(r =>
        `${r.serial}. ${r.full_name} (${r.participation_type === 'INVESTOR' ? `Investor - ${r.application_number ?? 'N/A'}` : 'Account Holder'})`
      ).join('\n')
      await navigator.clipboard.writeText(text)
      setCopyMsg(`✅ Copied ${rows.length} participants to clipboard`)
      setTimeout(() => setCopyMsg(''), 3000)
    } catch {
      setCopyMsg('❌ Failed to copy')
    } finally {
      setCopying(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  if (!ipo)   return <div className="alert-error max-w-lg mt-12">{error || 'IPO not found.'}</div>

  const investors     = participants.filter(p => p.participation_type === 'INVESTOR')
  const accountHolders = participants.filter(p => p.participation_type === 'ACCOUNT_HOLDER')
  const transitions   = STATUS_TRANSITIONS[ipo.status] ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link to="/admin/ipos" className="text-sm text-indigo-600 hover:underline">← Back to IPOs</Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="page-title">{ipo.ipo_name}</h1>
            <span className={getIpoStatusBadgeClass(ipo.status)}>{getIpoStatusLabel(ipo.status)}</span>
          </div>
          <p className="text-gray-400 text-sm mt-0.5">
            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{ipo.ipo_code}</code>
            {' '}&nbsp;· Created {formatDateTime(ipo.created_at)} by @{ipo.profiles?.username}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {transitions.map(s => (
            <button key={s} onClick={() => handleStatusChange(s)} disabled={statusLoading}
              className={STATUS_BTN_CLASS[s] ?? 'btn btn-secondary'}>
              {statusLoading ? <span className="spinner" /> : `→ ${getIpoStatusLabel(s)}`}
            </button>
          ))}
          {ipo.status === 'PROCESSING' && (
            <Link to={`/admin/ipos/${ipoId}/results`} className="btn bg-indigo-600 text-white hover:bg-indigo-700">
              📥 Import Results
            </Link>
          )}
          {ipo.status === 'COMPLETED' && (
            <Link to={`/admin/ipos/${ipoId}/results`} className="btn btn-secondary">View Results</Link>
          )}
        </div>
      </div>

      {error && <div className="alert-error"><span>⚠</span><span>{error}</span></div>}

      {/* IPO Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'IPO Price',    value: formatCurrency(ipo.ipo_price) },
          { label: 'Start Date',   value: formatDate(ipo.start_date) },
          { label: 'End Date',     value: formatDate(ipo.end_date) },
          { label: 'Overall Profit', value: ipo.overall_profit != null ? formatCurrency(ipo.overall_profit) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-lg font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Participation Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Participants', value: ipo.totalParticipants, color: 'text-gray-900' },
          { label: 'Investors',          value: ipo.investorCount,     color: 'text-blue-700' },
          { label: 'Account Holders',    value: ipo.accountHolderCount, color: 'text-purple-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Participants */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-1">
            {[['investors', `Investors (${investors.length})`], ['account_holders', `Acct. Holders (${accountHolders.length})`]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === key ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {copyMsg && <span className="text-xs text-gray-600">{copyMsg}</span>}
            <button onClick={handleCopyList} disabled={copying} className="btn btn-secondary btn-sm">
              {copying ? <span className="spinner" /> : '📋'} Copy Participant List
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {(tab === 'investors' ? investors : accountHolders).length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <p>No {tab === 'investors' ? 'investors' : 'account holders'} yet</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Username</th>
                  <th>Full Name</th>
                  {tab === 'investors' && <th>Application No.</th>}
                  <th>Applied On</th>
                </tr>
              </thead>
              <tbody>
                {(tab === 'investors' ? investors : accountHolders).map((p, i) => (
                  <tr key={p.id}>
                    <td className="text-gray-400 text-xs">{i + 1}</td>
                    <td className="font-medium">@{p.profiles?.username}</td>
                    <td>{p.profiles?.full_name}</td>
                    {tab === 'investors' && <td><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{p.application_number ?? '—'}</code></td>}
                    <td className="text-xs text-gray-400">{formatDateTime(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
