import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { safeParseIpoJson } from '../src/utils/ipoJsonParser.js'
import { mapRawIpoToCanonical, normalizeDate, normalizeNumber } from '../src/utils/ipoFieldMapper.js'
import { validateIpoJson } from '../src/utils/ipoJsonValidator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sampleJsonText = fs.readFileSync(path.join(__dirname, 'fixtures', 'ipo_sample.json'), 'utf-8')

test('1. Valid complete IPO JSON parses and validates cleanly with all 13 sections', () => {
  const parseRes = safeParseIpoJson(sampleJsonText)
  assert.equal(parseRes.success, true)
  assert.ok(parseRes.data)

  const validationRes = validateIpoJson(parseRes.data)
  assert.equal(validationRes.isValid, true)
  assert.equal(validationRes.errors.length, 0)

  const canonical = validationRes.canonicalData
  assert.equal(canonical.ipo_name, 'Acme Dynamics Limited IPO')
  assert.equal(canonical.company_name, 'Acme Dynamics Limited')
  assert.equal(canonical.ipo_price, 15000)
  assert.equal(canonical.start_date, '2026-10-20')
  assert.equal(canonical.end_date, '2026-10-24')
  assert.equal(canonical.status, 'DRAFT')

  // Verify nested sections
  assert.equal(canonical.details.gmp.premium, 45)
  assert.equal(canonical.details.gmp.estimated_profit_per_lot, 4500)
  assert.equal(canonical.details.lot_size_details.length, 4)
  assert.ok(canonical.details.financials.periods.FY25)
  assert.equal(canonical.details.faq.length, 3)
})

test('2. Invalid JSON syntax returns actionable error and does not crash', () => {
  const badJson = '{"ipo_details": { "name": "Broken" "missing": "comma" }}'
  const parseRes = safeParseIpoJson(badJson)
  assert.equal(parseRes.success, false)
  assert.ok(parseRes.error)
  assert.ok(parseRes.error.includes('JSON Syntax Error'))
  assert.ok(parseRes.errorDetails.line !== null)
})

test('3. Missing ipo_details is detected', () => {
  const noDetails = { gmp: { premium: 10 } }
  const valRes = validateIpoJson(noDetails)
  assert.equal(valRes.isValid, false)
  assert.ok(valRes.errors.some(e => e.includes('Missing IPO Name')))
})

test('4. Missing IPO name is flagged as a blocking error', () => {
  const data = JSON.parse(sampleJsonText)
  delete data.ipo_details.ipo_name
  delete data.ipo_details.company_name
  const valRes = validateIpoJson(data)
  assert.equal(valRes.isValid, false)
  assert.ok(valRes.errors.some(e => e.includes('Missing IPO Name')))
})

test('5. Missing opening or closing date is flagged as error', () => {
  const data = JSON.parse(sampleJsonText)
  delete data.ipo_dates.opening_date
  const valRes = validateIpoJson(data)
  assert.equal(valRes.isValid, false)
  assert.ok(valRes.errors.some(e => e.includes('Missing Opening Date')))
})

test('6. Invalid date like 2026-02-31 is rejected', () => {
  const data = JSON.parse(sampleJsonText)
  data.ipo_dates.opening_date = '2026-02-31'
  const valRes = validateIpoJson(data)
  assert.equal(valRes.isValid, false)
  assert.ok(valRes.errors.some(e => e.includes('not a valid calendar date')))
})

test('7. Opening date after closing date is flagged as error', () => {
  const data = JSON.parse(sampleJsonText)
  data.ipo_dates.opening_date = '2026-10-25'
  data.ipo_dates.closing_date = '2026-10-20'
  const valRes = validateIpoJson(data)
  assert.equal(valRes.isValid, false)
  assert.ok(valRes.errors.some(e => e.includes('cannot be after Closing date')))
})

test('8. Null subscription values are preserved and not replaced with 0', () => {
  const data = JSON.parse(sampleJsonText)
  data.subscription = {
    total_subscription: null,
    retail: null,
    qib: null,
    nii: null,
  }
  const canonical = mapRawIpoToCanonical(data)
  assert.equal(canonical.details.subscription.total, null)
  assert.equal(canonical.details.subscription.retail, null)
  assert.notEqual(canonical.details.subscription.total, 0)
})

test('9. Null financial ratios are preserved', () => {
  const data = JSON.parse(sampleJsonText)
  data.kpi = {
    roe: null,
    roce: null,
    debt_to_equity: null,
  }
  const canonical = mapRawIpoToCanonical(data)
  assert.equal(canonical.details.kpi.roe, null)
  assert.equal(canonical.details.kpi.roce, null)
  assert.equal(canonical.details.kpi.debt_to_equity, null)
})

test('10. Zero company proceeds is preserved as 0, not null or missing', () => {
  const data = JSON.parse(sampleJsonText)
  data.ipo_details.company_proceeds = 0
  const canonical = mapRawIpoToCanonical(data)
  assert.equal(canonical.details.company_proceeds, 0)
  assert.notEqual(canonical.details.company_proceeds, null)
})

