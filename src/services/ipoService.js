import { supabase } from '../lib/supabaseClient'

// ---- PUBLIC ----
export async function getOpenIpos() {
  try {
    const { data, error } = await supabase
      .from('ipos')
      .select(`
        id, ipo_code, ipo_name, ipo_price, start_date, end_date, status, created_at,
        ipo_details (
          company_name, ipo_type, market_segment, issue_size, lot_size, min_investment, gmp_data
        )
      `)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data ?? []).map(item => ({
      ...item,
      details: Array.isArray(item.ipo_details) ? item.ipo_details[0] : item.ipo_details
    }))
  } catch (err) {
    // Graceful fallback if ipo_details join is unavailable or fails
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('ipos')
      .select('id, ipo_code, ipo_name, ipo_price, start_date, end_date, status, created_at')
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })

    if (fallbackError) throw fallbackError
    return fallbackData ?? []
  }
}

export async function getPublicIpos({ page = 1, pageSize = 10 } = {}) {
  const from = (page - 1) * pageSize
  try {
    const { data, error, count } = await supabase
      .from('ipos')
      .select(`
        id, ipo_code, ipo_name, ipo_price, start_date, end_date, status, created_at,
        ipo_details (
          company_name, ipo_type, market_segment, issue_size, lot_size, min_investment, gmp_data
        )
      `, { count: 'exact' })
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) throw error

    const mapped = (data ?? []).map(item => ({
      ...item,
      details: Array.isArray(item.ipo_details) ? item.ipo_details[0] : item.ipo_details
    }))
    return { data: mapped, count: count ?? 0 }
  } catch (err) {
    const { data: fallbackData, error: fallbackError, count } = await supabase
      .from('ipos')
      .select('id, ipo_code, ipo_name, ipo_price, start_date, end_date, status, created_at', { count: 'exact' })
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (fallbackError) throw fallbackError
    return { data: fallbackData ?? [], count: count ?? 0 }
  }
}

