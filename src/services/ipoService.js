import { supabase } from '../lib/supabaseClient'

// ---- PUBLIC ----
export async function getOpenIpos() {
  const { data, error } = await supabase
    .from('ipos').select('id, ipo_code, ipo_name, ipo_price, start_date, end_date, status')
    .eq('status', 'OPEN').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getPublicIpos({ page = 1, pageSize = 10 } = {}) {
  const from = (page - 1) * pageSize
  const { data, error, count } = await supabase
    .from('ipos').select('id, ipo_code, ipo_name, ipo_price, start_date, end_date, status', { count: 'exact' })
    .eq('status', 'OPEN').order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
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
      application_number: participationType === 'INVESTOR' ? applicationNumber?.trim() : null,
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
  const [{ count: total }, { count: investors }, { count: accountHolders }] = await Promise.all([
    supabase.from('ipo_participations').select('*', { count: 'exact', head: true }).eq('ipo_id', ipoId),
    supabase.from('ipo_participations').select('*', { count: 'exact', head: true }).eq('ipo_id', ipoId).eq('participation_type', 'INVESTOR'),
    supabase.from('ipo_participations').select('*', { count: 'exact', head: true }).eq('ipo_id', ipoId).eq('participation_type', 'ACCOUNT_HOLDER'),
  ])
  return { ...ipo, totalParticipants: total ?? 0, investorCount: investors ?? 0, accountHolderCount: accountHolders ?? 0 }
}

export async function createIpo({ ipoName, ipoPrice, startDate, endDate, createdBy }) {
  const { data, error } = await supabase
    .from('ipos')
    .insert({ ipo_name: ipoName.trim(), ipo_price: ipoPrice, start_date: startDate, end_date: endDate, status: 'DRAFT', created_by: createdBy })
    .select().single()
  if (error) throw error
  return data
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
  let query = supabase.from('ipo_participations')
    .select(`id, participation_type, application_number, amount_contributed, investor_user_id, created_at,
      profiles!user_id(id, username, full_name, email),
      investor:profiles!investor_user_id(id, username, full_name)`)
    .eq('ipo_id', ipoId).order('participation_type')
  if (type) query = query.eq('participation_type', type)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
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

export async function toggleUserActive(userId, isActive) {
  const { data, error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', userId).select().single()
  if (error) throw error
  return data
}

export async function adminSetUserApproval(userId, status) {
  // Try RPC first
  try {
    const { data, error } = await supabase.rpc('admin_set_user_approval', {
      p_user_id: userId,
      p_status: status,
    })
    if (!error && data?.success) return data
  } catch (err) {
    console.warn('RPC admin_set_user_approval failed, using direct update:', err)
  }

  // Fallback direct update on public.profiles
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
  return { success: true, user: data }
}

export async function adminCreateUser({ email, password, username, fullName, role = 'user' }) {
  // 1. Try RPC admin_create_user
  try {
    const { data, error } = await supabase.rpc('admin_create_user', {
      p_email: email.trim(),
      p_password: password,
      p_username: username.trim().toLowerCase(),
      p_full_name: fullName.trim(),
      p_role: role,
    })
    if (!error && data?.success) {
      return data
    }
    if (error && error.message) {
      console.warn('RPC admin_create_user error:', error)
    }
  } catch (err) {
    console.warn('RPC admin_create_user caught error:', err)
  }

  // 2. Fallback: create via isolated Supabase client without logging out admin
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const { createClient } = await import('@supabase/supabase-js')
  const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
    email: email.trim(),
    password: password,
    options: {
      data: {
        username: username.trim().toLowerCase(),
        full_name: fullName.trim(),
        role: role,
        is_approved: true,
      }
    }
  })
  if (signUpError) throw signUpError

  const newUserId = signUpData?.user?.id
  if (newUserId) {
    // Ensure profile is marked approved
    await supabase.from('profiles').update({
      is_approved: true,
      approval_status: 'APPROVED',
      approved_at: new Date().toISOString(),
    }).eq('id', newUserId)
  }

  return {
    success: true,
    user_id: newUserId,
    email,
    username,
    full_name: fullName,
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
