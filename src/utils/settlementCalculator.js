/**
 * settlementCalculator.js
 * ========================
 * Pure, deterministic financial calculation engine for IPO settlement.
 * All formulas verified against Moneyview_IPO.xlsx.
 *
 * FORMULA REFERENCE (verified from workbook):
 *   N21  = sum(sellingPrices) / count             — effective selling price
 *   O21  = sum(sellingCharges)                    — total selling charges
 *   N5   = (N21 - N3) × N4 × totalAllottedLots   — total profit (no formula in workbook)
 *   N7   = N5 × N6 (20%)                         — total tax reserve
 *   N9   = N5 - N7 - N8                          — distributable profit
 *   Ii   = ROUND(N9 × Ci / SUM(C2:C22), 1)      — profit share (ALL applicants)
 *   Ji   = IF(Gi="Yes", (N2-N3)×N4×N6×lots, 0)  — tax reserve (allotted only)
 *   Ki   = Ii + Ji                                — final settlement
 *   Hi   = Ci (amount contributed)                — refund
 *
 * KNOWN WORKBOOK INCONSISTENCIES:
 *   - N5 has no formula; candidate formula (above) gives 22257.27 vs stored 22252.86
 *   - J9=2452 and J18=1998 are hardcoded; formula gives 2225.43 for each
 *   - Tax column formula only in rows 2–8; rows 9–22 have no formula (hardcoded 0 or value)
 *   - All 21 applicants receive profit share via formula (not just allotted ones)
 *
 * PRECISION RULES:
 *   - Profit share rounded to 1 decimal place (Excel ROUND(..., 1))
 *   - Tax reserve rounded to 2 decimal places
 *   - All other intermediate values preserved at full JS float precision
 *   - Display formatting handled separately (see formatters.js)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safe numeric conversion. Throws if value is not a finite number.
 * @param {*} value
 * @param {string} label - Human-readable field name for error messages
 * @returns {number}
 */
export function requireFinite(value, label) {
  const n = Number(value)
  if (!isFinite(n)) throw new Error(`${label} must be a valid finite number (got: ${JSON.stringify(value)})`)
  return n
}

/**
 * Round to N decimal places using standard half-up rounding.
 * Matches Excel's ROUND() behaviour for positive values.
 */
