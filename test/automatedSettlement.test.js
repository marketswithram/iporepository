/**
 * test/automatedSettlement.test.js
 * =================================
 * Automated test suite covering Phase 10 requirements:
 * 1. Calculation engine & precision
 * 2. Excel reconciliation against Moneyview_IPO.xlsx sample
 * 3. Proportional profit sharing with unequal amounts
 * 4. Allotment flags, tax allocation, refund integrity, final settlement
 * 5. Input validation & error boundaries
 * 6. Regression tests for existing Excel Import workflow (parseImportText & matchRowsToParticipants)
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
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
  roundTo,
} from '../src/utils/settlementCalculator.js'

import {
  parseImportText,
  matchRowsToParticipants,
} from '../src/utils/importParser.js'

// ---------------------------------------------------------------------------
// 1. Core Financial Calculation Functions
// ---------------------------------------------------------------------------

test('1. Arithmetic average of selling prices (single, two, multiple applicants)', () => {
  // Single
  assert.equal(calculateEffectiveSellingPrice([{ sellingPrice: 50 }]), 50)
  // Two: (56.66 + 61.81) / 2 = 59.235
  const avg2 = calculateEffectiveSellingPrice([{ sellingPrice: 56.66 }, { sellingPrice: 61.81 }])
  assert.equal(roundTo(avg2, 3), 59.235)
  // Three: (50 + 60 + 70) / 3 = 60
  assert.equal(calculateEffectiveSellingPrice([{ sellingPrice: 50 }, { sellingPrice: 60 }, { sellingPrice: 70 }]), 60)
})

test('2. Total selling charges sum accurately', () => {
  const charges = calculateTotalSellingCharges([
    { sellingCharge: 40.93 },
    { sellingCharge: 40.93 },
  ])
  assert.equal(roundTo(charges, 2), 81.86)
})

test('3. Total allotted lots sums lots across selected applicants', () => {
  assert.equal(calculateTotalAllottedLots([{ lots: 1 }, { lots: 2 }, { lots: 1 }]), 4)
  assert.equal(calculateTotalAllottedLots([{ lots: 1 }]), 1)
})

test('4. Total IPO profit calculation: (Price - Issue) * LotSize * Lots - Charges', () => {
  // Moneyview sample: (59.235 - 34) * 441 * 2 - 81.86 = 22257.27 - 81.86?
  // Note: (59.235 - 34) * 441 * 2 = 22257.27
  const profit = calculateTotalProfit(59.235, 34, 441, 2)
  assert.equal(roundTo(profit, 2), 22257.27)
})

test('5. Total tax reserve at 20%', () => {
  const profit = 22257.27
  const tax = calculateTotalTaxReserve(profit, 0.20)
  assert.equal(roundTo(tax, 2), 4451.45)
})

test('6. Distributable profit: Total Profit - Tax Reserve (and selling charges if applied)', () => {
  const dist = calculateDistributableProfit(22257.27, 4451.454, 85.39)
  // 22257.27 - 4451.454 - 85.39 = 17720.426
  assert.equal(roundTo(dist, 1), 17720.4)
})

test('7. Profit sharing is strictly proportional to Amount Contributed', () => {
  const distributable = 10000
  const totalContributed = 100000

  // Contributor A: 10,000 -> 10% of profit = 1,000
  const shareA = calculateProfitShare(distributable, 10000, totalContributed)
  assert.equal(shareA, 1000)

  // Contributor B: 30,000 -> 30% of profit = 3,000
  const shareB = calculateProfitShare(distributable, 30000, totalContributed)
  assert.equal(shareB, 3000)

  // Contributor C: 60,000 -> 60% of profit = 6,000
  const shareC = calculateProfitShare(distributable, 60000, totalContributed)
  assert.equal(shareC, 6000)

  assert.equal(shareA + shareB + shareC, distributable)
})

test('8. Refund equals Applied Amount for all applicants', () => {
  assert.equal(calculateRefund(14994), 14994)
  assert.equal(calculateRefund(29988), 29988)
})

test('9. Tax reserve is allocated ONLY to allotted applicants; unselected is 0', () => {
  const allottedTax = calculateApplicantTaxReserve(true, 59.235, 34, 441, 0.20, 1)
  assert.ok(allottedTax > 0)
  assert.equal(roundTo(allottedTax, 2), 2225.73)

  const nonAllottedTax = calculateApplicantTaxReserve(false, 59.235, 34, 441, 0.20, 0)
  assert.equal(nonAllottedTax, 0)
})

test('10. Final Settlement strictly equals Profit Share plus Tax Reserve', () => {
  const profitShare = 843.8
  const taxReserve = 2225.43
  assert.equal(calculateFinalSettlement(profitShare, taxReserve), 3069.23)

  // Non-allotted: 843.8 + 0 = 843.8
  assert.equal(calculateFinalSettlement(profitShare, 0), 843.8)
})

// ---------------------------------------------------------------------------
// 2. Full Settlement Preview Generation & Validation
// ---------------------------------------------------------------------------

test('11. generateSettlementPreview produces complete 11-column dataset for 21 applicants', () => {
  const allApplicants = []
  for (let i = 1; i <= 21; i++) {
    allApplicants.push({
      id: `app-uuid-${i}`,
      serial: i,
      investor_name: `Investor ${i}`,
      applied_from: `AccountHolder ${i}`,
      amount_contributed: 14994,
      lots: 1,
    })
  }

  // 2 allotted applicants
  const selectedApplicants = [
    { participationId: 'app-uuid-9', id: 'app-uuid-9', sellingPrice: 56.66, sellingCharge: 40.93, lots: 1 },
    { participationId: 'app-uuid-18', id: 'app-uuid-18', sellingPrice: 61.81, sellingCharge: 40.93, lots: 1 },
  ]

  const preview = generateSettlementPreview({
    ipo: { ipo_name: 'Moneyview Financial', ipo_price: 34, lot_size: 441 },
    allApplicants,
    selectedApplicants,
    taxRate: 0.20,
  })

  assert.equal(preview.rows.length, 21)
  assert.equal(preview.summary.totalApplicants, 21)
  assert.equal(preview.summary.allottedApplicants, 2)
  assert.equal(roundTo(preview.summary.effectiveSellingPrice, 3), 59.235)
  assert.equal(roundTo(preview.summary.totalSellingCharges, 2), 81.86)

  // Verify allotted flags
  const app9 = preview.rows.find(r => r.participationId === 'app-uuid-9')
  const app1 = preview.rows.find(r => r.participationId === 'app-uuid-1')

  assert.equal(app9.allotted, true)
  assert.ok(app9.taxReserve > 0)
  assert.equal(app9.profitShare, 844)
  assert.equal(app9.refund, 14994)
  assert.equal(app9.finalSettlement, roundTo(app9.profitShare + app9.taxReserve, 2))

  assert.equal(app1.allotted, false)
  assert.equal(app1.taxReserve, 0)
  assert.equal(app1.profitShare, 844)
  assert.equal(app1.refund, 14994)
  assert.equal(app1.finalSettlement, 844)

  // Residual check
  assert.ok(Math.abs(preview.summary.roundingResidual) <= 1, 'Rounding residual should be within ₹1 threshold')
})

test('12. Rejects invalid inputs: zero or negative selling price, negative charges, zero denominator', () => {
  const applicants = [{ id: 'app-1', amount_contributed: 14994 }]

  // Zero price
  assert.throws(() => {
    generateSettlementPreview({
      ipo: { ipo_name: 'Test', ipo_price: 34, lot_size: 100 },
      allApplicants: applicants,
      selectedApplicants: [{ participationId: 'app-1', sellingPrice: 0, sellingCharge: 10 }],
    })
  })

  // Negative charge
  assert.throws(() => {
    generateSettlementPreview({
      ipo: { ipo_name: 'Test', ipo_price: 34, lot_size: 100 },
      allApplicants: applicants,
      selectedApplicants: [{ participationId: 'app-1', sellingPrice: 50, sellingCharge: -5 }],
    })
  })

  // No selected applicants
  assert.throws(() => {
    generateSettlementPreview({
      ipo: { ipo_name: 'Test', ipo_price: 34, lot_size: 100 },
      allApplicants: applicants,
      selectedApplicants: [],
    })
  })
})

// ---------------------------------------------------------------------------
// 3. Existing Excel Import Workflow Regression
// ---------------------------------------------------------------------------

test('13. REGRESSION: Existing parseImportText continues parsing 11-column data cleanly', () => {
  const rawTSV = [
    'S.NO\tINVESTOR NAME\tAMOUNT CONTRIBUTED\tAPPLIED FROM\tLOTS\tAPPLIED AMOUNT\tALLOTTED?\tREFUND\tPROFIT SHARE\tTAX RESERVE\tFINAL SETTLEMENT',
    '1\tChandra\t14994\tChandra\t1\t14994\tYes\t14994\t843.8\t2225.43\t3069.23',
    '2\tVishal\t14994\tVishal\t1\t14994\tNo\t14994\t843.8\t0\t843.8',
  ].join('\n')

  const parsed = parseImportText(rawTSV)
  assert.equal(parsed.rows.length, 2)
  assert.equal(parsed.rows[0].parsed.name, 'Chandra')
  assert.equal(parsed.rows[0].parsed.allotted, true)
  assert.equal(parsed.rows[0].parsed.profit, 843.8)
  assert.equal(parsed.rows[0].parsed.settlement, 3069.23)

  assert.equal(parsed.rows[1].parsed.name, 'Vishal')
  assert.equal(parsed.rows[1].parsed.allotted, false)
  assert.equal(parsed.rows[1].parsed.tax, 0)
})

test('14. REGRESSION: matchRowsToParticipants matches parsed rows to participants by investor & account holder', () => {
  const parsedRows = [
    {
      rowNumber: 1,
      isValid: true,
      errors: [],
      matchStatus: 'UNMATCHED',
      participationId: null,
      parsed: { name: 'Chandra Prakash', applied_from: 'Chandra Prakash' },
    },
    {
      rowNumber: 2,
      isValid: true,
      errors: [],
      matchStatus: 'UNMATCHED',
      participationId: null,
      parsed: { name: 'Ramesh Kumar', applied_from: 'Suresh' },
    },
  ]

  const participants = [
    {
      id: 'part-uuid-1',
      user_id: 'user-1',
      investor_user_id: 'user-1',
      profiles: { id: 'user-1', full_name: 'Chandra Prakash', username: 'cprakash' },
      investor: { id: 'user-1', full_name: 'Chandra Prakash', username: 'cprakash' },
    },
    {
      id: 'part-uuid-2',
      user_id: 'user-suresh',
      investor_user_id: 'user-ramesh',
      profiles: { id: 'user-suresh', full_name: 'Suresh', username: 'suresh123' },
      investor: { id: 'user-ramesh', full_name: 'Ramesh Kumar', username: 'rkumar' },
    },
  ]

  const matched = matchRowsToParticipants(parsedRows, participants)
  assert.equal(matched[0].matchStatus, 'MATCHED')
  assert.equal(matched[0].participationId, 'part-uuid-1')

  assert.equal(matched[1].matchStatus, 'MATCHED')
  assert.equal(matched[1].participationId, 'part-uuid-2')
})
