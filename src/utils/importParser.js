import { parseNumericFromImport, parseBooleanFromImport } from './formatters'

// =============================================================================
// Header normalization map
// Maps every recognized column name variation → canonical field name
// YOUR FORMAT: S.NO | NAME/INVESTOR NAME | AMOUNT CONTRIBUTED | APPLIED FROM |
//              LOTS | APPLIED AMOUNT | ALLOTED? | REFUND | PROFIT SHARE |
//              TAX RESERVE | FINAL SETTLEMENT
// =============================================================================
const HEADER_MAP = {
  // serial / row number
  's.no': 'serial',      'serial no': 'serial',   'serial': 'serial',
  's no': 'serial',      'sr no': 'serial',        'sr. no.': 'serial',
  'no.': 'serial',       'no': 'serial',           'sno': 'serial',

  // participant name
  'name': 'name',
  'investor name': 'name',
  'participant name': 'name',
  'holder name': 'name',
  'account name': 'name',
  'account holder name': 'name',
  'member name': 'name',

  // amount contributed / investment
  'amount': 'amount',
  'amount contributed': 'amount',
  'ipo amount': 'amount',
  'invested amount': 'amount',
  'investment': 'amount',
  'contribution': 'amount',

  // applied from / dp id / source
  'applied from': 'applied_from',
  'applied_from': 'applied_from',
  'source': 'applied_from',
  'dp id': 'applied_from',
  'dp': 'applied_from',
  'from': 'applied_from',

  // lots
  'lots': 'lots',
  'no of lots': 'lots',
  'lot count': 'lots',
  'no. of lots': 'lots',
  'number of lots': 'lots',
  'shares': 'lots',

  // applied amount (numeric) — we derive applied=Yes when this > 0
  'applied amount': 'applied_amount',
  'applied_amount': 'applied_amount',
  'amt applied': 'applied_amount',

  // applied (Yes/No boolean) — optional if applied_amount column present
  'applied': 'applied',
  'is applied': 'applied',
  'applied?': 'applied',
  'application status': 'applied',
  'applied status': 'applied',

  // allotted (Yes/No boolean) — also handles "alloted" typo and "?" suffix
  'allotted': 'allotted',
  'allotted?': 'allotted',
  'alloted': 'allotted',
  'alloted?': 'allotted',      // extra alias for the ? variant
  'allotment': 'allotted',
  'allotment status': 'allotted',
  'is allotted': 'allotted',
  'is alloted': 'allotted',
  'allotment?': 'allotted',

  // refund
  'refund': 'refund',
  'refund amount': 'refund',
  'refunded amount': 'refund',
  'refund amt': 'refund',

  // profit (covers PROFIT SHARE)
  'profit': 'profit',
  'profit amount': 'profit',
  'profit share': 'profit',
  'gain': 'profit',
  'net gain': 'profit',
  'profit/loss': 'profit',

  // tax (covers TAX RESERVE)
  'tax': 'tax',
  'tax amount': 'tax',
  'tax reserve': 'tax',
  'tds': 'tax',
  'tds amount': 'tax',
  'tax deducted': 'tax',

  // settlement (covers FINAL SETTLEMENT)
  'settlement': 'settlement',
  'final settlement': 'settlement',
  'final settlement amount': 'settlement',
  'net settlement': 'settlement',
  'settlement amount': 'settlement',
  'final amount': 'settlement',
}

