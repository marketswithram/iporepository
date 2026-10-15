/**
 * ipoJsonParser.js
 * Safe JSON parser with precise syntax error localization and diagnostic messages.
 */

/**
 * Calculates line number and column number from a character index in a string.
 */
function getLineAndColFromIndex(text, index) {
  if (index < 0) return { line: 1, col: 1 }
  const lines = text.slice(0, index).split('\n')
  const line = lines.length
  const col = lines[lines.length - 1].length + 1
  return { line, col }
}

/**
 * Attempts to extract error position from standard JSON.parse error message.
 * e.g., "Unexpected token '}', ... is not valid JSON at position 124"
 * or "JSON.parse: unexpected character at line 4 column 2 of the JSON data"
 */
function extractPositionFromError(errMessage, text) {
  // Pattern 1: "... at position 123"
  const posMatch = errMessage.match(/at position (\d+)/i)
  if (posMatch) {
    const charIndex = parseInt(posMatch[1], 10)
    return { charIndex, ...getLineAndColFromIndex(text, charIndex) }
  }

  // Pattern 2: "... line 12 column 34"
  const lineColMatch = errMessage.match(/line (\d+) column (\d+)/i)
  if (lineColMatch) {
    return {
      line: parseInt(lineColMatch[1], 10),
      col: parseInt(lineColMatch[2], 10),
      charIndex: null,
    }
  }

  return { line: null, col: null, charIndex: null }
}

/**
 * Provides helpful diagnostic hints based on common syntax blunders (missing commas, trailing commas, single quotes).
 */
function getSyntaxHint(rawString, errPosition) {
  if (/'/.test(rawString) && !/"/.test(rawString)) {
    return 'JSON requires double quotes ("...") for property names and strings, not single quotes (\'...\').'
  }

  if (errPosition.line && errPosition.line > 1) {
    const lines = rawString.split('\n')
    const prevLine = lines[errPosition.line - 2]?.trim()
    if (prevLine && !prevLine.endsWith(',') && !prevLine.endsWith('{') && !prevLine.endsWith('[')) {
      return `Line ${errPosition.line - 1} might be missing a comma at the end.`
    }
  }

  return null
}

/**
 * Safely parses raw JSON text.
 * 
 * @param {string} rawString 
 * @returns {{ success: boolean, data: object|null, error: string|null, errorDetails: object|null }}
 */
export function safeParseIpoJson(rawString) {
  if (!rawString || typeof rawString !== 'string' || !rawString.trim()) {
    return {
      success: false,
      data: null,
      error: 'Pasted text is empty. Please paste valid IPO JSON.',
      errorDetails: null,
    }
  }

  const trimmed = rawString.trim()

  // Guard against non-JSON inputs like HTML, XML, or plain text
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return {
      success: false,
      data: null,
      error: 'Input does not start with "{" or "[". Please ensure you copied a valid JSON object.',
      errorDetails: { line: 1, col: 1 },
    }
  }

  try {
    const parsed = JSON.parse(trimmed)

    if (typeof parsed !== 'object' || parsed === null) {
      return {
        success: false,
        data: null,
        error: 'JSON must represent an object or array.',
        errorDetails: null,
      }
    }

    return {
      success: true,
      data: parsed,
      error: null,
      errorDetails: null,
    }
  } catch (err) {
    const rawMsg = err?.message || 'Syntax error in JSON.'
    const pos = extractPositionFromError(rawMsg, trimmed)
    const hint = getSyntaxHint(trimmed, pos)

    let formattedMsg = `JSON Syntax Error: ${rawMsg}`
    if (pos.line && pos.col) {
      formattedMsg = `JSON Syntax Error at Line ${pos.line}, Column ${pos.col}: ${rawMsg}`
    }
    if (hint) {
      formattedMsg += ` Hint: ${hint}`
    }

    return {
      success: false,
      data: null,
      error: formattedMsg,
      errorDetails: {
        rawMessage: rawMsg,
        line: pos.line,
        col: pos.col,
        charIndex: pos.charIndex,
        hint: hint,
      },
    }
  }
}