export function roundTo(value, decimals) {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

// ---------------------------------------------------------------------------
// Step 1 — Effective Selling Price
// ---------------------------------------------------------------------------

/**
 * Arithmetic average of the selected applicants' selling prices.
 * Excel: N21 = sum(N18, N19) / 2
 *
 * @param {Array<{sellingPrice: number}>} selectedApplicants
 * @returns {number} Full-precision average (e.g. 59.235)
 */
export function calculateEffectiveSellingPrice(selectedApplicants) {
  if (!selectedApplicants || selectedApplicants.length === 0) {
    throw new Error('At least one applicant must be selected.')
  }
  for (let i = 0; i < selectedApplicants.length; i++) {
    const p = requireFinite(selectedApplicants[i].sellingPrice, `sellingPrice[${i}]`)
    if (p <= 0) throw new Error(`Selling price for applicant ${i + 1} must be a positive number.`)
  }
  const total = selectedApplicants.reduce((sum, a) => sum + Number(a.sellingPrice), 0)
  return total / selectedApplicants.length
}

// ---------------------------------------------------------------------------
// Step 2 — Total Selling Charges
// ---------------------------------------------------------------------------

/**
 * Sum of selling charges for all selected applicants.
 * Excel: O21 = sum(O18, O19)
 *
 * @param {Array<{sellingCharge: number}>} selectedApplicants
 * @returns {number}
 */
export function calculateTotalSellingCharges(selectedApplicants) {
  if (!selectedApplicants || selectedApplicants.length === 0) {
    throw new Error('At least one applicant must be selected.')
  }
  for (let i = 0; i < selectedApplicants.length; i++) {
    const c = requireFinite(selectedApplicants[i].sellingCharge, `sellingCharge[${i}]`)
    if (c < 0) throw new Error(`Selling charge for applicant ${i + 1} must be non-negative.`)
  }
  return selectedApplicants.reduce((sum, a) => sum + Number(a.sellingCharge), 0)
}

// ---------------------------------------------------------------------------
// Step 3 — Total Allotted Lots
// ---------------------------------------------------------------------------

/**
 * Sum of lots from selected (allotted) applicants.
 *
 * @param {Array<{lots: number}>} selectedApplicants
 * @returns {number}
 */
export function calculateTotalAllottedLots(selectedApplicants) {
  if (!selectedApplicants || selectedApplicants.length === 0) return 0
  return selectedApplicants.reduce((sum, a) => {
    const lots = requireFinite(a.lots ?? 1, 'lots')
    if (lots < 1) throw new Error('Each selected applicant must have at least 1 lot allotted.')
    return sum + lots
  }, 0)
}

// ---------------------------------------------------------------------------
// Step 4 — Total Profit
// ---------------------------------------------------------------------------

/**
 * Total IPO profit.
 * Candidate formula (not present as Excel formula in workbook):
 *   Total Profit = (effectiveSellingPrice - issuePrice) × lotSize × totalAllottedLots
 *
 * NOTE: The workbook stores N5=22252.86 manually. Our formula gives 22257.27 for the
 * sample data. This discrepancy is documented and the admin is shown the calculated value.
 *
 * @param {number} effectiveSellingPrice
 * @param {number} issuePrice
 * @param {number} lotSize
 * @param {number} totalAllottedLots
 * @returns {number}
 */
export function calculateTotalProfit(effectiveSellingPrice, issuePrice, lotSize, totalAllottedLots) {
  requireFinite(effectiveSellingPrice, 'effectiveSellingPrice')
  requireFinite(issuePrice, 'issuePrice')
  requireFinite(lotSize, 'lotSize')
  requireFinite(totalAllottedLots, 'totalAllottedLots')
  if (issuePrice <= 0) throw new Error('Issue price must be a positive number.')
  if (lotSize <= 0)    throw new Error('Lot size must be a positive integer.')
  if (effectiveSellingPrice <= issuePrice) {
    // Allow calculation even at loss; but warn. Settlement can still proceed.
    // Return negative or zero profit.
  }
  return (effectiveSellingPrice - issuePrice) * lotSize * totalAllottedLots
}

// ---------------------------------------------------------------------------
// Step 5 — Total Tax Reserve
// ---------------------------------------------------------------------------

/**
 * 20% of total profit (tax rate from workbook cell N6).
 * Excel: N7 = N5 × N6
 *
 * @param {number} totalProfit
 * @param {number} taxRate - Default 0.20 (20%)
 * @returns {number}
 */
export function calculateTotalTaxReserve(totalProfit, taxRate = 0.20) {
  requireFinite(totalProfit, 'totalProfit')
  if (taxRate < 0 || taxRate > 1) throw new Error(`Tax rate must be between 0 and 1 (got: ${taxRate})`)
  return totalProfit * taxRate
}

// ---------------------------------------------------------------------------
// Step 6 — Distributable Profit
// ---------------------------------------------------------------------------

/**
 * Profit available for distribution to all participants.
 * Excel: N9 = N5 - N7 - N8
 *
 * @param {number} totalProfit
 * @param {number} totalTaxReserve
 * @param {number} totalSellingCharges
 * @returns {number}
 */
export function calculateDistributableProfit(totalProfit, totalTaxReserve, totalSellingCharges) {
  requireFinite(totalProfit, 'totalProfit')
  requireFinite(totalTaxReserve, 'totalTaxReserve')
  requireFinite(totalSellingCharges, 'totalSellingCharges')
  return totalProfit - totalTaxReserve - totalSellingCharges
}

// ---------------------------------------------------------------------------
// Step 7 — Total Amount Contributed (denominator)
// ---------------------------------------------------------------------------

/**
 * Sum of amount_contributed across ALL applicants in the IPO (not just selected).
 * This is the SUM($C$2:$C$22) in the Excel formula.
 *
 * @param {Array<{amountContributed: number}>} allApplicants
 * @returns {number}
 */
export function calculateTotalAmountContributed(allApplicants) {
  if (!allApplicants || allApplicants.length === 0) {
    throw new Error('No applicants found for this IPO.')
  }
  const total = allApplicants.reduce((sum, a) => {
    const amt = requireFinite(a.amountContributed ?? a.amount_contributed ?? 0, 'amountContributed')
    if (amt < 0) throw new Error('Amount contributed cannot be negative.')
    return sum + amt
  }, 0)
  if (total <= 0) throw new Error('Total amount contributed must be greater than zero. Cannot distribute profit.')
  return total
}

// ---------------------------------------------------------------------------
// Step 8 — Per-Applicant Profit Share
// ---------------------------------------------------------------------------

/**
 * Proportional profit share for a single applicant.
 * Excel: I2 = ROUND($N$9 * C2 / SUM($C$2:$C$22), 1)
 *
 * Applied to ALL applicants (selected and unselected) — confirmed from workbook.
 *
 * @param {number} distributableProfit - N9
 * @param {number} amountContributed  - individual C column
 * @param {number} totalAmountContributed - SUM(C2:C22)
 * @returns {number} Rounded to 1 decimal place
 */
export function calculateProfitShare(distributableProfit, amountContributed, totalAmountContributed) {
  requireFinite(distributableProfit, 'distributableProfit')
  requireFinite(amountContributed, 'amountContributed')
  requireFinite(totalAmountContributed, 'totalAmountContributed')
  if (totalAmountContributed <= 0) throw new Error('Total amount contributed is zero — cannot compute profit share.')
  const raw = distributableProfit * amountContributed / totalAmountContributed
  return roundTo(raw, 1)
}

// ---------------------------------------------------------------------------
// Step 9 — Per-Applicant Tax Reserve
// ---------------------------------------------------------------------------

/**
 * Tax reserve for a single applicant.
 * Excel: J2 = IF(G2="Yes", (N2 - N3) × N4 × N6, 0)
 *
 * Only allotted applicants receive a tax reserve.
 * Uses the effective selling price (full precision), issue price, lot size, tax rate.
 *
 * @param {boolean} isAllotted
 * @param {number} effectiveSellingPrice - N21 (full precision)
 * @param {number} issuePrice           - N3
 * @param {number} lotSize              - N4
 * @param {number} taxRate              - N6 = 0.20
 * @param {number} lots                 - applicant's allotted lots (usually 1)
 * @returns {number} Rounded to 2 decimal places
 */
export function calculateApplicantTaxReserve(
  isAllotted,
  effectiveSellingPrice,
  issuePrice,
  lotSize,
  taxRate = 0.20,
  lots = 1
) {
  if (!isAllotted) return 0
  requireFinite(effectiveSellingPrice, 'effectiveSellingPrice')
  requireFinite(issuePrice, 'issuePrice')
  requireFinite(lotSize, 'lotSize')
  const raw = (effectiveSellingPrice - issuePrice) * lotSize * taxRate * lots
  return roundTo(raw, 2)
}

// ---------------------------------------------------------------------------
// Step 10 — Refund
// ---------------------------------------------------------------------------

/**
 * Refund equals the amount contributed (from DB record).
 * Excel: H column = C column (amount contributed)
 *
 * @param {number} amountContributed
 * @returns {number}
 */
export function calculateRefund(amountContributed) {
  return requireFinite(amountContributed, 'amountContributed')
}

// ---------------------------------------------------------------------------
// Step 11 — Final Settlement
// ---------------------------------------------------------------------------

/**
 * Final settlement = Profit Share + Tax Reserve.
 * Excel: K2 = I2 + J2
 *
 * @param {number} profitShare
 * @param {number} taxReserve
 * @returns {number}
 */
export function calculateFinalSettlement(profitShare, taxReserve) {
  requireFinite(profitShare, 'profitShare')
  requireFinite(taxReserve, 'taxReserve')
  return roundTo(profitShare + taxReserve, 2)
}

// ---------------------------------------------------------------------------
// Main: Generate Complete Settlement Preview
// ---------------------------------------------------------------------------

/**
 * Generates the full settlement preview for all applicants in an IPO.
 *
 * @param {object} params
 * @param {object}   params.ipo                  - IPO record: { ipo_price, lot_size }
 * @param {Array}    params.allApplicants         - All participation records for the IPO
 * @param {Array}    params.selectedApplicants    - Subset of allApplicants that are allotted
 *   Each selected applicant must have { participationId, sellingPrice, sellingCharge }
 * @param {number}   [params.taxRate]             - Default 0.20
 *
 * Each applicant object must have:
 *   { id, full_name, amountContributed, lots, appliedFrom }
 *
 * @returns {object} Full settlement preview
 */
export function generateSettlementPreview({ ipo, allApplicants, selectedApplicants, taxRate = 0.20 }) {
  // --- Validate IPO inputs ---
  const issuePrice = requireFinite(ipo.ipo_price, 'IPO issue price')
  const lotSize    = requireFinite(ipo.lot_size ?? ipo.ipo_lot_size ?? 1, 'IPO lot size')
  if (issuePrice <= 0) throw new Error('IPO issue price must be positive.')
  if (lotSize    <= 0) throw new Error('IPO lot size must be a positive integer.')

  // --- Step 1: Effective selling price ---
  const effectiveSellingPrice = calculateEffectiveSellingPrice(selectedApplicants)

  // --- Step 2: Total selling charges ---
  const totalSellingCharges = calculateTotalSellingCharges(selectedApplicants)

  // --- Step 3: Total allotted lots ---
  const totalAllottedLots = calculateTotalAllottedLots(selectedApplicants)

  // --- Step 4: Total profit ---
  const totalProfit = calculateTotalProfit(effectiveSellingPrice, issuePrice, lotSize, totalAllottedLots)

  // --- Step 5: Total tax reserve ---
  const totalTaxReserve = calculateTotalTaxReserve(totalProfit, taxRate)

  // --- Step 6: Distributable profit ---
  const distributableProfit = calculateDistributableProfit(totalProfit, totalTaxReserve, totalSellingCharges)

  // --- Step 7: Total amount contributed (from ALL applicants) ---
  const totalAmountContributed = calculateTotalAmountContributed(allApplicants)

  // Build a lookup of selected applicant IDs for O(1) allotment checks
  const selectedIds = new Set(selectedApplicants.map(a => a.participationId || a.id))
  const selectedLotsMap = Object.fromEntries(
    selectedApplicants.map(a => [a.participationId || a.id, Number(a.lots ?? 1)])
  )

  // --- Step 8–11: Per-applicant rows ---
  let sumProfitShares = 0
  let sumTaxReserves  = 0
  let serial = 1

  const rows = allApplicants.map(applicant => {
    const participationId   = applicant.id
    const isAllotted        = selectedIds.has(participationId)
    const amountContributed = Number(applicant.amountContributed ?? applicant.amount_contributed ?? 0)
    const lots              = isAllotted ? (selectedLotsMap[participationId] ?? 1) : (applicant.lots ?? 0)

    const profitShare    = calculateProfitShare(distributableProfit, amountContributed, totalAmountContributed)
    const taxReserve     = calculateApplicantTaxReserve(isAllotted, effectiveSellingPrice, issuePrice, lotSize, taxRate, lots)
    const refund         = calculateRefund(amountContributed)
    const finalSettlement = calculateFinalSettlement(profitShare, taxReserve)

    sumProfitShares += profitShare
    sumTaxReserves  += taxReserve

    return {
      serial:           serial++,
      participationId,
      investorName:     applicant.investor_name    ?? applicant.investorName    ?? applicant.full_name ?? '—',
      amountContributed,
      appliedFrom:      applicant.applied_from      ?? applicant.appliedFrom     ?? applicant.account_holder_name ?? '—',
      lots,
      appliedAmount:    amountContributed,
      allotted:         isAllotted,
      refund,
      profitShare,
      taxReserve,
      finalSettlement,
    }
  })

  // --- Reconciliation checks ---
  const roundingResidual = roundTo(distributableProfit - roundTo(sumProfitShares, 1), 2)
  const taxResidual      = roundTo(totalTaxReserve - roundTo(sumTaxReserves, 2), 2)
  const warnings = []
  if (Math.abs(roundingResidual) > 1) {
    warnings.push(`Profit share rounding residual is ₹${roundingResidual} — exceeds ₹1 threshold.`)
  }
  if (Math.abs(taxResidual) > 10) {
    warnings.push(`Tax reserve residual is ₹${taxResidual} — this is expected due to workbook inconsistencies.`)
  }

  return {
    // Summary
    summary: {
      ipoName:               ipo.ipo_name,
      issuePrice,
      lotSize,
      totalApplicants:       allApplicants.length,
      allottedApplicants:    selectedApplicants.length,
      effectiveSellingPrice,
      totalSellingCharges,
      totalAllottedLots,
      totalProfit,
      totalTaxReserve,
      distributableProfit,
      totalAmountContributed,
      sumProfitShares:       roundTo(sumProfitShares, 1),
      sumTaxReserves:        roundTo(sumTaxReserves, 2),
      roundingResidual,
      taxResidual,
      taxRate,
    },
    rows,
    warnings,
    // Overall profit to pass to submit_ipo_results
    overallProfit: roundTo(sumProfitShares, 2),
  }
}
