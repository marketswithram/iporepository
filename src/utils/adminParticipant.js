/**
 * adminParticipant.js
 * ====================
 * The optional "default admin" participant that an admin can include per IPO
 * (checkbox on /admin/ipos/:ipoId). It is stored as a normal ipo_participations
 * row flagged with is_admin_default = true, but both its investor name and its
 * account holder name are displayed as ADMIN_DISPLAY_NAME.
 */

export const ADMIN_DISPLAY_NAME = 'markets with ram'

/**
 * Resolve the investor / account holder display names of a participation row
 * returned by getIpoParticipants().
 *
 * @param {object} p - participation row (with joined `profiles` = account holder, `investor`)
 * @returns {{investorName: string, accountHolderName: string, isAdminDefault: boolean}}
 */
export function getParticipantDisplayNames(p) {
  if (p?.is_admin_default) {
    return {
      investorName: ADMIN_DISPLAY_NAME,
      accountHolderName: ADMIN_DISPLAY_NAME,
      isAdminDefault: true,
    }
  }
  const accountHolderName = p?.profiles?.full_name || '—'
  const investorName = p?.investor?.full_name || p?.profiles?.full_name || '—'
  return { investorName, accountHolderName, isAdminDefault: false }
}