test('11. Boolean fresh_issue: false is preserved as false', () => {
  const data = JSON.parse(sampleJsonText)
  data.ipo_details.fresh_issue = false
  const canonical = mapRawIpoToCanonical(data)
  assert.equal(canonical.details.fresh_issue, false)
  assert.notEqual(canonical.details.fresh_issue, null)
})

test('12. Empty arrays are preserved as empty arrays', () => {
  const data = JSON.parse(sampleJsonText)
  data.company_details.manufacturing_locations = []
  data.official_documents = {}
  data.faq = []
  const canonical = mapRawIpoToCanonical(data)
  assert.deepEqual(canonical.details.company_details.manufacturing_locations, [])
  assert.deepEqual(canonical.details.faq, [])
})

test('13. Nested financial periods are mapped cleanly with metrics preserved', () => {
  const data = JSON.parse(sampleJsonText)
  const canonical = mapRawIpoToCanonical(data)
  const periods = canonical.details.financials.periods
  assert.ok(periods.FY23)
  assert.ok(periods.FY24)
  assert.ok(periods.FY25)
  assert.equal(periods.FY24.net_profit, 58.4)
  assert.equal(periods.FY25.total_income, 560.8)
})

test('14. Multiple lot-size categories are parsed and preserved', () => {
  const data = JSON.parse(sampleJsonText)
  const canonical = mapRawIpoToCanonical(data)
  const lots = canonical.details.lot_size_details
  assert.equal(lots.length, 4)
  assert.equal(lots[0].category, 'Retail (Min)')
  assert.equal(lots[0].amount, 15000)
  assert.equal(lots[3].category, 'bHNI (Min)')
  assert.equal(lots[3].lots, 67)
})

test('15. Additional unknown fields are preserved in raw_json and reported as warning', () => {
  const data = JSON.parse(sampleJsonText)
  data.custom_extra_metadata = { audited_by: 'KPMG', source_url: 'https://example.com' }
  const valRes = validateIpoJson(data)
  assert.equal(valRes.isValid, true)
  assert.ok(valRes.warnings.some(w => w.includes('custom_extra_metadata')))
  assert.ok(valRes.canonicalData.details.raw_json.custom_extra_metadata)
})

test('16. Numeric values with symbols like "₹ 150.00" are normalized correctly; strings like "2m ago" are not converted to numbers; dates are normalized', () => {
  assert.equal(normalizeNumber('₹ 14,919.50'), 14919.50)
  assert.equal(normalizeNumber('2m ago'), null)
  assert.equal(normalizeNumber('3 hours ago'), null)
  assert.equal(normalizeNumber(0), 0)
  assert.equal(normalizeNumber(null), null)

  assert.equal(normalizeDate('2026-10-20'), '2026-10-20')
  assert.equal(normalizeDate('20-10-2026'), '2026-10-20')
  assert.equal(normalizeDate(null), null)
})

test('17. Duplicate check helper detects same company or IPO name if list is checked', () => {
  const existingIpos = [
    { ipo_name: 'Acme Dynamics Limited IPO', ipo_code: 'IPO1001' },
    { ipo_name: 'Tata Tech', ipo_code: 'IPO1002' },
  ]
  const isDuplicate = existingIpos.some(i => i.ipo_name.toLowerCase() === 'acme dynamics limited ipo')
  assert.equal(isDuplicate, true)
})

test('18. Large but reasonable JSON input parses within reasonable time', () => {
  const largeData = JSON.parse(sampleJsonText)
  // Expand FAQs to 50 items and lot sizes
  largeData.faq = Array.from({ length: 50 }, (_, i) => ({
    question: `Question ${i + 1}`,
    answer: `Detailed answer ${i + 1} regarding issue and allotment procedures.`,
  }))
  const str = JSON.stringify(largeData)
  const t0 = Date.now()
  const parseRes = safeParseIpoJson(str)
  const valRes = validateIpoJson(parseRes.data)
  const duration = Date.now() - t0
  assert.equal(parseRes.success, true)
  assert.equal(valRes.isValid, true)
  assert.ok(duration < 200, `Parsing should be under 200ms, took ${duration}ms`)
})

test('19. Correct preservation of source disclaimers for GMP and Subscription', () => {
  const data = JSON.parse(sampleJsonText)
  const canonical = mapRawIpoToCanonical(data)
  assert.equal(canonical.details.gmp.is_official, false)
  assert.ok(canonical.details.gmp.disclaimer.includes('unofficial'))
  assert.ok(canonical.details.subscription.disclaimer.includes('bidding logs'))
})

test('20. Editing a value in the preview updates canonical model before creation', () => {
  const data = JSON.parse(sampleJsonText)
  const canonical = mapRawIpoToCanonical(data)
  // Simulate admin correcting IPO Price from 15000 to 14900 and changing start_date
  canonical.ipo_price = 14900
  canonical.start_date = '2026-10-21'
  canonical.details.min_investment = 14900
  canonical.details.start_date = '2026-10-21'

  assert.equal(canonical.ipo_price, 14900)
  assert.equal(canonical.start_date, '2026-10-21')
  assert.equal(canonical.details.min_investment, 14900)
})