function normalizeHeader(raw) {
  // Strip special chars like ?, *, # but keep spaces and letters
  const cleaned = String(raw)
    .toLowerCase()
    .replace(/[_*#]/g, ' ')
    .replace(/\?/g, '')     // remove trailing ? from "ALLOTED?"
    .replace(/\s+/g, ' ')
    .trim()
  return HEADER_MAP[cleaned] ?? null
}

function detectDelimiter(text) {
  const firstLine = text.split('\n')[0] ?? ''
  const tabCount   = (firstLine.match(/\t/g) ?? []).length
  const commaCount = (firstLine.match(/,/g) ?? []).length
  return tabCount >= commaCount ? '\t' : ','
}

function splitLine(line, delimiter) {
  if (delimiter === '\t') return line.split('\t')
  const result = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

/**
 * Main parser — supports your exact CSV format:
 * S.NO | INVESTOR NAME | AMOUNT CONTRIBUTED | APPLIED FROM | LOTS |
 * APPLIED AMOUNT | ALLOTED? | REFUND | PROFIT SHARE | TAX RESERVE | FINAL SETTLEMENT
 */
export function parseImportText(rawText) {
  if (!rawText?.trim()) return { headers: [], rows: [], headerErrors: ['No data provided'] }

  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim())

  if (lines.length < 2) return { headers: [], rows: [], headerErrors: ['Need at least 2 rows (header + data)'] }

  const delimiter   = detectDelimiter(rawText)
  const rawHeaders  = splitLine(lines[0], delimiter).map(h => h.trim())
  const headerErrors = []
  const canonicalHdrs = rawHeaders.map(h => {
    const c = normalizeHeader(h)
    if (!c) headerErrors.push(`Unrecognized column: "${h}" (will be ignored)`)
    return c
  })

  // Check for required columns — 'applied' is now OPTIONAL if 'applied_amount' present
  const hasApplied       = canonicalHdrs.includes('applied')
  const hasAppliedAmount = canonicalHdrs.includes('applied_amount')
  const REQUIRED = ['name', 'allotted', 'refund', 'profit', 'tax', 'settlement']
  if (!hasApplied && !hasAppliedAmount) {
    REQUIRED.push('applied') // only require explicit applied if no applied_amount either
  }
  REQUIRED.forEach(req => {
    if (!canonicalHdrs.includes(req)) headerErrors.push(`Required column missing: "${req}"`)
  })

  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const cells  = splitLine(lines[i], delimiter).map(c => c.trim())
    const raw    = {}
    const parsed = {}
    const errors = []

    canonicalHdrs.forEach((hdr, idx) => { if (hdr) raw[hdr] = cells[idx] ?? '' })

    // ── Serial
    parsed.serial = raw.serial ? parseInt(raw.serial, 10) : i

    // ── Name
    parsed.name = (raw.name ?? '').trim()
    if (!parsed.name) errors.push('Name is required')

    // ── Applied From
    parsed.applied_from = (raw.applied_from ?? '').trim() || null

    // ── Amount
    if (raw.amount !== undefined) {
      parsed.amount = parseNumericFromImport(raw.amount)
      if (parsed.amount === null) errors.push('Invalid amount value')
    }

    // ── Applied Amount (numeric column in your format)
    let appliedAmount = null
    if (raw.applied_amount !== undefined) {
      appliedAmount = parseNumericFromImport(raw.applied_amount)
    }

    // ── Lots
    parsed.lots = raw.lots ? parseInt(String(raw.lots).replace(/,/g, ''), 10) : 0
    if (isNaN(parsed.lots)) parsed.lots = 0

    // ── Applied (boolean)
    if (raw.applied !== undefined) {
      // Explicit Yes/No column present
      parsed.applied = parseBooleanFromImport(raw.applied)
      if (parsed.applied === null) errors.push('Invalid "applied" value (expected Yes/No)')
    } else if (appliedAmount !== null) {
      // Derive: applied = true if applied_amount > 0
      parsed.applied = appliedAmount > 0
    } else if (parsed.lots > 0) {
      // Fallback: if lots > 0, they must have applied
      parsed.applied = true
    } else {
      // Default: assume applied = true (they are in the list)
      parsed.applied = true
    }

    // ── Allotted (boolean) — handles "ALLOTED?" with ? stripped by normalizer
    parsed.allotted = parseBooleanFromImport(raw.allotted)
    if (parsed.allotted === null) errors.push('Invalid "allotted" value (expected Yes/No)')

    // ── Monetary fields
    parsed.refund     = parseNumericFromImport(raw.refund)
    parsed.profit     = parseNumericFromImport(raw.profit)
    parsed.tax        = parseNumericFromImport(raw.tax)
    parsed.settlement = parseNumericFromImport(raw.settlement)

    if (parsed.refund     === null) errors.push('Invalid refund amount')
    if (parsed.profit     === null) errors.push('Invalid profit amount')
    if (parsed.tax        === null) errors.push('Invalid tax amount')
    if (parsed.settlement === null) errors.push('Invalid settlement amount')

    // Note: LOTS here = lots applied for, not lots received.
    // So Allotted=No + Lots=1 is valid (applied for 1 lot, not allotted).
    // Only flag if Allotted=Yes but Lots=0 (inconsistent — allotted but no lots recorded).
    if (parsed.allotted === true && parsed.lots === 0) errors.push('Allotted is Yes but Lots is 0')

    rows.push({
      rowNumber: i,
      raw,
      parsed,
      isValid: errors.length === 0,
      errors,
      matchStatus: 'UNMATCHED',
      participationId: null,
    })
  }

  return { headers: canonicalHdrs.filter(Boolean), rows, headerErrors }
}

/**
 * Match parsed rows to known participants.
 * Hierarchy: Application Number → Username → Full Name
 */
export function matchRowsToParticipants(rows, participants) {
  const byAppNum   = new Map()
  const byUsername = new Map()
  const byName     = new Map()

  for (const p of participants) {
    if (p.application_number) byAppNum.set(p.application_number.toLowerCase(), p)
    const un = (p.profiles?.username ?? '').toLowerCase()
    if (un) { if (!byUsername.has(un)) byUsername.set(un, []); byUsername.get(un).push(p) }
    const fn = (p.profiles?.full_name ?? '').toLowerCase()
    if (fn) { if (!byName.has(fn)) byName.set(fn, []); byName.get(fn).push(p) }
  }

  return rows.map(row => {
    const name = (row.parsed.name ?? '').toLowerCase()

    // 1. By application_number
    const appMatch = row.raw.application_number
      ? byAppNum.get(row.raw.application_number.toLowerCase())
      : null
    if (appMatch) return { ...row, matchStatus: 'MATCHED', participationId: appMatch.id, matchedProfile: appMatch.profiles }

    // 2. By username (exact, case-insensitive)
    const userMatches = byUsername.get(name) ?? []
    if (userMatches.length === 1) return { ...row, matchStatus: 'MATCHED', participationId: userMatches[0].id, matchedProfile: userMatches[0].profiles }
    if (userMatches.length > 1)  return { ...row, matchStatus: 'AMBIGUOUS', isValid: false, errors: [...row.errors, 'Multiple participants match username: ' + name] }

    // 3. By full_name (case-insensitive)
    const nameMatches = byName.get(name) ?? []
    if (nameMatches.length === 1) return { ...row, matchStatus: 'MATCHED', participationId: nameMatches[0].id, matchedProfile: nameMatches[0].profiles }
    if (nameMatches.length > 1)  return { ...row, matchStatus: 'AMBIGUOUS', isValid: false, errors: [...row.errors, 'Multiple participants share the same name: ' + row.parsed.name] }

    return {
      ...row,
      matchStatus: 'UNMATCHED',
      isValid: false,
      errors: [...row.errors, 'No participant found matching: ' + row.parsed.name],
    }
  })
}
