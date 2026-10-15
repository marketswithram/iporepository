/**
 * ipoFieldMapper.js
 * Normalizes raw IPO Gyani / external IPO JSON input into the Canonical IPO Model.
 * 
 * Modeling Rules:
 * 1. Do not treat valid 0 as missing.
 * 2. Do not replace null with 0.
 * 3. Do not convert descriptive strings like "2m ago" into numbers.
 * 4. Do not treat false as missing.
 * 5. Preserve distinction between undefined (missing), null, 0, false, and [].
 * 6. Preserve date-only values (YYYY-MM-DD).
 * 7. Preserve financial units and currencies.
 * 8. Keep raw source accessible for full fidelity.
 */

/**
 * Safely parse a date-only string (YYYY-MM-DD) or common date formats.
 * Avoids browser timezone offset issues by treating pure dates as UTC/calendar dates.
 */
export function normalizeDate(value) {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  if (!str || str.toLowerCase() === 'null' || str === '-') return null

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // Try Date parsing
  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return str // Return original string if unparseable date
}

/**
 * Safely extract a number without losing 0 or treating strings like "2m ago" as numbers.
 */
export function normalizeNumber(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const str = String(value).trim()
  if (str === '' || str.toLowerCase() === 'null' || str === '-') return null

  // If it's a relative time or text description, do NOT parse as number
  if (/ago|hour|min|day|sec|week|month|year/i.test(str)) {
    return null
  }

  // Strip currency symbols and commas e.g. "₹ 150.00" -> "150.00"
  const cleaned = str.replace(/[₹$,\s]/g, '')
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    const num = parseFloat(cleaned)
    return Number.isFinite(num) ? num : null
  }
  return null
}

/**
 * Safely normalize string or array of strings.
 */
export function normalizeString(value) {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str === '' ? null : str
}

export function normalizeArray(value) {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    // Split on comma or newline if string
    return trimmed.split(/,\s*|\n+/).map(s => s.trim()).filter(Boolean)
  }
  return [value]
}

/**
 * Maps and normalizes raw IPO input into the Canonical IPO Model.
 */
