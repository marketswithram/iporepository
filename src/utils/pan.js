/**
 * pan.js
 * =======
 * Helpers for the Indian PAN (Permanent Account Number): 5 letters, 4 digits, 1 letter
 * (e.g. ABCDE1234F). Mirrors the profiles_pan_number_format_check constraint in the database.
 */

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/

/** Trim + upper-case a user-entered PAN. */
export function normalizePan(value) {
  return String(value ?? '').trim().toUpperCase()
}

/** True when the value (after normalising) is a well-formed PAN. */
export function isValidPan(value) {
  return PAN_REGEX.test(normalizePan(value))
}