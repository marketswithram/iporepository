/**
 * test/pan.test.js — PAN helper used by /register, /user/profile and /user/apply
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAN_REGEX, normalizePan, isValidPan } from '../src/utils/pan.js'

test('PAN: accepts well-formed numbers (case/space insensitive)', () => {
  assert.equal(isValidPan('ABCDE1234F'), true)
  assert.equal(isValidPan('  abcde1234f '), true)
  assert.equal(normalizePan(' abcde1234f '), 'ABCDE1234F')
})

test('PAN: rejects malformed numbers', () => {
  for (const bad of ['', 'ABCDE1234', 'ABCDE12345', '1BCDE1234F', 'ABCD1234FF', 'ABCDE1234F1', 'ABC DE1234F']) {
    assert.equal(isValidPan(bad), false, `${JSON.stringify(bad)} should be invalid`)
  }
  assert.equal(isValidPan(null), false)
  assert.equal(isValidPan(undefined), false)
})

test('PAN: format matches the database constraint pattern', () => {
  assert.equal(PAN_REGEX.source, '^[A-Z]{5}[0-9]{4}[A-Z]$')
})