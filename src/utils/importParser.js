import { parseNumericFromImport, parseBooleanFromImport } from './formatters.js'
import { ADMIN_DISPLAY_NAME } from './adminParticipant.js'

// =============================================================================
// Header normalization map
// Maps every recognized column name variation → canonical field name
// EXPECTED FORMAT (11 columns):
// S.NO | INVESTOR NAME | AMOUNT CONTRIBUTED | APPLIED FROM |
// LOTS | APPLIED AMOUNT | ALLOTED? | REFUND | PROFIT SHARE |
// TAX RESERVE | FINAL SETTLEMENT
// =============================================================================
const HEADER_MAP = {
  // serial / row number
  's.no': 'serial',      'serial no': 'serial',   'serial': 'serial',
  's no': 'serial',      'sr no': 'serial',        'sr. no.': 'serial',
  'no.': 'serial',       'no': 'serial',           'sno': 'serial',

  // participant / investor name (col 2)
  'name': 'name',
  'investor name': 'name',
  'participant name': 'name',
  'holder name': 'name',
  'account name': 'name',
  'account holder name': 'name',
  'member name': 'name',

  // amount contributed / investment (col 3)
  'amount': 'amount',
  'amount contributed': 'amount',
  'ipo amount': 'amount',
  'invested amount': 'amount',
  'investment': 'amount',
  'contribution': 'amount',

  // applied from / account holder / source (col 4)
  'applied from': 'applied_from',
  'applied_from': 'applied_from',
  'source': 'applied_from',
  'dp id': 'applied_from',
  'dp': 'applied_from',
  'from': 'applied_from',
  'account holder': 'applied_from',

  // lots (col 5)
  'lots': 'lots',
  'no of lots': 'lots',
  'lot count': 'lots',
  'no. of lots': 'lots',
  'number of lots': 'lots',
  'shares': 'lots',

  // applied amount (numeric col 6) — derive applied=Yes when this > 0
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
  'alloted?': 'allotted',
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
  const cleaned = String(raw)
    .toLowerCase()
    .replace(/[_*#]/g, ' ')
    .replace(/\?/g, '')     // remove trailing ? from "ALLOTED?"
    .replace(/\s+/g, ' ')
    .trim()
  return HEADER_MAP[cleaned] ?? null
}

function detectDelimiter(text) {
  const firstLine = text.split('\n')[0] ?? ''
  const tabCount   = (firstLine.match(/\t/g) ?? []).length
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
 * Main parser — supports 11-column format:
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

  const delimiter   = detectDelimiter(rawText)
  const rawHeaders  = splitLine(lines[0], delimiter).map(h => h.trim())
  const headerErrors = []
  const canonicalHdrs = rawHeaders.map(h => {
    const c = normalizeHeader(h)
    if (!c) headerErrors.push(`Unrecognized column: "${h}" (will be ignored)`)
    return c
  })

  // Check for required columns — 'applied' is OPTIONAL if 'applied_amount' present
  const hasApplied       = canonicalHdrs.includes('applied')
  const hasAppliedAmount = canonicalHdrs.includes('applied_amount')
  const REQUIRED = ['name', 'allotted', 'refund', 'profit', 'tax', 'settlement']
  if (!hasApplied && !hasAppliedAmount) {
    REQUIRED.push('applied')
  }
  REQUIRED.forEach(req => {
    if (!canonicalHdrs.includes(req)) headerErrors.push(`Required column missing: "${req}"`)
  })

  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const cells  = splitLine(lines[i], delimiter).map(c => c.trim())
    const raw    = {}
    const parsed = {}
    const errors = []

    canonicalHdrs.forEach((hdr, idx) => { if (hdr) raw[hdr] = cells[idx] ?? '' })

    // ── Serial
    parsed.serial = raw.serial ? parseInt(raw.serial, 10) : i

    // ── Investor Name (the actual investor)
    parsed.name = (raw.name ?? '').trim()
    if (!parsed.name) errors.push('Investor Name is required')

    // ── Applied From (the account holder)
    parsed.applied_from = (raw.applied_from ?? '').trim() || null

    // ── Amount Contributed
    if (raw.amount !== undefined) {
      parsed.amount = parseNumericFromImport(raw.amount)
      if (parsed.amount === null) errors.push('Invalid amount value')
    }

    // ── Applied Amount (numeric column)
    let appliedAmount = null
    if (raw.applied_amount !== undefined) {
      appliedAmount = parseNumericFromImport(raw.applied_amount)
    }

    // ── Lots
    parsed.lots = raw.lots ? parseInt(String(raw.lots).replace(/,/g, ''), 10) : 0
    if (isNaN(parsed.lots)) parsed.lots = 0

    // ── Applied (boolean)
    if (raw.applied !== undefined) {
      parsed.applied = parseBooleanFromImport(raw.applied)
      if (parsed.applied === null) errors.push('Invalid "applied" value (expected Yes/No)')
    } else if (appliedAmount !== null) {
      parsed.applied = appliedAmount > 0
    } else if (parsed.lots > 0) {
      parsed.applied = true
    } else {
      parsed.applied = true
    }

    // ── Allotted (boolean)
    parsed.allotted = parseBooleanFromImport(raw.allotted)
    if (parsed.allotted === null) errors.push('Invalid "allotted" value (expected Yes/No)')

    // ── Monetary fields
    parsed.refund     = parseNumericFromImport(raw.refund)
    parsed.profit     = parseNumericFromImport(raw.profit)
    parsed.tax        = parseNumericFromImport(raw.tax)
    parsed.settlement = parseNumericFromImport(raw.settlement)

    if (parsed.refund     === null) errors.push('Invalid refund amount')
    if (parsed.profit     === null) errors.push('Invalid profit amount')
    if (parsed.tax        === null) errors.push('Invalid tax amount')
    if (parsed.settlement === null) errors.push('Invalid settlement amount')

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
 * Match parsed rows to known participation records.
 *
 * NEW MATCHING STRATEGY for the 11-column format:
 * Each row has "Investor Name" (col 2) and "Applied From" (col 4).
 * A participation record has:
 *   - profiles (account holder = user_id)
 *   - investor (investor_user_id)
 *
 * Match hierarchy:
 * 1. (investor full_name matches parsed.name) AND (account holder full_name matches parsed.applied_from)
 * 2. (investor full_name matches parsed.name) AND applied_from is missing/same
 * 3. Fallback: By username or full_name alone (legacy support)
 */
export function matchRowsToParticipants(rows, participants) {
  // Build lookup indexes
  const byInvestorAndHolder = new Map()  // key: `${investorName}|${holderName}` → participation
  const byInvestorName      = new Map()  // key: investorName → [participations]
  const byUsername          = new Map()  // key: username → [participations]
  const byFullName          = new Map()  // key: full_name → [participations]

  for (const p of participants) {
    // The default admin participant is shown (and exported) as ADMIN_DISPLAY_NAME for both names
    const adminName    = p.is_admin_default ? ADMIN_DISPLAY_NAME.toLowerCase() : null
    const holderName   = adminName ?? (p.profiles?.full_name ?? '').toLowerCase().trim()
    const holderUser   = (p.profiles?.username  ?? '').toLowerCase().trim()
    // investor profile is in p.investor (joined separately)
    const investorName = adminName ?? (p.investor?.full_name ?? p.profiles?.full_name ?? '').toLowerCase().trim()
    const investorUser = (p.investor?.username  ?? p.profiles?.username  ?? '').toLowerCase().trim()

    // Index 1: investor + account holder combo
    const comboKey = `${investorName}|${holderName}`
    byInvestorAndHolder.set(comboKey, p)

    // Index 2: investor name → list (may have multiple rows if same investor, diff accounts)
    if (investorName) {
      if (!byInvestorName.has(investorName)) byInvestorName.set(investorName, [])
      byInvestorName.get(investorName).push(p)
    }

    // Index 3: username (account holder's username)
    if (holderUser) {
      if (!byUsername.has(holderUser)) byUsername.set(holderUser, [])
      byUsername.get(holderUser).push(p)
    }

    // Index 4: full name (account holder's)
    if (holderName) {
      if (!byFullName.has(holderName)) byFullName.set(holderName, [])
      byFullName.get(holderName).push(p)
    }

    // Also index investor username
    if (investorUser && investorUser !== holderUser) {
      if (!byUsername.has(investorUser)) byUsername.set(investorUser, [])
      byUsername.get(investorUser).push(p)
    }
  }

  return rows.map(row => {
    const investorNameRaw = (row.parsed.name ?? '').toLowerCase().trim()
    const appliedFromRaw  = (row.parsed.applied_from ?? '').toLowerCase().trim()

    // ── Strategy 1: Exact combo match (investor + account holder)
    if (investorNameRaw && appliedFromRaw) {
      const comboKey = `${investorNameRaw}|${appliedFromRaw}`
      const match = byInvestorAndHolder.get(comboKey)
      if (match) {
        return {
          ...row,
          matchStatus: 'MATCHED',
          participationId: match.id,
          matchedProfile: match.profiles,
        }
      }
    }

    // ── Strategy 2: Investor name matches, applied_from matches investor (same person)
    if (investorNameRaw && (!appliedFromRaw || appliedFromRaw === investorNameRaw)) {
      const comboKey = `${investorNameRaw}|${investorNameRaw}`
      const match = byInvestorAndHolder.get(comboKey)
      if (match) {
        return {
          ...row,
          matchStatus: 'MATCHED',
          participationId: match.id,
          matchedProfile: match.profiles,
        }
      }
    }

    // ── Strategy 3: Try matching applied_from only (account holder's full name)
    if (appliedFromRaw) {
      const holderMatches = byFullName.get(appliedFromRaw) ?? []
      if (holderMatches.length === 1) {
        return {
          ...row,
          matchStatus: 'MATCHED',
          participationId: holderMatches[0].id,
          matchedProfile: holderMatches[0].profiles,
        }
      }
      if (holderMatches.length > 1) {
        return {
          ...row,
          matchStatus: 'AMBIGUOUS',
          isValid: false,
          errors: [...row.errors, `Multiple participants found for Applied From: "${row.parsed.applied_from}"`],
        }
      }
    }

    // ── Strategy 4: Fall back to matching by investor name (full_name or username)
    const investorMatches = byInvestorName.get(investorNameRaw) ?? []
    if (investorMatches.length === 1) {
      return {
        ...row,
        matchStatus: 'MATCHED',
        participationId: investorMatches[0].id,
        matchedProfile: investorMatches[0].profiles,
      }
    }
    if (investorMatches.length > 1) {
      return {
        ...row,
        matchStatus: 'AMBIGUOUS',
        isValid: false,
        errors: [...row.errors, `Multiple records match investor "${row.parsed.name}" — add Applied From column to disambiguate`],
      }
    }

    // ── Strategy 5: Try username match
    const userMatches = byUsername.get(investorNameRaw) ?? []
    if (userMatches.length === 1) {
      return { ...row, matchStatus: 'MATCHED', participationId: userMatches[0].id, matchedProfile: userMatches[0].profiles }
    }
    if (userMatches.length > 1) {
      return { ...row, matchStatus: 'AMBIGUOUS', isValid: false, errors: [...row.errors, 'Multiple participants match: ' + investorNameRaw] }
    }

    return {
      ...row,
      matchStatus: 'UNMATCHED',
      isValid: false,
      errors: [...row.errors, `No participant found matching investor "${row.parsed.name}" / applied from "${row.parsed.applied_from ?? '—'}"`],
    }
  })
}