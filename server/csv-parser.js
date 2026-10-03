// A small, dependency-free RFC-4180-style CSV parser: quoted fields,
// embedded commas/newlines inside a quoted field, `""` as an escaped
// literal quote, both CRLF and LF line endings, and an optional UTF-8 BOM.
// It knows nothing about test-case fields — that mapping happens in
// server/routes/test-cases.js. A row is "blank" (and silently skipped,
// not counted or reported) when every one of its cells is an empty
// string — covers both a truly empty line and an all-commas line like
// ",,,,,".
//
// Row numbers are logical CSV rows, not raw physical file lines: the
// header is row 1, the first kept data row is row 2, and so on — a
// multi-line quoted field still counts as one row, and blank lines never
// consume a number.

export class CsvParseError extends Error {}

export function parseCsv(text) {
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }

  const records = []
  let cells = []
  let field = ''
  let inQuotes = false
  let atFieldStart = true

  function endField() {
    cells.push(field)
    field = ''
    atFieldStart = true
  }

  function endRecord() {
    endField()
    const isBlank = cells.every((cell) => cell === '')
    if (!isBlank) {
      records.push(cells)
    }
    cells = []
  }

  const len = text.length
  let i = 0
  while (i < len) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i += 1
        }
      } else {
        field += char
        i += 1
      }
      continue
    }

    if (char === '"' && atFieldStart) {
      inQuotes = true
      atFieldStart = false
      i += 1
      continue
    }

    if (char === ',') {
      endField()
      i += 1
      continue
    }

    if (char === '\r') {
      endRecord()
      i += text[i + 1] === '\n' ? 2 : 1
      continue
    }

    if (char === '\n') {
      endRecord()
      i += 1
      continue
    }

    field += char
    atFieldStart = false
    i += 1
  }

  if (inQuotes) {
    throw new CsvParseError('CSV is malformed: a quoted field is never closed (a stray " with no matching closing quote).')
  }

  // A file with no trailing newline leaves its last row unflushed.
  if (field !== '' || cells.length > 0) {
    endRecord()
  }

  if (records.length === 0) {
    throw new CsvParseError('CSV file is empty.')
  }

  const [headerCells, ...dataRecords] = records
  const rows = dataRecords.map((recordCells, index) => ({ rowNumber: index + 2, cells: recordCells }))

  return { headers: headerCells, rows }
}

// The inverse of parseCsv: turns one field's raw value into RFC-4180-safe
// CSV text. Quoted (with internal quotes doubled) whenever the value
// contains a comma, a quote, or a line break — a plain value is left
// unquoted. null/undefined become an empty field, matching how a blank
// CSV cell parses back to ''.
export function formatCsvField(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function formatCsvRow(cells) {
  return cells.map(formatCsvField).join(',')
}

// Builds a complete CSV document (headers + rows, CRLF line endings per
// RFC 4180, with a leading UTF-8 BOM for maximum spreadsheet-app
// compatibility — parseCsv above already strips a BOM on the way back in,
// so this round-trips cleanly). `rows` is an array of cell arrays, in the
// same column order as `headers`.
export function stringifyCsv(headers, rows) {
  const lines = [formatCsvRow(headers), ...rows.map(formatCsvRow)]
  return `﻿${lines.join('\r\n')}\r\n`
}
