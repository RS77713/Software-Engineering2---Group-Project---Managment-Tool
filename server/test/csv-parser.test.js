// Unit tests for the CSV parsing utility itself (server/csv-parser.js),
// independent of the import HTTP endpoint. Pure function, no database, no
// server — plain node:test.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CsvParseError, formatCsvField, parseCsv, stringifyCsv } from '../csv-parser.js'

test('parses a simple header + data rows, unquoted', () => {
  const { headers, rows } = parseCsv('title,severity\nLogin [Auth],Critical\nLogout [Auth],Minor\n')
  assert.deepEqual(headers, ['title', 'severity'])
  assert.deepEqual(
    rows.map((r) => r.cells),
    [
      ['Login [Auth]', 'Critical'],
      ['Logout [Auth]', 'Minor'],
    ]
  )
})

test('row numbers start at 2 for the first data row (header is row 1)', () => {
  const { rows } = parseCsv('title\nA\nB\nC\n')
  assert.deepEqual(
    rows.map((r) => r.rowNumber),
    [2, 3, 4]
  )
})

test('a quoted field may contain a comma', () => {
  const { rows } = parseCsv('title,notes\n"Has, a comma",fine\n')
  assert.deepEqual(rows[0].cells, ['Has, a comma', 'fine'])
})

test('a quoted field may contain embedded newlines (multiline steps), counted as one row', () => {
  const csv = 'title,steps\n"Login [Auth]","Step one.\nStep two.\nStep three."\n"Next [Auth]",Only step\n'
  const { rows } = parseCsv(csv)
  assert.equal(rows.length, 2, 'the multi-line field must not be split into extra rows')
  assert.equal(rows[0].cells[1], 'Step one.\nStep two.\nStep three.')
  assert.equal(rows[1].rowNumber, 3, 'row numbering must count the multi-line row as exactly one row')
})

test('a doubled quote ("") inside a quoted field is an escaped literal quote', () => {
  const { rows } = parseCsv('title,steps\n"Click ""Log in"".",fine\n')
  assert.equal(rows[0].cells[0], 'Click "Log in".')
})

test('CRLF line endings are handled the same as LF', () => {
  const { headers, rows } = parseCsv('title,severity\r\nA [X],Critical\r\nB [X],Minor\r\n')
  assert.deepEqual(headers, ['title', 'severity'])
  assert.deepEqual(
    rows.map((r) => r.cells),
    [
      ['A [X]', 'Critical'],
      ['B [X]', 'Minor'],
    ]
  )
})

test('a leading UTF-8 BOM is stripped, and non-ASCII content is preserved', () => {
  const csv = '﻿title,notes\n"Uses non-ASCII: café, emoji 🎉",fine\n'
  const { headers, rows } = parseCsv(csv)
  assert.equal(headers[0], 'title', 'the BOM must not leak into the first header name')
  assert.equal(rows[0].cells[0], 'Uses non-ASCII: café, emoji 🎉')
})

test('a file with no trailing newline still captures its last row', () => {
  const { rows } = parseCsv('title\nA\nB')
  assert.deepEqual(
    rows.map((r) => r.cells[0]),
    ['A', 'B']
  )
})

test('fully blank lines are skipped entirely — not counted as a row, and row numbers stay contiguous', () => {
  const { rows } = parseCsv('title\nA\n\nB\n,,\nC\n')
  assert.deepEqual(
    rows.map((r) => r.cells[0]),
    ['A', 'B', 'C']
  )
  assert.deepEqual(
    rows.map((r) => r.rowNumber),
    [2, 3, 4],
    'blank lines (both empty and all-commas) must not consume a row number'
  )
})

test('a row with a different column count than the header is still returned as-is — the caller decides what to do with it', () => {
  const { headers, rows } = parseCsv('title,severity,steps\nOnly one field\n')
  assert.equal(headers.length, 3)
  assert.deepEqual(rows[0].cells, ['Only one field'])
})

test('an unterminated quoted field throws a CsvParseError instead of silently swallowing the rest of the file', () => {
  assert.throws(() => parseCsv('title,notes\n"Never closed,fine\n'), CsvParseError)
})

test('a completely empty file throws a CsvParseError', () => {
  assert.throws(() => parseCsv(''), CsvParseError)
})

test('a file containing only blank lines throws a CsvParseError (no header row exists)', () => {
  assert.throws(() => parseCsv('\n\n,,\n\n'), CsvParseError)
})

test('formatCsvField leaves a plain value unquoted', () => {
  assert.equal(formatCsvField('Critical'), 'Critical')
  assert.equal(formatCsvField(42), '42')
})

test('formatCsvField quotes a value containing a comma, a quote, or a line break, and doubles internal quotes', () => {
  assert.equal(formatCsvField('a, b'), '"a, b"')
  assert.equal(formatCsvField('Click "Log in".'), '"Click ""Log in""."')
  assert.equal(formatCsvField('line one\nline two'), '"line one\nline two"')
})

test('formatCsvField turns null/undefined into an empty (unquoted) field', () => {
  assert.equal(formatCsvField(null), '')
  assert.equal(formatCsvField(undefined), '')
})

test('stringifyCsv round-trips through parseCsv: commas, quotes, multiline steps, and UTF-8 all survive exactly', () => {
  const headers = ['title', 'steps', 'notes']
  const originalSteps = ['Go to the login page.', 'Enter "valid" credentials, then submit.', 'Confirm café ☕ appears.']
  const rows = [['Login, with comma [X]', originalSteps.join('\n'), 'plain'], ['UTF-8 test [X]', 'Single step: 日本語 🎉', '']]

  const csv = stringifyCsv(headers, rows)
  assert.match(csv, /^﻿/, 'export must lead with a UTF-8 BOM')

  const parsed = parseCsv(csv)
  assert.deepEqual(parsed.headers, headers)
  assert.equal(parsed.rows.length, 2)
  assert.deepEqual(parsed.rows[0].cells, ['Login, with comma [X]', originalSteps.join('\n'), 'plain'])
  assert.deepEqual(parsed.rows[0].cells[1].split('\n'), originalSteps)
  assert.deepEqual(parsed.rows[1].cells, ['UTF-8 test [X]', 'Single step: 日本語 🎉', ''])
})

test('stringifyCsv with zero rows still produces a valid, parseable header-only document', () => {
  const csv = stringifyCsv(['title', 'severity'], [])
  const parsed = parseCsv(csv)
  assert.deepEqual(parsed.headers, ['title', 'severity'])
  assert.equal(parsed.rows.length, 0)
})
