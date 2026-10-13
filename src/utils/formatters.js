// Formatting utilities for the IPO Tracker

export function formatCurrency(value, decimals = 0) {
  if (value === null || value === undefined) return '—'
  const num = Number(value)
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: decimals, maximumFractionDigits: 2,
  }).format(num)
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '—'
  const num = Number(value)
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('en-IN').format(num)
}

export function formatDate(value) {
  if (!value) return '—'
  try {
    const str = String(value).trim()
    let d
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      d = new Date(str + 'T00:00:00')
    } else {
      d = new Date(str)
    }
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
  } catch { return '—' }
}

export function formatDateTime(value) {
  if (!value) return '—'
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
    })
  } catch { return '—' }
}

export function getIpoStatusBadgeClass(status) {
  const map = { DRAFT: 'badge-gray', OPEN: 'badge-green', CLOSED: 'badge-yellow', PROCESSING: 'badge-blue', COMPLETED: 'badge-purple', CANCELLED: 'badge-red' }
  return map[status] ?? 'badge-gray'
}

export function getIpoStatusLabel(status) {
  const map = { DRAFT: 'Draft', OPEN: 'Open', CLOSED: 'Closed', PROCESSING: 'Processing', COMPLETED: 'Completed', CANCELLED: 'Cancelled' }
  return map[status] ?? status
}

export function getResultStatusBadgeClass(status) {
  const map = { PENDING: 'badge-gray', ALLOTTED: 'badge-green', NOT_ALLOTTED: 'badge-red', REFUNDED: 'badge-blue' }
  return map[status] ?? 'badge-gray'
}

export function formatProfitLoss(value) {
  const num = Number(value ?? 0)
  if (isNaN(num)) return { formatted: '—', colorClass: 'text-gray-500' }
  const abs = Math.abs(num)
  const formatted = formatCurrency(abs)
  if (num > 0) return { formatted: `+${formatted}`, colorClass: 'text-green-600 font-semibold' }
  if (num < 0) return { formatted: `-${formatted}`, colorClass: 'text-red-600 font-semibold' }
  return { formatted, colorClass: 'text-gray-600' }
}

export function parseNumericFromImport(value) {
  if (value === null || value === undefined) return null
  const cleaned = String(value).replace(/[₹,\s]/g, '').trim()
  if (cleaned === '' || cleaned === '-') return 0
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

export function parseBooleanFromImport(value) {
  if (value === null || value === undefined) return null
  const str = String(value).toLowerCase().trim()
  if (['yes', 'true', '1', 'y'].includes(str)) return true
  if (['no', 'false', '0', 'n'].includes(str)) return false
  return null
}

export function getInitials(fullName) {
  if (!fullName) return '?'
  return fullName.split(' ').filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('')
}

export function truncate(text, maxLength = 50) {
  if (!text) return ''
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text
}
