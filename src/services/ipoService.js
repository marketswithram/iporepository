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
    .select(`id, participation_type, application_number, created_at,
      ipos(id, ipo_code, ipo_name, ipo_price, start_date, end_date, status, overall_profit, completed_at),
      ipo_results(applied, allotted, lots, refund_amount, profit_amount, tax_amount, final_settlement_amount, result_status)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)
  if (userId) query = query.eq('user_id', userId)
  const { data, error, count } = await query
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function checkExistingParticipation(ipoId) {
  const { data, error } = await supabase.rpc('check_existing_participation', { p_ipo_id: ipoId })
  if (error) throw error
  return data
}

export async function submitParticipation({ ipoId, participationType, applicationNumber, userId }) {
  const { data, error } = await supabase
    .from('ipo_participations')
    .insert({ ipo_id: ipoId, user_id: userId, participation_type: participationType,
              application_number: participationType === 'INVESTOR' ? applicationNumber?.trim() : null })
    .select().single()
  if (error) throw error
  return data
}

export async function getParticipationWithResult(participationId) {
  const { data, error } = await supabase
    .from('ipo_participations')
    .select(`id, participation_type, application_number, created_at,
      ipos(id, ipo_code, ipo_name, ipo_price, start_date, end_date, status, overall_profit, completed_at),
      ipo_results(*)`)
    .eq('id', participationId).single()
  if (error) throw error
  return data
}

export async function getUserProfitLossSummary() {
  const { data, error } = await supabase.rpc('get_user_profit_loss_summary')
  if (error) throw error
  return data
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
    .select('id, participation_type, application_number, created_at, profiles(id, username, full_name, email)')
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

export async function getAdminUsers({ page = 1, pageSize = 20, search = '' } = {}) {
  const from = (page - 1) * pageSize
  let query = supabase.from('profiles').select('*', { count: 'exact' })
  if (search) query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`)
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function toggleUserActive(userId, isActive) {
  const { data, error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', userId).select().single()
  if (error) throw error
  return data
}