// ---- USER ----
export async function getUserParticipatedIpos({ page = 1, pageSize = 10, userId = null } = {}) {
  const from = (page - 1) * pageSize
  let query = supabase
    .from('ipo_participations')
    .select(`id, ipo_id, participation_type, application_number, amount_contributed, investor_user_id, user_id, created_at,
      ipos(id, ipo_code, ipo_name, ipo_price, start_date, end_date, status, overall_profit, completed_at),
      ipo_results(applied, allotted, lots, refund_amount, profit_amount, tax_amount, final_settlement_amount, result_status),
      profiles!user_id(id, username, full_name),
      investor:profiles!investor_user_id(id, username, full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)
  if (userId) {
    query = query.or(`user_id.eq.${userId},investor_user_id.eq.${userId}`)
  }
  const { data, error, count } = await query
  if (error) throw error

  const rows = data ?? []

  // Ensure ipo details and original name are present even if join was restricted by RLS
  const missingIpoIds = rows
    .filter(p => {
      const obj = Array.isArray(p.ipos) ? p.ipos[0] : p.ipos
      return !obj?.ipo_name
    })
    .map(p => p.ipo_id)
    .filter(Boolean)

  if (missingIpoIds.length > 0) {
    try {
      const { data: ipoRows } = await supabase
        .from('ipos')
        .select('id, ipo_code, ipo_name, ipo_price, start_date, end_date, status, overall_profit, completed_at')
        .in('id', missingIpoIds)
      const ipoMap = new Map((ipoRows ?? []).map(i => [i.id, i]))

      let detailMap = new Map()
      try {
        const { data: detailRows } = await supabase.rpc('get_user_ipo_profit_detail', userId ? { p_user_id: userId } : {})
        if (detailRows) {
          detailMap = new Map(detailRows.map(d => [d.ipo_id, d]))
        }
      } catch (e) {
        // fallback ignored
      }

      for (const p of rows) {
        const obj = Array.isArray(p.ipos) ? p.ipos[0] : p.ipos
        if (!obj?.ipo_name && p.ipo_id) {
          if (ipoMap.has(p.ipo_id)) {
            p.ipos = ipoMap.get(p.ipo_id)
          } else if (detailMap.has(p.ipo_id)) {
            const d = detailMap.get(p.ipo_id)
            p.ipos = {
              id: d.ipo_id,
              ipo_name: d.ipo_name,
              ipo_code: d.ipo_code,
              completed_at: d.completed_at,
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error resolving missing ipo rows:', err)
    }
  }

  const items = rows.map(p => {
    const r = Array.isArray(p.ipo_results) ? p.ipo_results[0] : p.ipo_results
    const rawProfit = Number(r?.profit_amount ?? 0)
    const isInvestor = p.investor_user_id === userId
    const isHolder = p.user_id === userId

    let userProfit = 0
    let userRole = 'DIRECT'
    let profitSharePct = 100

    if (isInvestor && isHolder) {
      userProfit = rawProfit
      userRole = 'DIRECT'
      profitSharePct = 100
    } else if (isInvestor) {
      userProfit = Math.round(rawProfit * 0.8 * 100) / 100
      userRole = 'INVESTOR'
      profitSharePct = 80
    } else if (isHolder) {
      userProfit = Math.round(rawProfit * 0.2 * 100) / 100
      userRole = 'ACCOUNT_HOLDER'
      profitSharePct = 20
    } else {
      userProfit = rawProfit
    }

    return {
      ...p,
      user_profit: userProfit,
      user_role: userRole,
      profit_share_pct: profitSharePct,
    }
  })

  return { data: items, count: count ?? 0 }
}

export async function checkExistingParticipation(ipoId) {
  const { data, error } = await supabase.rpc('check_existing_participation', { p_ipo_id: ipoId })
  if (error) throw error
  return data
}

export async function submitParticipation({ ipoId, participationType, applicationNumber, userId, investorUserId, amountContributed }) {
  // For INVESTOR: investor_user_id = userId (themselves)
  // For ACCOUNT_HOLDER: investor_user_id = the selected investor's id
  const investorId = participationType === 'INVESTOR' ? userId : (investorUserId ?? userId)
  const { data, error } = await supabase
    .from('ipo_participations')
    .insert({
      ipo_id: ipoId,
      user_id: userId,
      participation_type: participationType,
      // Both investors and account holders now record an application number
      application_number: applicationNumber?.trim() || null,
      investor_user_id: investorId,
      amount_contributed: amountContributed ?? null,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function getParticipationWithResult(participationId, currentUserId = null) {
  const { data, error } = await supabase
    .from('ipo_participations')
    .select(`id, ipo_id, participation_type, application_number, amount_contributed, investor_user_id, user_id, created_at,
      ipos(id, ipo_code, ipo_name, ipo_price, start_date, end_date, status, overall_profit, completed_at),
      ipo_results(*),
      profiles!user_id(id, username, full_name),
      investor:profiles!investor_user_id(id, username, full_name)`)
    .eq('id', participationId).single()
  if (error) throw error
  if (!data) return null

  // Ensure ipo details are present if join was missing
  const ipoObj = Array.isArray(data.ipos) ? data.ipos[0] : data.ipos
  if (!ipoObj?.ipo_name && data.ipo_id) {
    try {
      const { data: ipoData } = await supabase
        .from('ipos')
        .select('id, ipo_code, ipo_name, ipo_price, start_date, end_date, status, overall_profit, completed_at')
        .eq('id', data.ipo_id).maybeSingle()
      if (ipoData) {
        data.ipos = ipoData
      }
    } catch (e) {
      // fallback ignored
    }
  }

  const r = Array.isArray(data.ipo_results) ? data.ipo_results[0] : data.ipo_results
  const rawProfit = Number(r?.profit_amount ?? 0)
  const isInvestor = currentUserId ? data.investor_user_id === currentUserId : data.participation_type === 'INVESTOR'
  const isHolder = currentUserId ? data.user_id === currentUserId : false

  let userProfit = rawProfit
  let userRole = 'DIRECT'
  let profitSharePct = 100

  if (data.investor_user_id === data.user_id) {
    userProfit = rawProfit
    userRole = 'DIRECT'
    profitSharePct = 100
  } else if (isInvestor && !isHolder) {
    userProfit = Math.round(rawProfit * 0.8 * 100) / 100
    userRole = 'INVESTOR'
    profitSharePct = 80
  } else if (isHolder && !isInvestor) {
    userProfit = Math.round(rawProfit * 0.2 * 100) / 100
    userRole = 'ACCOUNT_HOLDER'
    profitSharePct = 20
  }

  return {
    ...data,
    user_profit: userProfit,
    user_role: userRole,
    profit_share_pct: profitSharePct,
  }
}

export async function getUserProfitLossSummary(userId = null) {
  const params = userId ? { p_user_id: userId } : {}
  let summary = null
  try {
    let res = await supabase.rpc('get_user_profit_loss_summary', params)
    if (res.error) {
      res = await supabase.rpc('get_user_profit_loss_summary')
    }
    if (!res.error && res.data) {
      summary = res.data
    }
  } catch (err) {
    console.warn('RPC get_user_profit_loss_summary failed, using fallback:', err)
  }

  // Reconcile / ensure total_profit & net_profit match user_ipo_profits table directly
  try {
    let query = supabase.from('user_ipo_profits').select('total_profit')
    if (userId) query = query.eq('user_id', userId)
    const { data: profitRows } = await query
    if (profitRows && profitRows.length > 0) {
      let netFromTable = 0
      let totalProfitFromTable = 0
      let totalLossFromTable = 0
      for (const r of profitRows) {
        const p = Number(r.total_profit ?? 0)
        netFromTable += p
        if (p > 0) totalProfitFromTable += p
        else if (p < 0) totalLossFromTable += Math.abs(p)
      }

      if (!summary) {
        summary = {
          total_ipos: profitRows.length,
          total_allotted: profitRows.length,
          total_not_allotted: 0,
          total_profit: totalProfitFromTable,
          total_loss: totalLossFromTable,
          net_profit: netFromTable,
          total_refund: 0,
          total_tax: 0,
          total_settlement: 0,
        }
      } else {
        // Override with exact values from user_ipo_profits table
        summary.total_profit = totalProfitFromTable
        summary.total_loss = totalLossFromTable
        summary.net_profit = netFromTable
      }
    }
  } catch (err) {
    console.warn('Error reading user_ipo_profits directly:', err)
  }

  // Reconcile distinct IPO counts from ipo_participations
  try {
    let partQuery = supabase
      .from('ipo_participations')
      .select('ipo_id, ipo_results(allotted)')
    if (userId) {
      partQuery = partQuery.or(`user_id.eq.${userId},investor_user_id.eq.${userId}`)
    }
    const { data: partRows } = await partQuery
    if (partRows && partRows.length > 0) {
      const distinctIpos = new Set()
      const allottedIpos = new Set()
      for (const pt of partRows) {
        if (pt.ipo_id) {
          distinctIpos.add(pt.ipo_id)
          const r = Array.isArray(pt.ipo_results) ? pt.ipo_results[0] : pt.ipo_results
          if (r?.allotted) {
            allottedIpos.add(pt.ipo_id)
          }
        }
      }
      if (!summary) {
        summary = {
          total_ipos: distinctIpos.size,
          total_allotted: allottedIpos.size,
          total_not_allotted: Math.max(0, distinctIpos.size - allottedIpos.size),
          total_profit: 0,
          total_loss: 0,
          net_profit: 0,
          total_refund: 0,
          total_tax: 0,
          total_settlement: 0,
        }
      } else {
        summary.total_ipos = distinctIpos.size
        summary.total_allotted = allottedIpos.size
        summary.total_not_allotted = Math.max(0, distinctIpos.size - allottedIpos.size)
      }
    }
  } catch (err) {
    console.error('Error fetching distinct ipo counts:', err)
  }

  return summary
}

// ---- ADMIN ----
export async function getAdminIpos({ page = 1, pageSize = 15, status = null, search = '', sortBy = 'created_at', sortAsc = false } = {}) {
  const from = (page - 1) * pageSize
  let query = supabase.from('ipos').select('*, profiles!created_by(username, full_name)', { count: 'exact' })
  if (status) query = query.eq('status', status)
  if (search) query = query.or(`ipo_name.ilike.%${search}%,ipo_code.ilike.%${search}%`)
  const { data, error, count } = await query.order(sortBy, { ascending: sortAsc }).range(from, from + pageSize - 1)
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function getAdminIpoDetail(ipoId) {
  const { data: ipo, error } = await supabase
    .from('ipos').select('*, profiles!created_by(username, full_name)').eq('id', ipoId).single()
  if (error) throw error

  let details = null
  try {
    const { data: d, error: dErr } = await supabase
      .from('ipo_details')
      .select('*')
      .eq('ipo_id', ipoId)
      .maybeSingle()
    if (!dErr && d) {
      details = d
    }
  } catch (dErr) {
    console.warn('Error reading ipo_details in getAdminIpoDetail:', dErr)
  }

  const [{ count: total }, { count: investors }, { count: accountHolders }] = await Promise.all([
    supabase.from('ipo_participations').select('*', { count: 'exact', head: true }).eq('ipo_id', ipoId),
    supabase.from('ipo_participations').select('*', { count: 'exact', head: true }).eq('ipo_id', ipoId).eq('participation_type', 'INVESTOR'),
    supabase.from('ipo_participations').select('*', { count: 'exact', head: true }).eq('ipo_id', ipoId).eq('participation_type', 'ACCOUNT_HOLDER'),
  ])

  return { ...ipo, details: details ?? null, totalParticipants: total ?? 0, investorCount: investors ?? 0, accountHolderCount: accountHolders ?? 0 }
}

export async function createIpo({ ipoName, ipoPrice, startDate, endDate, status = 'OPEN', createdBy }) {
  return createIpoWithDetails({
    ipoName,
    ipoPrice,
    startDate,
    endDate,
    status: status || 'OPEN',
    createdBy,
    details: null,
  })
}

export async function createIpoWithDetails({ ipoName, ipoPrice, startDate, endDate, status = 'OPEN', createdBy, details = null }) {
  // 1. Try atomic RPC create_ipo_with_details
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_ipo_with_details', {
      p_ipo_name: ipoName.trim(),
      p_ipo_price: ipoPrice,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_status: status || 'OPEN',
      p_created_by: createdBy,
      p_details: details || {},
    })

    if (!rpcError && rpcData) {
      return rpcData
    }
    if (rpcError && rpcError.code !== '42883' && !rpcError.message?.includes('does not exist')) {
      throw rpcError
    }
  } catch (err) {
    if (err.code !== '42883' && !err.message?.includes('does not exist')) {
      throw err
    }
  }

  // 2. Fallback: manual sequential write if RPC has not been executed yet
  const { data: ipo, error: ipoErr } = await supabase
    .from('ipos')
    .insert({
      ipo_name: ipoName.trim(),
      ipo_price: ipoPrice,
      start_date: startDate,
      end_date: endDate,
      status: status || 'OPEN',
      created_by: createdBy,
    })
    .select()
    .single()

  if (ipoErr) throw ipoErr

  if (details && ipo?.id) {
    try {
      const detailsPayload = {
        ipo_id: ipo.id,
        company_name: details.company_name || ipoName,
        ipo_type: details.ipo_type || null,
        market_segment: details.market_segment || null,
        exchanges: details.exchanges || [],
        sale_type: details.sale_type || null,
        issue_type: details.issue_type || null,
        face_value: details.face_value || null,
        min_price: details.min_price || null,
        max_price: details.max_price || null,
        cutoff_price: details.cutoff_price || null,
        lot_size: details.lot_size || null,
        min_investment: details.min_investment || null,
        issue_size: details.issue_size || null,
        fresh_issue: details.fresh_issue !== undefined ? details.fresh_issue : null,
        ofs_percentage: details.ofs_percentage || null,
        ofs_shares: details.ofs_shares || null,
        pre_issue_shares: details.pre_issue_shares || null,
        post_issue_shares: details.post_issue_shares || null,
        company_proceeds: details.company_proceeds !== undefined ? details.company_proceeds : null,
        currency: details.currency || 'INR',
        allotment_date: details.allotment_date || null,
        refund_date: details.refund_date || null,
        demat_credit_date: details.demat_credit_date || null,
        listing_date: details.listing_date || null,
        gmp_data: details.gmp || {},
        subscription_data: details.subscription || {},
        reservation_quota: details.reservation_quota || {},
        issue_details: details.issue_details || {},
        lot_size_details: details.lot_size_details || [],
        kpi_data: details.kpi || {},
        financials_data: details.financials || {},
        company_details: details.company_details || {},
        company_contact: details.company_contact || {},
        official_documents: details.official_documents || {},
        faq_data: details.faq || [],
        raw_json: details.raw_json || null,
        source: details.source || 'IPO Gyani',
      }

      const { error: detailsErr } = await supabase
        .from('ipo_details')
        .insert(detailsPayload)

      if (detailsErr) {
        console.warn('Notice: ipo_details write failed (schema migration 008 may be required):', detailsErr.message)
      }
    } catch (dErr) {
      console.warn('Error inserting ipo_details:', dErr)
    }
  }

  return ipo
}

export async function getIpoWithDetails(ipoId) {
  const { data: ipo, error: ipoError } = await supabase
    .from('ipos')
    .select('*, profiles!created_by(username, full_name)')
    .eq('id', ipoId)
    .single()

  if (ipoError) throw ipoError
  if (!ipo) return null

  let details = null
  try {
    const { data: detailsData, error: detailsError } = await supabase
      .from('ipo_details')
      .select('*')
      .eq('ipo_id', ipoId)
      .maybeSingle()

    if (!detailsError && detailsData) {
      details = detailsData
    }
  } catch (err) {
    console.warn('Notice: ipo_details table query error:', err)
  }

  return { ...ipo, details }
}

export async function updateIpoStatus(ipoId, status) {
  const { data, error } = await supabase.from('ipos').update({ status }).eq('id', ipoId).select().single()
  if (error) throw error
  return data
}

export async function updateIpo(ipoId, updates) {
  const { data, error } = await supabase.from('ipos').update(updates).eq('id', ipoId).select().single()
  if (error) throw error
  return data
}

export async function getIpoParticipants(ipoId, { type = null } = {}) {
  // `*` (rather than a column list) so optional columns such as is_admin_default are returned
  // when present without breaking databases that haven't applied that migration yet.
  let query = supabase.from('ipo_participations')
    .select(`*,
      profiles!user_id(id, username, full_name, email),
      investor:profiles!investor_user_id(id, username, full_name)`)
    .eq('ipo_id', ipoId).order('participation_type')
  if (type) query = query.eq('participation_type', type)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Add / change / clear the signed-in user's own PAN (empty string clears it).
 * Backed by the update_my_pan RPC (migration 012).
 */
export async function updateMyPan(pan) {
  const { data, error } = await supabase.rpc('update_my_pan', { p_pan: pan ?? '' })
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) {
      throw new Error('PAN support needs database migration 012. Ask the administrator to run supabase/migrations/012_profile_pan_number.sql.')
    }
    throw error
  }
  if (data?.success === false) throw new Error(data.error || 'Could not update PAN.')
  return data
}

/**
 * Include / remove the default admin participant ("markets with ram") for an IPO.
 * Backed by the set_ipo_admin_participation RPC (migration 011).
 */
export async function setIpoAdminParticipation(ipoId, include) {
  const { data, error } = await supabase.rpc('set_ipo_admin_participation', {
    p_ipo_id: ipoId,
    p_include: !!include,
  })
  if (error) {
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) {
      throw new Error('The "include admin" option needs database migration 011. Run supabase/migrations/011_admin_default_participant_and_source_type_fix.sql in the Supabase SQL editor.')
    }
    throw error
  }
  if (data?.success === false) throw new Error(data.error || 'Could not update admin participation.')
  return data
}

export async function getFormattedParticipantList(ipoId) {
  const { data, error } = await supabase.rpc('get_ipo_participant_list', { p_ipo_id: ipoId })
  if (error) throw error
  return data ?? []
}

export async function createImportSession({ ipoId, importedBy, sourceType, totalRows }) {
  const { data, error } = await supabase
    .from('ipo_result_imports')
    .insert({ ipo_id: ipoId, imported_by: importedBy, source_type: sourceType, total_rows: totalRows, status: 'PENDING' })
    .select().single()
  if (error) throw error
  return data
}

export async function submitIpoResults({ ipoId, importId, overallProfit, results }) {
  const { data, error } = await supabase.rpc('submit_ipo_results', {
    p_ipo_id: ipoId, p_import_id: importId, p_overall_profit: overallProfit, p_results: results,
  })
  if (error) throw error
  return data
}

export async function recordSettlementRun({
  ipoId,
  publishedBy,
  effectiveSellingPrice,
  totalSellingCharges,
  totalAllottedLots,
  totalProfit,
  totalTaxReserve,
  distributableProfit,
  totalContributed,
  sumProfitShares,
  roundingResidual,
  taxRate,
  selectedApplicants,
  settlementSummary,
  status = 'PUBLISHED',
}) {
  try {
    const { data, error } = await supabase
      .from('ipo_settlement_runs')
      .insert({
        ipo_id:                  ipoId,
        published_by:            publishedBy,
        effective_selling_price: effectiveSellingPrice,
        total_selling_charges:   totalSellingCharges,
        total_allotted_lots:     totalAllottedLots,
        total_profit:            totalProfit,
        total_tax_reserve:       totalTaxReserve,
        distributable_profit:    distributableProfit,
        total_contributed:       totalContributed,
        sum_profit_shares:       sumProfitShares,
        rounding_residual:       roundingResidual,
        tax_rate:                taxRate,
        selected_applicants:     selectedApplicants,
        settlement_summary:      settlementSummary,
        status,
      })
      .select()
      .maybeSingle()
    if (!error && data) return data
  } catch (err) {
    console.warn('ipo_settlement_runs insert skipped or failed:', err)
  }
  return null
}

export async function getLatestSettlementRun(ipoId) {
  try {
    const { data, error } = await supabase
      .from('ipo_settlement_runs')
      .select('*')
      .eq('ipo_id', ipoId)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!error && data) return data
  } catch (err) {
    console.warn('ipo_settlement_runs query skipped or failed:', err)
  }
  return null
}

export async function getAdminDashboardStats() {
  const { data, error } = await supabase.rpc('get_admin_dashboard_stats')
  if (error) throw error
  return data
}

export async function getIpoResultReport(ipoId) {
  const { data, error } = await supabase.rpc('get_ipo_result_report', { p_ipo_id: ipoId })
  if (error) throw error
  return data ?? []
}

export async function getRecentIpos(limit = 10) {
  const { data, error } = await supabase
    .from('ipos').select('id, ipo_code, ipo_name, status, overall_profit, completed_at, created_at')
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getAdminUsers({ page = 1, pageSize = 20, search = '', approvalStatus = null } = {}) {
  const from = (page - 1) * pageSize
  let query = supabase.from('profiles').select('*', { count: 'exact' })
  if (search) query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`)
  if (approvalStatus) {
    if (approvalStatus === 'PENDING') {
      query = query.or('is_approved.is.false,approval_status.eq.PENDING')
    } else if (approvalStatus === 'APPROVED') {
      query = query.eq('is_approved', true)
    } else {
      query = query.eq('approval_status', approvalStatus)
    }
  }
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function logUserActivity({ userId, actionType, actionTitle, details = '', actorId = null, metadata = {} }) {
  if (!userId) return
  try {
    const { error } = await supabase.from('user_activity_logs').insert({
      user_id: userId,
      action_type: actionType,
      action_title: actionTitle,
      details: details,
      actor_id: actorId,
      metadata: metadata,
      created_at: new Date().toISOString(),
    })
    if (error && error.code !== '42P01') {
      console.warn('logUserActivity error:', error.message)
    }
  } catch (err) {
    // Non-blocking log
    console.warn('logUserActivity caught error:', err)
  }
}

export async function getUserActivityHistory({ page = 1, pageSize = 25, search = '', actionFilter = null } = {}) {
  const from = (page - 1) * pageSize

  // 1. Try querying public.user_activity_logs
  try {
    let query = supabase
      .from('user_activity_logs')
      .select(`
        id, user_id, action_type, action_title, details, actor_id, metadata, created_at,
        user:profiles!user_id(id, username, full_name, email, role, is_active, is_approved, approval_status),
        actor:profiles!actor_id(id, username, full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    if (actionFilter && actionFilter !== 'ALL') {
      if (actionFilter === 'APPROVALS') {
        query = query.in('action_type', ['APPROVED', 'REJECTED', 'APPROVAL_STATUS_CHANGED'])
      } else if (actionFilter === 'STATUS') {
        query = query.in('action_type', ['ACTIVATED', 'DEACTIVATED'])
      } else if (actionFilter === 'CREATED') {
        query = query.in('action_type', ['CREATED', 'CREATED_AND_APPROVED'])
      } else {
        query = query.eq('action_type', actionFilter)
      }
    }

    const { data, error, count } = await query.range(from, from + pageSize - 1)

    if (!error && data) {
      let filtered = data
      if (search) {
        const s = search.toLowerCase()
        filtered = filtered.filter(item => {
          const u = item.user
          return (
            u?.username?.toLowerCase().includes(s) ||
            u?.full_name?.toLowerCase().includes(s) ||
            u?.email?.toLowerCase().includes(s) ||
            item.action_title?.toLowerCase().includes(s) ||
            item.details?.toLowerCase().includes(s)
          )
        })
      }
      return { data: filtered, count: count ?? filtered.length }
    }
  } catch (err) {
    console.warn('user_activity_logs table query failed, using synthetic fallback:', err)
  }

  // 2. Fallback: synthesize history events from profiles table if table not yet migrated
  try {
    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('id, username, full_name, email, role, is_active, is_approved, approval_status, approved_at, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (pError || !profiles) return { data: [], count: 0 }

    const syntheticLogs = []

    for (const p of profiles) {
      // Creation Event
      const isApprovedAtStart = p.is_approved === true
      syntheticLogs.push({
        id: `created-${p.id}`,
        user_id: p.id,
        action_type: isApprovedAtStart ? 'CREATED_AND_APPROVED' : 'CREATED',
        action_title: isApprovedAtStart ? 'Account Created & Approved' : 'New Registration Submitted',
        details: isApprovedAtStart
          ? `Account for ${p.full_name} (@${p.username}) was created with instant approval.`
          : `User @${p.username} registered and requested access.`,
        created_at: p.created_at,
        user: p,
        actor: null,
      })

      // Approval Event (if approved after creation)
      if (p.is_approved && p.approved_at) {
        const createTime = new Date(p.created_at).getTime()
        const approveTime = new Date(p.approved_at).getTime()
        if (approveTime > createTime + 10000) {
          syntheticLogs.push({
            id: `approved-${p.id}`,
            user_id: p.id,
            action_type: 'APPROVED',
            action_title: 'User Approved',
            details: `User @${p.username} was approved with platform access.`,
            created_at: p.approved_at,
            user: p,
            actor: null,
          })
        }
      }

      // Inactive Event
      if (!p.is_active && p.updated_at) {
        syntheticLogs.push({
          id: `deactivated-${p.id}`,
          user_id: p.id,
          action_type: 'DEACTIVATED',
          action_title: 'User Account Deactivated',
          details: `User @${p.username} account was deactivated / suspended.`,
          created_at: p.updated_at,
          user: p,
          actor: null,
        })
      }
    }

    // Sort descending by created_at (latest to old)
    syntheticLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    let result = syntheticLogs
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(item => {
        const u = item.user
        return (
          u?.username?.toLowerCase().includes(s) ||
          u?.full_name?.toLowerCase().includes(s) ||
          u?.email?.toLowerCase().includes(s) ||
          item.action_title?.toLowerCase().includes(s) ||
          item.details?.toLowerCase().includes(s)
        )
      })
    }

    if (actionFilter && actionFilter !== 'ALL') {
      if (actionFilter === 'APPROVALS') {
        result = result.filter(i => ['APPROVED', 'REJECTED'].includes(i.action_type))
      } else if (actionFilter === 'STATUS') {
        result = result.filter(i => ['ACTIVATED', 'DEACTIVATED'].includes(i.action_type))
      } else if (actionFilter === 'CREATED') {
        result = result.filter(i => ['CREATED', 'CREATED_AND_APPROVED'].includes(i.action_type))
      }
    }

    const paged = result.slice(from, from + pageSize)
    return { data: paged, count: result.length }
  } catch (err) {
    console.error('Failed to generate activity history:', err)
    return { data: [], count: 0 }
  }
}

export async function toggleUserActive(userId, isActive) {
  const { data, error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', userId).select().single()
  if (error) throw error

  // Log user status change
  await logUserActivity({
    userId,
    actionType: isActive ? 'ACTIVATED' : 'DEACTIVATED',
    actionTitle: isActive ? 'User Account Activated' : 'User Account Deactivated',
    details: isActive
      ? `User @${data.username} account was reactivated by administrator.`
      : `User @${data.username} account was deactivated / suspended by administrator.`,
    metadata: { is_active: isActive, username: data.username, email: data.email }
  })

  return data
}

export async function adminSetUserApproval(userId, status) {
  let result = null

  // 1. Try RPC admin_set_user_approval
  try {
    const { data, error } = await supabase.rpc('admin_set_user_approval', {
      p_user_id: userId,
      p_status: status,
    })
    if (!error && data?.success) result = data
  } catch (err) {
    console.warn('RPC admin_set_user_approval failed, using direct update:', err)
  }

  // 2. Direct update fallback
  if (!result) {
    const isApproved = status === 'APPROVED'
    const { data, error } = await supabase
      .from('profiles')
      .update({
        is_approved: isApproved,
        approval_status: status,
        approved_at: isApproved ? new Date().toISOString() : null,
      })
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    result = { success: true, user: data }
  }

  // Log approval action
  const isApproved = status === 'APPROVED'
  const isRejected = status === 'REJECTED'
  await logUserActivity({
    userId,
    actionType: isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : 'APPROVAL_STATUS_CHANGED',
    actionTitle: isApproved ? 'User Approved' : isRejected ? 'User Registration Rejected' : `Approval Status: ${status}`,
    details: isApproved
      ? 'User registration was approved with full system access.'
      : isRejected
      ? 'User registration was rejected by administrator.'
      : `Approval status was updated to ${status}.`,
    metadata: { approval_status: status }
  })

  return result
}

export async function adminCreateUser({ email, password, username, fullName, role = 'user' }) {
  const cleanEmail = email.trim().toLowerCase()
  const cleanUsername = username.trim().toLowerCase()
  const cleanFullName = fullName.trim()

  // 1. Pre-validation for duplicate username or email
  try {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id, username, email')
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .maybeSingle()

    if (existingUser) {
      if (existingUser.email?.toLowerCase() === cleanEmail) {
        return { error: 'A user with this email address already exists.' }
      }
      if (existingUser.username?.toLowerCase() === cleanUsername) {
        return { error: 'A user with this username already exists.' }
      }
    }
  } catch (err) {
    // Continue
  }

  // 2. Primary: Create user via isolated Supabase client using official GoTrue Auth API
  // This guarantees full GoTrue schema integrity (tokens, password encryption, auth.identities)
  // preventing 500 "Database error querying schema" on login, without signing out the current admin.
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const { createClient } = await import('@supabase/supabase-js')
    const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          username: cleanUsername,
          full_name: cleanFullName,
          role: role,
          is_approved: true,
        }
      }
    })

    if (signUpError) {
      throw signUpError
    }

    const newUserId = signUpData?.user?.id
    if (newUserId) {
      // Ensure profile record is immediately active and approved
      await supabase.from('profiles').upsert({
        id: newUserId,
        username: cleanUsername,
        full_name: cleanFullName,
        email: cleanEmail,
        role: role,
        is_active: true,
        is_approved: true,
        approval_status: 'APPROVED',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      // Log in user activity history
      await logUserActivity({
        userId: newUserId,
        actionType: 'CREATED_AND_APPROVED',
        actionTitle: 'Account Created & Auto-Approved',
        details: `Account for ${cleanFullName} (@${cleanUsername}) was created by administrator with instant approval.`,
        metadata: { username: cleanUsername, email: cleanEmail, role, auto_approved: true }
      })

      return {
        success: true,
        user_id: newUserId,
        email: cleanEmail,
        username: cleanUsername,
        full_name: cleanFullName,
      }
    }
  } catch (authErr) {
    console.warn('Isolated auth.signUp error, falling back to RPC:', authErr)
    // 3. Fallback: Try RPC admin_create_user
    try {
      const { data, error } = await supabase.rpc('admin_create_user', {
        p_email: cleanEmail,
        p_password: password,
        p_username: cleanUsername,
        p_full_name: cleanFullName,
        p_role: role,
      })
      if (!error && data?.success) {
        await logUserActivity({
          userId: data.user_id,
          actionType: 'CREATED_AND_APPROVED',
          actionTitle: 'Account Created & Auto-Approved',
          details: `Account for ${cleanFullName} (@${cleanUsername}) was created by administrator.`,
          metadata: { username: cleanUsername, email: cleanEmail, role }
        })
        return data
      }
      return { error: error?.message || authErr?.message || 'Failed to create user' }
    } catch (rpcErr) {
      return { error: authErr?.message || rpcErr?.message || 'Failed to create user' }
    }
  }
}

export async function getAdminUserDetail(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error

  const [summary, partData, profitDetail] = await Promise.allSettled([
    getUserProfitLossSummary(userId),
    getUserParticipatedIpos({ page: 1, pageSize: 100, userId }),
    getUserIpoProfitDetail(userId),
  ])

  return {
    profile,
    summary: summary.status === 'fulfilled' ? summary.value : null,
    participations: partData.status === 'fulfilled' ? partData.value?.data ?? [] : [],
    profitDetail: profitDetail.status === 'fulfilled' ? profitDetail.value ?? [] : [],
  }
}

// ---- INVESTOR SELECTION (for Apply form Account Holder dropdown) ----
export async function getRegisteredUsers() {
  const { data, error } = await supabase.rpc('get_all_users_for_selection')
  if (error) throw error
  return data ?? []
}

// ---- USER PROFIT DETAIL ----
export async function getUserIpoProfitDetail(userId = null) {
  const params = userId ? { p_user_id: userId } : {}
  let res = await supabase.rpc('get_user_ipo_profit_detail', params)
  if (res.error) {
    res = await supabase.rpc('get_user_ipo_profit_detail')
  }
  if (!res.error && res.data && res.data.length > 0) {
    return res.data
  }

  // Fallback: direct query from user_ipo_profits table with ipos join
  try {
    let query = supabase
      .from('user_ipo_profits')
      .select(`ipo_id, investor_share, account_holder_share, total_profit,
        ipos(id, ipo_name, ipo_code, completed_at)`)
    if (userId) query = query.eq('user_id', userId)
    const { data, error } = await query
    if (error || !data) return []
    return data.map(row => ({
      ipo_id: row.ipo_id,
      ipo_name: row.ipos?.ipo_name ?? '—',
      ipo_code: row.ipos?.ipo_code ?? '',
      completed_at: row.ipos?.completed_at,
      investor_share: Number(row.investor_share ?? 0),
      account_holder_share: Number(row.account_holder_share ?? 0),
      total_profit: Number(row.total_profit ?? 0),
    }))
  } catch (err) {
    console.error('Fallback profit detail error:', err)
    return []
  }
}