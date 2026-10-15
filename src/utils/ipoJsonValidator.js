/**
 * ipoJsonValidator.js
 * Comprehensive schema and business logic validator for imported IPO JSON.
 */

import { mapRawIpoToCanonical } from './ipoFieldMapper.js'

/**
 * Checks if a string is a real, valid calendar date (e.g. rejects 2026-02-31).
 */
function isValidCalendarDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false

  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10) - 1
  const day = parseInt(match[3], 10)

  const d = new Date(Date.UTC(year, month, day))
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month &&
    d.getUTCDate() === day
  )
}

/**
 * Validates the parsed IPO JSON against the canonical schema and business rules.
 * 
 * @param {object} parsedJson 
 * @returns {{
 *   isValid: boolean,
 *   errors: string[],
 *   warnings: string[],
 *   fieldErrors: Record<string, string>,
 *   canonicalData: object|null
 * }}
 */
export function validateIpoJson(parsedJson) {
  const errors = []
  const warnings = []
  const fieldErrors = {}

  if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
    return {
      isValid: false,
      errors: ['Input must be a JSON object containing IPO data.'],
      warnings: [],
      fieldErrors: { root: 'Invalid object structure' },
      canonicalData: null,
    }
  }

  // Check recognized sections
  const recognizedSections = [
    'ipo_details',
    'ipo_dates',
    'gmp',
    'subscription',
    'reservation_quota',
    'issue_details',
    'lot_size_details',
    'kpi',
    'financials',
    'company_details',
    'company_contact',
    'official_documents',
    'faq',
  ]

  const presentSections = Object.keys(parsedJson).filter(k => recognizedSections.includes(k))
  const unknownKeys = Object.keys(parsedJson).filter(k => !recognizedSections.includes(k) && !['ipo_name', 'name', 'ipo_price', 'start_date', 'end_date'].includes(k))

  if (unknownKeys.length > 0) {
    warnings.push(`Additional non-standard sections detected: ${unknownKeys.join(', ')}. They will be preserved in raw data.`)
  }

  if (presentSections.length === 0 && !parsedJson.ipo_name && !parsedJson.name && !parsedJson.ipo_details) {
    errors.push('No recognized IPO sections found (expected "ipo_details", "ipo_dates", etc.).')
    fieldErrors.root = 'Missing recognized IPO sections'
    return {
      isValid: false,
      errors,
      warnings,
      fieldErrors,
      canonicalData: null,
    }
  }

  // Map to canonical model
  const canonical = mapRawIpoToCanonical(parsedJson)

  // 1. Mandatory IPO / Company Name
  if (!canonical.ipo_name && !canonical.company_name) {
    errors.push('Missing IPO Name: Must provide "ipo_details.ipo_name" or "company_name".')
    fieldErrors['ipo_name'] = 'IPO Name is required'
  }

  // 2. Mandatory Dates
  if (!canonical.start_date) {
    errors.push('Missing Opening Date: Must provide "ipo_dates.opening_date" (YYYY-MM-DD).')
    fieldErrors['start_date'] = 'Opening date is required'
  } else if (!isValidCalendarDate(canonical.start_date)) {
    errors.push(`Invalid Opening Date: "${canonical.start_date}" is not a valid calendar date.`)
    fieldErrors['start_date'] = 'Opening date must be a valid date (YYYY-MM-DD)'
  }

  if (!canonical.end_date) {
    errors.push('Missing Closing Date: Must provide "ipo_dates.closing_date" (YYYY-MM-DD).')
    fieldErrors['end_date'] = 'Closing date is required'
  } else if (!isValidCalendarDate(canonical.end_date)) {
    errors.push(`Invalid Closing Date: "${canonical.end_date}" is not a valid calendar date.`)
    fieldErrors['end_date'] = 'Closing date must be a valid date (YYYY-MM-DD)'
  }

  // Date Range Order
  if (canonical.start_date && canonical.end_date && canonical.start_date > canonical.end_date) {
    errors.push(`Date Conflict: Opening date (${canonical.start_date}) cannot be after Closing date (${canonical.end_date}).`)
    fieldErrors['end_date'] = 'End date must be on or after start date'
  }

  // 3. Pricing information
  const price = canonical.ipo_price
  if (!price || typeof price !== 'number' || price <= 0 || !Number.isFinite(price)) {
    errors.push('Missing or invalid IPO Price: Must provide positive price info ("ipo_details.maximum_price", "minimum_investment", etc.).')
    fieldErrors['ipo_price'] = 'IPO price must be a positive number'
  }

  // 4. Validate Optional Sections (non-blocking warnings or field-level alerts)
  const d = canonical.details

  // Check lot size if present
  if (d.lot_size !== null && (d.lot_size <= 0 || !Number.isInteger(d.lot_size))) {
    warnings.push(`Lot size (${d.lot_size}) should normally be a positive integer.`)
  }

  // Check price band consistency
  if (d.min_price !== null && d.max_price !== null && d.min_price > d.max_price) {
    warnings.push(`Price band discrepancy: Minimum price (₹${d.min_price}) is greater than Maximum price (₹${d.max_price}).`)
  }

  // Check GMP disclaimer
  if (d.gmp.premium !== null && !d.gmp.disclaimer) {
    warnings.push('GMP is included without an explicit source disclaimer. An unofficial advisory note will be attached.')
  }

  // Section completeness warnings
  if (!parsedJson.financials || Object.keys(parsedJson.financials).length === 0) {
    warnings.push('Financial statements section ("financials") is absent or empty.')
  }
  if (!parsedJson.kpi || Object.keys(parsedJson.kpi).length === 0) {
    warnings.push('Key Performance Indicators ("kpi") are absent.')
  }
  if (!parsedJson.gmp || Object.keys(parsedJson.gmp).length === 0) {
    warnings.push('Grey Market Premium ("gmp") details are not provided.')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fieldErrors,
    canonicalData: canonical,
  }
}