export function mapRawIpoToCanonical(rawInput = {}) {
  const raw = typeof rawInput === 'object' && rawInput !== null ? rawInput : {}

  const rawDetails = raw.ipo_details ?? {}
  const rawDates = raw.ipo_dates ?? {}
  const rawGmp = raw.gmp ?? {}
  const rawSub = raw.subscription ?? {}
  const rawQuota = raw.reservation_quota ?? {}
  const rawIssue = raw.issue_details ?? {}
  const rawLots = raw.lot_size_details ?? []
  const rawKpi = raw.kpi ?? {}
  const rawFin = raw.financials ?? {}
  const rawCompany = raw.company_details ?? {}
  const rawContact = raw.company_contact ?? {}
  const rawDocs = raw.official_documents ?? {}
  const rawFaq = raw.faq ?? []

  // 1. Basic IPO Details
  const ipoName = normalizeString(rawDetails.ipo_name || rawDetails.name || raw.ipo_name || raw.name)
  const companyName = normalizeString(rawDetails.company_name || rawCompany.name || raw.company_name || ipoName)
  const ipoType = normalizeString(rawDetails.ipo_type || rawDetails.type || raw.ipo_type)
  const marketSegment = normalizeString(rawDetails.market_segment || rawDetails.segment || raw.market_segment)
  const exchanges = normalizeArray(rawDetails.exchanges || raw.exchanges)
  const saleType = normalizeString(rawDetails.sale_type || rawDetails.issue_type)
  const issueType = normalizeString(rawDetails.issue_type)
  const faceValue = normalizeNumber(rawDetails.face_value)
  const minPrice = normalizeNumber(rawDetails.minimum_price ?? rawDetails.min_price)
  const maxPrice = normalizeNumber(rawDetails.maximum_price ?? rawDetails.max_price ?? rawDetails.price)
  const cutoffPrice = normalizeNumber(rawDetails.cutoff_price ?? rawDetails.cut_off_price ?? maxPrice)
  const lotSize = normalizeNumber(rawDetails.lot_size ?? raw.lot_size)
  const minInvestment = normalizeNumber(rawDetails.minimum_investment ?? rawDetails.min_investment)
  const issueSize = rawDetails.issue_size ?? rawIssue.total_issue_size ?? null
  const freshIssue = rawDetails.fresh_issue !== undefined ? rawDetails.fresh_issue : rawIssue.fresh_issue_amount !== undefined ? rawIssue.fresh_issue_amount : null
  const ofsPercentage = normalizeNumber(rawDetails.ofs_percentage)
  const ofsShares = normalizeNumber(rawDetails.ofs_shares)
  const preIssueShares = normalizeNumber(rawDetails.pre_issue_shares)
  const postIssueShares = normalizeNumber(rawDetails.post_issue_shares)
  const companyProceeds = rawDetails.company_proceeds !== undefined ? normalizeNumber(rawDetails.company_proceeds) : null
  const currency = normalizeString(rawDetails.currency || raw.currency) || 'INR'

  // Computed / Recommended ipo_price for the existing system (must be > 0)
  // Usually min_investment (e.g. 14,919) or max_price * lot_size or cutoff_price * lot_size
  let recommendedIpoPrice = 0
  if (minInvestment && minInvestment > 0) {
    recommendedIpoPrice = minInvestment
  } else if (maxPrice && lotSize && maxPrice > 0 && lotSize > 0) {
    recommendedIpoPrice = Math.round(maxPrice * lotSize * 100) / 100
  } else if (cutoffPrice && lotSize && cutoffPrice > 0 && lotSize > 0) {
    recommendedIpoPrice = Math.round(cutoffPrice * lotSize * 100) / 100
  } else if (maxPrice && maxPrice > 0) {
    recommendedIpoPrice = maxPrice
  } else if (raw.ipo_price && Number(raw.ipo_price) > 0) {
    recommendedIpoPrice = Number(raw.ipo_price)
  }

  // 2. Dates
  const startDate = normalizeDate(rawDates.opening_date || rawDates.open_date || raw.start_date || rawDates.start_date)
  const endDate = normalizeDate(rawDates.closing_date || rawDates.close_date || raw.end_date || rawDates.end_date)
  const allotmentDate = normalizeDate(rawDates.allotment_date || rawDates.basis_of_allotment)
  const refundDate = normalizeDate(rawDates.refund_date || rawDates.initiation_of_refunds)
  const dematCreditDate = normalizeDate(rawDates.demat_credit_date || rawDates.credit_of_shares_to_demat)
  const listingDate = normalizeDate(rawDates.listing_date)

  // 3. GMP
  const gmpPremium = normalizeNumber(rawGmp.premium ?? rawGmp.gmp)
  const gmpPremiumPct = normalizeNumber(rawGmp.premium_percentage ?? rawGmp.gmp_percentage)
  const gmpEstPrice = normalizeNumber(rawGmp.estimated_listing_price)
  const gmpEstProfit = normalizeNumber(rawGmp.estimated_profit_per_lot)
  const gmpLotSize = normalizeNumber(rawGmp.lot_size ?? lotSize)
  const gmpSourceUpdate = normalizeString(rawGmp.source_update_label || rawGmp.updated_label || rawGmp.time)
  const gmpIsOfficial = rawGmp.official_exchange_data === true || rawGmp.is_official === true
  const gmpDisclaimer = normalizeString(
    rawGmp.disclaimer ||
    rawGmp.disclaimer_note ||
    'GMP is unofficial and for informational purposes only. It is not official exchange data and does not guarantee listing gains.'
  )

  // 4. Subscription
  const subTotal = rawSub.total_subscription ?? rawSub.total ?? rawSub.multiple ?? null
  const subRetail = rawSub.retail ?? rawSub.retail_subscription ?? null
  const subNii = rawSub.nii ?? rawSub.nii_subscription ?? null
  const subQib = rawSub.qib ?? rawSub.qib_subscription ?? null
  const subPeriodLabel = normalizeString(rawSub.subscription_period_label || rawSub.day || rawSub.as_of)
  const subTrackerStatus = normalizeString(rawSub.source_tracker_status || rawSub.status)
  const subDisclaimer = normalizeString(rawSub.disclaimer || rawSub.explanatory_note)

  // 5. Reservation Quota
  const quotaQib = normalizeNumber(rawQuota.qib_percentage ?? rawQuota.qib)
  const quotaRetail = normalizeNumber(rawQuota.retail_percentage ?? rawQuota.retail)
  const quotaNii = normalizeNumber(rawQuota.nii_percentage ?? rawQuota.nii)

  // 6. Issue Details
  const objectsOfIssue = normalizeArray(rawIssue.objects_of_the_issue || rawIssue.objects)
  const leadManagers = normalizeArray(rawIssue.lead_managers || rawIssue.book_running_lead_managers)
  const registrar = typeof rawIssue.registrar === 'object' && rawIssue.registrar !== null
    ? rawIssue.registrar
    : { name: normalizeString(rawIssue.registrar) }

  // 7. Lot Size Details
  const lotSizeDetails = Array.isArray(rawLots)
    ? rawLots.map(l => ({
        category: normalizeString(l.category || l.type || 'Retail'),
        lots: normalizeNumber(l.lots),
        shares: normalizeNumber(l.shares),
        amount: normalizeNumber(l.amount),
      }))
    : []

  // 8. Financial KPIs
  const kpi = {
    reporting_periods: rawKpi.reporting_periods || null,
    roe: rawKpi.roe !== undefined ? rawKpi.roe : null,
    roce: rawKpi.roce !== undefined ? rawKpi.roce : null,
    debt_to_equity: rawKpi.debt_to_equity !== undefined ? rawKpi.debt_to_equity : (rawKpi.debt_equity_ratio !== undefined ? rawKpi.debt_equity_ratio : null),
    ronw: rawKpi.ronw !== undefined ? rawKpi.ronw : null,
    pat_margin: rawKpi.pat_margin !== undefined ? rawKpi.pat_margin : null,
    ebitda_margin: rawKpi.ebitda_margin !== undefined ? rawKpi.ebitda_margin : null,
    price_to_book: rawKpi.price_to_book !== undefined ? rawKpi.price_to_book : (rawKpi.pbv !== undefined ? rawKpi.pbv : null),
    pre_ipo_eps: rawKpi.pre_ipo_eps !== undefined ? rawKpi.pre_ipo_eps : null,
    post_ipo_eps: rawKpi.post_ipo_eps !== undefined ? rawKpi.post_ipo_eps : null,
    pre_ipo_pe: rawKpi.pre_ipo_pe !== undefined ? rawKpi.pre_ipo_pe : null,
    post_ipo_pe: rawKpi.post_ipo_pe !== undefined ? rawKpi.post_ipo_pe : null,
    pre_ipo_promoter_holding: rawKpi.pre_ipo_promoter_holding !== undefined ? rawKpi.pre_ipo_promoter_holding : null,
    post_ipo_promoter_holding: rawKpi.post_ipo_promoter_holding !== undefined ? rawKpi.post_ipo_promoter_holding : null,
    market_capitalization: rawKpi.market_capitalization !== undefined ? rawKpi.market_capitalization : (rawKpi.market_cap !== undefined ? rawKpi.market_cap : null),
  }

  // 9. Financial Statements
  const financials = {
    currency: normalizeString(rawFin.currency) || 'INR',
    unit: normalizeString(rawFin.unit) || '₹ in Crores',
    periods: rawFin.periods || (Array.isArray(rawFin) ? rawFin : {}),
  }

  // 10. Company Details
  const companyDetails = {
    name: companyName,
    industry: normalizeString(rawCompany.industry),
    incorporation_month: normalizeString(rawCompany.incorporation_month || rawCompany.incorporation_year || rawCompany.incorporation_date),
    manufacturing_locations: normalizeArray(rawCompany.manufacturing_locations),
    countries_exported_to: normalizeArray(rawCompany.countries_exported_to),
    ul_listed_certifications: normalizeArray(rawCompany.ul_listed_certifications),
    fm_approved_certifications: normalizeArray(rawCompany.fm_approved_certifications),
    customer_count: rawCompany.customer_count !== undefined ? rawCompany.customer_count : null,
    facilities: normalizeArray(rawCompany.facilities),
    major_projects: normalizeArray(rawCompany.major_projects),
    promoters: normalizeArray(rawCompany.promoters),
    summary: normalizeString(rawCompany.summary || rawCompany.about || rawCompany.description),
  }

  // 11. Company Contact
  const companyContact = {
    address: normalizeString(rawContact.address),
    phone: normalizeString(rawContact.phone),
    email: normalizeString(rawContact.email),
    website: normalizeString(rawContact.website),
  }

  // 12. Official Documents
  const officialDocuments = {
    drhp_link: normalizeString(rawDocs.drhp_link || rawDocs.drhp),
    rhp_link: normalizeString(rawDocs.rhp_link || rawDocs.rhp),
    document_notes: normalizeString(rawDocs.document_notes || rawDocs.notes),
  }

  // 13. FAQ
  const faq = Array.isArray(rawFaq)
    ? rawFaq.map(f => ({
        question: normalizeString(f.question || f.q),
        answer: normalizeString(f.answer || f.a),
      })).filter(f => f.question && f.answer)
    : []

  return {
    // Top-level mapped for existing `ipos` table
    ipo_name: ipoName,
    company_name: companyName,
    ipo_price: recommendedIpoPrice,
    start_date: startDate,
    end_date: endDate,
    status: 'DRAFT', // Always create as DRAFT in existing workflow

    // Extended structured details
    details: {
      company_name: companyName,
      ipo_type: ipoType,
      market_segment: marketSegment,
      exchanges: exchanges,
      sale_type: saleType,
      issue_type: issueType,
      face_value: faceValue,
      min_price: minPrice,
      max_price: maxPrice,
      cutoff_price: cutoffPrice,
      lot_size: lotSize,
      min_investment: minInvestment,
      issue_size: issueSize,
      fresh_issue: freshIssue,
      ofs_percentage: ofsPercentage,
      ofs_shares: ofsShares,
      pre_issue_shares: preIssueShares,
      post_issue_shares: postIssueShares,
      company_proceeds: companyProceeds,
      currency: currency,

      // Dates
      start_date: startDate,
      end_date: endDate,
      allotment_date: allotmentDate,
      refund_date: refundDate,
      demat_credit_date: dematCreditDate,
      listing_date: listingDate,

      // Sections
      gmp: {
        premium: gmpPremium,
        premium_percentage: gmpPremiumPct,
        estimated_listing_price: gmpEstPrice,
        estimated_listing_price_formula: normalizeString(rawGmp.estimated_listing_price_formula),
        estimated_profit_per_lot: gmpEstProfit,
        lot_size: gmpLotSize,
        source_update_label: gmpSourceUpdate,
        is_official: gmpIsOfficial,
        disclaimer: gmpDisclaimer,
      },
      subscription: {
        total: subTotal,
        retail: subRetail,
        nii: subNii,
        qib: subQib,
        period_label: subPeriodLabel,
        tracker_status: subTrackerStatus,
        disclaimer: subDisclaimer,
      },
      reservation_quota: {
        qib_percentage: quotaQib,
        retail_percentage: quotaRetail,
        nii_percentage: quotaNii,
        raw: rawQuota,
      },
      issue_details: {
        total_issue_size: rawIssue.total_issue_size || issueSize,
        retail_issue_size: rawIssue.retail_issue_size || null,
        fresh_issue_amount: rawIssue.fresh_issue_amount || null,
        ofs_amount: rawIssue.ofs_amount || null,
        objects_of_the_issue: objectsOfIssue,
        lead_managers: leadManagers,
        registrar: registrar,
      },
      lot_size_details: lotSizeDetails,
      kpi: kpi,
      financials: financials,
      company_details: companyDetails,
      company_contact: companyContact,
      official_documents: officialDocuments,
      faq: faq,

      // Traceability
      source: 'IPO Gyani',
      imported_at: new Date().toISOString(),
      raw_json: raw,
    },
  }
}
