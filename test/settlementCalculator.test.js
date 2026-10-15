/**
 * settlementCalculator.test.js
 * ============================
 * Unit tests for the IPO settlement calculation engine.
 * Reference fixture: Moneyview_IPO.xlsx (verified values).
 *
 * Sample data (from workbook):
 *   Issue Price:         ₹34.00  (N3)
 *   Lot Size:            441     (N4)
 *   Tax Rate:            20%     (N6)
 *   Chandra selling:     ₹56.66, charge ₹36.86  (N18/O18)
 *   Vishal  selling:     ₹61.81, charge ₹45.00  (N19/O19)
 *   Effective price:     59.235  (N21, formula)
 *   Total selling chg:   81.86   (O21)
 *   Total profit(wb):    22252.86 (N5, stored — NOT reproduced by formula)
 *   Total profit(calc):  22257.27 (our formula — DOCUMENTED DISCREPANCY)
 *   Tax reserve(wb):     4450.572 (N7, = N5 × 0.20 — matches stored N5)
 *   Distributable(wb):   17720.428 (N9)
 *   Each applicant:      ₹14994, profit share = 843.8
 *   Total applicants:    21, each ₹14994
 *   Total contributed:   314874
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  requireFinite,
  roundTo,
  calculateEffectiveSellingPrice,
  calculateTotalSellingCharges,
  calculateTotalAllottedLots,
  calculateTotalProfit,
  calculateTotalTaxReserve,
  calculateDistributableProfit,
  calculateTotalAmountContributed,
  calculateProfitShare,
  calculateApplicantTaxReserve,
  calculateRefund,
  calculateFinalSettlement,
  generateSettlementPreview,
} from '../src/utils/settlementCalculator.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeApplicants(count, contribution = 14994) {
  return Array.from({ length: count }, (_, i) => ({
    id: `part-${i + 1}`,
    full_name: `Applicant ${i + 1}`,
    amountContributed: contribution,
    lots: 1,
    applied_from: `Applicant ${i + 1}`,
  }))
}

// ---------------------------------------------------------------------------
// 1. requireFinite
// ---------------------------------------------------------------------------
test('requireFinite: accepts valid numbers', () => {
  assert.equal(requireFinite(100, 'x'), 100)
  assert.equal(requireFinite('59.235', 'x'), 59.235)
  assert.equal(requireFinite(0, 'x'), 0)
})

test('requireFinite: throws on NaN', () => {
  assert.throws(() => requireFinite(NaN, 'price'), /must be a valid finite number/)
})

test('requireFinite: throws on Infinity', () => {
  assert.throws(() => requireFinite(Infinity, 'price'), /must be a valid finite number/)
})

test('requireFinite: throws on non-numeric string', () => {
  assert.throws(() => requireFinite('abc', 'price'), /must be a valid finite number/)
})

// ---------------------------------------------------------------------------
// 2. roundTo
// ---------------------------------------------------------------------------
test('roundTo: rounds 843.79 to 1 decimal → 843.8', () => {
  assert.equal(roundTo(843.79, 1), 843.8)
})

test('roundTo: rounds 843.75 to 1 decimal → 843.8 (half-up)', () => {
  assert.equal(roundTo(843.75, 1), 843.8)
})

test('roundTo: 59.235 to 2 decimals → 59.24', () => {
  assert.equal(roundTo(59.235, 2), 59.24)
})

// ---------------------------------------------------------------------------
// 3. calculateEffectiveSellingPrice
// ---------------------------------------------------------------------------
test('effectiveSellingPrice: single applicant returns that price', () => {
  const result = calculateEffectiveSellingPrice([{ sellingPrice: 56.66 }])
  assert.equal(result, 56.66)
})

test('effectiveSellingPrice: two applicants returns arithmetic average', () => {
  // (56.66 + 61.81) / 2 = 59.235
  const result = calculateEffectiveSellingPrice([
    { sellingPrice: 56.66 },
    { sellingPrice: 61.81 },
  ])
  assert.equal(result, 59.235)
})

test('effectiveSellingPrice: three applicants uses arithmetic mean (not weighted)', () => {
  const result = calculateEffectiveSellingPrice([
    { sellingPrice: 10 },
    { sellingPrice: 20 },
    { sellingPrice: 30 },
  ])
  assert.equal(result, 20)
})

test('effectiveSellingPrice: throws on empty array', () => {
  assert.throws(() => calculateEffectiveSellingPrice([]), /At least one/)
})

test('effectiveSellingPrice: throws on zero price', () => {
  assert.throws(() => calculateEffectiveSellingPrice([{ sellingPrice: 0 }]), /positive/)
})

test('effectiveSellingPrice: throws on negative price', () => {
  assert.throws(() => calculateEffectiveSellingPrice([{ sellingPrice: -5 }]), /positive/)
})

// ---------------------------------------------------------------------------
// 4. calculateTotalSellingCharges
// ---------------------------------------------------------------------------
test('totalSellingCharges: two applicants sums charges', () => {
  // 36.86 + 45.00 = 81.86
  const result = calculateTotalSellingCharges([
    { sellingCharge: 36.86 },
    { sellingCharge: 45.00 },
  ])
  assert.equal(roundTo(result, 2), 81.86)
})

test('totalSellingCharges: single applicant returns its charge', () => {
  assert.equal(calculateTotalSellingCharges([{ sellingCharge: 36.86 }]), 36.86)
})

test('totalSellingCharges: throws on negative charge', () => {
  assert.throws(() => calculateTotalSellingCharges([{ sellingCharge: -1 }]), /non-negative/)
})

test('totalSellingCharges: zero charge is allowed', () => {
  assert.equal(calculateTotalSellingCharges([{ sellingCharge: 0 }]), 0)
})

// ---------------------------------------------------------------------------
// 5. calculateTotalAllottedLots
// ---------------------------------------------------------------------------
test('totalAllottedLots: 2 applicants with 1 lot each → 2', () => {
  const result = calculateTotalAllottedLots([{ lots: 1 }, { lots: 1 }])
  assert.equal(result, 2)
})

test('totalAllottedLots: empty array → 0', () => {
  assert.equal(calculateTotalAllottedLots([]), 0)
})

// ---------------------------------------------------------------------------
// 6. calculateTotalProfit
// ---------------------------------------------------------------------------
test('totalProfit: sample values (59.235, 34, 441, 2)', () => {
  // (59.235 - 34) × 441 × 2 = 25.235 × 882 = 22257.27
  const result = calculateTotalProfit(59.235, 34, 441, 2)
  assert.equal(roundTo(result, 2), 22257.27)
})

test('totalProfit: single allotted lot', () => {
  // (59.235 - 34) × 441 × 1 = 11128.635
  const result = calculateTotalProfit(59.235, 34, 441, 1)
  assert.equal(roundTo(result, 3), 11128.635)
})

test('totalProfit: throws on issue price = 0', () => {
  assert.throws(() => calculateTotalProfit(59.235, 0, 441, 2), /positive/)
})

// ---------------------------------------------------------------------------
// 7. calculateTotalTaxReserve
// ---------------------------------------------------------------------------
test('taxReserve: 20% of 22257.27 = 4451.454', () => {
  const result = calculateTotalTaxReserve(22257.27, 0.20)
  assert.equal(roundTo(result, 3), 4451.454)
})

test('taxReserve: workbook stored total 22252.86 × 0.20 = 4450.572', () => {
  // Confirms workbook formula for N7
  const result = calculateTotalTaxReserve(22252.86, 0.20)
  assert.equal(roundTo(result, 3), 4450.572)
})

test('taxReserve: throws on invalid rate', () => {
  assert.throws(() => calculateTotalTaxReserve(1000, 1.5), /between 0 and 1/)
})

// ---------------------------------------------------------------------------
// 8. calculateDistributableProfit
// ---------------------------------------------------------------------------
test('distributableProfit: workbook sample', () => {
  // 22252.86 - 4450.572 - 81.86 = 17720.428
  const result = calculateDistributableProfit(22252.86, 4450.572, 81.86)
  assert.equal(roundTo(result, 3), 17720.428)
})

test('distributableProfit: using calculated profit (22257.27)', () => {
  // 22257.27 - 4451.454 - 81.86 = 17723.956
  const result = calculateDistributableProfit(22257.27, 4451.454, 81.86)
  assert.equal(roundTo(result, 3), 17723.956)
})

// ---------------------------------------------------------------------------
// 9. calculateTotalAmountContributed
// ---------------------------------------------------------------------------
test('totalAmountContributed: 21 applicants × 14994 = 314874', () => {
  const applicants = makeApplicants(21, 14994)
  assert.equal(calculateTotalAmountContributed(applicants), 314874)
})

test('totalAmountContributed: throws on empty', () => {
  assert.throws(() => calculateTotalAmountContributed([]), /No applicants/)
})

test('totalAmountContributed: throws on zero total', () => {
  assert.throws(() => calculateTotalAmountContributed([{ amountContributed: 0 }]), /greater than zero/)
})

// ---------------------------------------------------------------------------
// 10. calculateProfitShare — Excel reconciliation
// ---------------------------------------------------------------------------
test('profitShare: workbook sample (17720.428 × 14994 / 314874) = 843.8', () => {
  // ROUND(17720.428 × 14994 / 314874, 1) = ROUND(843.794..., 1) = 843.8
  const result = calculateProfitShare(17720.428, 14994, 314874)
  assert.equal(result, 843.8)
})

test('profitShare: proportional — larger contribution → larger share', () => {
  const share1 = calculateProfitShare(10000, 5000, 15000)   // 5000/15000 = 1/3
  const share2 = calculateProfitShare(10000, 10000, 15000)  // 10000/15000 = 2/3
  assert.ok(share2 > share1, 'Larger contribution should yield larger profit share')
  assert.equal(roundTo(share1 + share2, 1), roundTo(10000, 1))
})

test('profitShare: equal contributions yield equal shares', () => {
  const share = calculateProfitShare(10000, 1000, 5000)  // each of 5 gets 2000
  assert.equal(share, 2000)
})

test('profitShare: throws on zero denominator', () => {
  assert.throws(() => calculateProfitShare(10000, 1000, 0), /zero/)
})

test('profitShare: rounds to 1 decimal', () => {
  // 100 × 1 / 3 = 33.333... → 33.3
  const result = calculateProfitShare(100, 1, 3)
  assert.equal(result, 33.3)
})

// ---------------------------------------------------------------------------
// 11. calculateApplicantTaxReserve
// ---------------------------------------------------------------------------
test('taxReserve per row: allotted applicant (59.235, 34, 441, 0.20, 1)', () => {
  // (59.235 - 34) × 441 × 0.20 × 1 = 25.235 × 88.2 = 2225.727 → rounded to 2 = 2225.73
  const result = calculateApplicantTaxReserve(true, 59.235, 34, 441, 0.20, 1)
  assert.equal(result, 2225.73)
})

test('taxReserve per row: non-allotted applicant → 0', () => {
  assert.equal(calculateApplicantTaxReserve(false, 59.235, 34, 441, 0.20, 1), 0)
})

test('taxReserve per row: workbook formula using N2=59.23 (rounded display price)', () => {
  // (59.23 - 34) × 441 × 0.20 = 25.23 × 88.2 = 2225.286
  const result = calculateApplicantTaxReserve(true, 59.23, 34, 441, 0.20, 1)
  assert.equal(result, 2225.29)  // 2225.286 rounded to 2 decimals
})

// ---------------------------------------------------------------------------
// 12. calculateRefund
// ---------------------------------------------------------------------------
test('refund: equals amount contributed', () => {
  assert.equal(calculateRefund(14994), 14994)
})

test('refund: throws on NaN', () => {
  assert.throws(() => calculateRefund(NaN), /finite/)
})

// ---------------------------------------------------------------------------
// 13. calculateFinalSettlement
// ---------------------------------------------------------------------------
test('finalSettlement: profitShare + taxReserve', () => {
  // 843.8 + 1998 = 2841.8 (Chandra row in workbook)
  assert.equal(calculateFinalSettlement(843.8, 1998), 2841.8)
})

test('finalSettlement: non-allotted applicant 843.8 + 0 = 843.8', () => {
  assert.equal(calculateFinalSettlement(843.8, 0), 843.8)
})

// ---------------------------------------------------------------------------
// 14. generateSettlementPreview — full integration test
// ---------------------------------------------------------------------------
const SAMPLE_IPO = {
  ipo_name: 'Moneyview IPO',
  ipo_price: 34,
  lot_size: 441,
}

const SAMPLE_ALL_21 = makeApplicants(21, 14994)

const SAMPLE_SELECTED_2 = [
  { participationId: 'part-1', sellingPrice: 56.66, sellingCharge: 36.86, lots: 1 },
  { participationId: 'part-2', sellingPrice: 61.81, sellingCharge: 45.00, lots: 1 },
]

test('generateSettlementPreview: 21 applicants, 2 allotted', () => {
  const preview = generateSettlementPreview({
    ipo: SAMPLE_IPO,
    allApplicants: SAMPLE_ALL_21,
    selectedApplicants: SAMPLE_SELECTED_2,
  })

  // Summary checks
  const s = preview.summary
  assert.equal(s.totalApplicants, 21)
  assert.equal(s.allottedApplicants, 2)
  assert.equal(s.effectiveSellingPrice, 59.235)
  assert.equal(roundTo(s.totalSellingCharges, 2), 81.86)
  assert.equal(s.totalAllottedLots, 2)
  assert.equal(roundTo(s.totalProfit, 2), 22257.27)    // calculated (not workbook's stored 22252.86)
  assert.equal(s.totalAmountContributed, 314874)
  assert.equal(s.taxRate, 0.20)

  // Row count
  assert.equal(preview.rows.length, 21)

  // Allotted applicants
  assert.equal(preview.rows[0].allotted, true)
  assert.equal(preview.rows[1].allotted, true)
  assert.equal(preview.rows[2].allotted, false)

  // All get profit share
  assert.ok(preview.rows[0].profitShare > 0)
  assert.ok(preview.rows[5].profitShare > 0)  // non-allotted still gets share

  // Only allotted get tax reserve
  assert.ok(preview.rows[0].taxReserve > 0)
  assert.equal(preview.rows[2].taxReserve, 0)

  // Final settlement = profitShare + taxReserve
  assert.equal(
    preview.rows[0].finalSettlement,
    roundTo(preview.rows[0].profitShare + preview.rows[0].taxReserve, 2)
  )
  assert.equal(
    preview.rows[5].finalSettlement,
    roundTo(preview.rows[5].profitShare + preview.rows[5].taxReserve, 2)
  )

  // Refund = amountContributed
  assert.equal(preview.rows[0].refund, 14994)
  assert.equal(preview.rows[10].refund, 14994)
})

test('generateSettlementPreview: 1 allotted applicant', () => {
  const allApps = makeApplicants(5, 10000)
  const selected = [{ participationId: 'part-1', sellingPrice: 60, sellingCharge: 50, lots: 1 }]
  const preview = generateSettlementPreview({
    ipo: { ipo_name: 'Test IPO', ipo_price: 34, lot_size: 441 },
    allApplicants: allApps,
    selectedApplicants: selected,
  })
  assert.equal(preview.summary.allottedApplicants, 1)
  assert.equal(preview.summary.totalAllottedLots, 1)
  assert.equal(preview.rows[0].allotted, true)
  assert.equal(preview.rows[1].allotted, false)
  assert.equal(preview.rows[1].taxReserve, 0)
  // All 5 get profit share
  preview.rows.forEach(r => assert.ok(r.profitShare > 0))
})

test('generateSettlementPreview: profit shares are proportional to contribution', () => {
  const allApps = [
    { id: 'p1', full_name: 'A', amountContributed: 1000, lots: 0, applied_from: 'A' },
    { id: 'p2', full_name: 'B', amountContributed: 3000, lots: 0, applied_from: 'B' },
  ]
  const selected = [{ participationId: 'p1', sellingPrice: 60, sellingCharge: 0, lots: 1 }]
  const preview = generateSettlementPreview({
    ipo: { ipo_name: 'T', ipo_price: 30, lot_size: 100 },
    allApplicants: allApps,
    selectedApplicants: selected,
  })
  // B has 3× the contribution, so B gets 3× the profit share
  assert.equal(
    roundTo(preview.rows[1].profitShare / preview.rows[0].profitShare, 0),
    3
  )
})

test('generateSettlementPreview: throws on zero contribution total', () => {
  const allApps = [{ id: 'p1', full_name: 'X', amountContributed: 0, lots: 0 }]
  const selected = [{ participationId: 'p1', sellingPrice: 60, sellingCharge: 0, lots: 1 }]
  assert.throws(() => generateSettlementPreview({
    ipo: { ipo_name: 'T', ipo_price: 30, lot_size: 100 },
    allApplicants: allApps,
    selectedApplicants: selected,
  }), /greater than zero/)
})

test('generateSettlementPreview: throws on no selected applicants', () => {
  const allApps = makeApplicants(3)
  assert.throws(() => generateSettlementPreview({
    ipo: SAMPLE_IPO,
    allApplicants: allApps,
    selectedApplicants: [],
  }), /At least one/)
})

// ---------------------------------------------------------------------------
// 15. Excel Reconciliation — Known discrepancy test
// ---------------------------------------------------------------------------
test('EXCEL RECONCILIATION: our profit share formula matches workbook (843.8)', () => {
  // Using workbook's stored N9=17720.428 (not our calculated value)
  // to verify the profit share formula matches exactly
  const share = calculateProfitShare(17720.428, 14994, 314874)
  assert.equal(share, 843.8, 'Profit share must match workbook cell I2 value of 843.8')
})

test('EXCEL RECONCILIATION: our total = 21 × 843.8 = 17719.8 (workbook I23)', () => {
  const total = roundTo(21 * 843.8, 1)
  assert.equal(total, 17719.8)
})

test('EXCEL RECONCILIATION: residual between distributable and sum of shares', () => {
  // 17720.428 - 17719.8 = 0.628 (workbook rounding residual)
  const residual = roundTo(17720.428 - 17719.8, 3)
  assert.equal(residual, 0.628)
})

test('EXCEL RECONCILIATION: tax formula result differs from workbook hardcoded values', () => {
  // Formula gives 2225.73 (using N21=59.235)
  // Workbook J9=2452 and J18=1998 — both hardcoded, both differ from formula
  const formulaResult = calculateApplicantTaxReserve(true, 59.235, 34, 441, 0.20, 1)
  assert.equal(formulaResult, 2225.73)
  assert.notEqual(formulaResult, 2452, 'Formula ≠ J9 hardcoded value — known inconsistency')
  assert.notEqual(formulaResult, 1998, 'Formula ≠ J18 hardcoded value — known inconsistency')
})
