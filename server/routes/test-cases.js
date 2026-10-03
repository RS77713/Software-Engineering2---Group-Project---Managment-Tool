import { Router } from 'express'
import { CsvParseError, parseCsv, stringifyCsv } from '../csv-parser.js'
import { db } from '../db.js'

// Allowed values from CLAUDE.md.
const SEVERITIES = ['Critical', 'Major', 'Minor', 'Trivial']
const STATUSES = ['draft', 'ready', 'passed', 'failed', 'skipped']
const PAGE_SIZE = 20

// Project rule (CLAUDE.md): every test case title must end with its feature
// area in square brackets, e.g. "Login with valid credentials [Authentication]".
const TITLE_FEATURE_AREA_PATTERN = /\[[^[\]]+\]$/

// CSV import column mapping. `normalized` is how a header name is matched:
// lowercased with whitespace/hyphens/underscores collapsed away, so
// "Expected Result", "expected_result", and "expectedResult" all map to
// the same column. title/severity/steps/expectedResult are hard
// requirements — a file missing any of them is rejected outright, before
// a single row is read (see handleImportTestCases below).
const IMPORT_FIELD_DEFS = [
  { key: 'title', normalized: 'title', label: 'title', required: true },
  { key: 'severity', normalized: 'severity', label: 'severity', required: true },
  { key: 'steps', normalized: 'steps', label: 'steps', required: true },
  { key: 'expectedResult', normalized: 'expectedresult', label: 'expected_result', required: true },
  { key: 'preconditions', normalized: 'preconditions', label: 'preconditions', required: false },
  { key: 'status', normalized: 'status', label: 'status', required: false },
]

function normalizeHeaderName(name) {
  return String(name).trim().toLowerCase().replace(/[\s_-]+/g, '')
}

// Splits a CSV steps cell into one entry per line (CRLF/LF/CR-safe).
// Trimming and dropping blank entries is left to validateTestCasePayload,
// same as it already does for the manual form's steps array.
function splitStepsCell(cell) {
  return typeof cell === 'string' ? cell.split(/\r\n|\r|\n/) : []
}

const router = Router()

function ok(res, data, status = 200) {
  res.status(status).json({ success: true, data, error: null })
}

function fail(res, status, error) {
  res.status(status).json({ success: false, data: null, error })
}

export function rowToTestCase(row) {
  return {
    id: row.id,
    title: row.title,
    preconditions: row.preconditions,
    steps: JSON.parse(row.steps),
    expectedResult: row.expected_result,
    severity: row.severity,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// All fields are required except preconditions; status defaults to 'draft'.
function validateTestCasePayload(body = {}) {
  const errors = []

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    errors.push('title is required')
  } else if (!TITLE_FEATURE_AREA_PATTERN.test(title)) {
    errors.push('title must end with the feature area in square brackets, e.g. "Login with valid credentials [Authentication]"')
  }

  const preconditions = typeof body.preconditions === 'string' ? body.preconditions.trim() : ''

  const steps = Array.isArray(body.steps)
    ? body.steps.map((step) => (typeof step === 'string' ? step.trim() : '')).filter(Boolean)
    : []
  if (steps.length === 0) errors.push('at least one step is required')

  const expectedResult = typeof body.expectedResult === 'string' ? body.expectedResult.trim() : ''
  if (!expectedResult) errors.push('expectedResult is required')

  const severity = body.severity
  if (!SEVERITIES.includes(severity)) {
    errors.push(`severity must be one of: ${SEVERITIES.join(', ')}`)
  }

  const status = body.status || 'draft'
  if (!STATUSES.includes(status)) {
    errors.push(`status must be one of: ${STATUSES.join(', ')}`)
  }

  return {
    errors,
    value: {
      title,
      preconditions: preconditions || null,
      steps,
      expectedResult,
      severity,
      status,
    },
  }
}

// Shared by handleListTestCases (paginated) and handleExportTestCases (the
// complete matching set) so the two can never drift apart — the export
// always matches exactly what the list's current search/status filter and
// sort would show, just without the LIMIT/OFFSET.
function buildTestCaseFilter(query) {
  // Default sort is 'id' (creation order, oldest first) — anything other
  // than the two explicit, user-choosable columns falls back to it.
  const sort = query.sort === 'severity' || query.sort === 'updatedAt' ? query.sort : 'id'

  // 'id's natural default is ascending ("newer cases last"). The other two
  // columns keep their previous behavior exactly: the client's column-click
  // handler always sends an explicit order once a user picks one of them,
  // so their own fallback (desc) is unchanged from before this default
  // switched from 'updatedAt' to 'id'.
  const order = query.order === 'asc' ? 'ASC' : query.order === 'desc' ? 'DESC' : sort === 'id' ? 'ASC' : 'DESC'

  const where = []
  const params = {}

  if (query.status && STATUSES.includes(query.status)) {
    where.push('status = @status')
    params.status = query.status
  }
  if (query.search) {
    where.push('title LIKE @search')
    params.search = `%${query.search}%`
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const orderSql =
    sort === 'severity'
      ? `ORDER BY CASE severity
           WHEN 'Critical' THEN 0
           WHEN 'Major' THEN 1
           WHEN 'Minor' THEN 2
           WHEN 'Trivial' THEN 3
         END ${order}`
      : sort === 'id'
        ? `ORDER BY id ${order}`
        : `ORDER BY updated_at ${order}`

  return { whereSql, orderSql, params }
}

function handleListTestCases(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
  const { whereSql, orderSql, params } = buildTestCaseFilter(req.query)

  const { count: total } = db.prepare(`SELECT COUNT(*) AS count FROM test_cases ${whereSql}`).get(params)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const offset = (page - 1) * PAGE_SIZE

  const rows = db
    .prepare(`SELECT * FROM test_cases ${whereSql} ${orderSql} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: PAGE_SIZE, offset })

  ok(res, {
    items: rows.map(rowToTestCase),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages,
  })
}

// CSV columns, in export order. id/created_at/updated_at aren't part of
// the CSV import's recognized field set (see IMPORT_FIELD_DEFS above) —
// they're carried along for reference and are simply ignored as
// unrecognized extra columns if this file is re-imported, exactly the way
// title/severity/steps/expected_result/preconditions/status already round
// -trip through import.
const EXPORT_COLUMNS = ['id', 'title', 'severity', 'status', 'preconditions', 'steps', 'expected_result', 'created_at', 'updated_at']

// The full set of test cases matching the current search/status filter,
// in the current sort order — never paginated, unlike handleListTestCases
// — as one downloadable CSV. Steps are joined back into a single cell,
// one step per line (the exact inverse of splitStepsCell used on import).
// An empty result still returns a valid CSV containing just the header row.
function handleExportTestCases(req, res) {
  const { whereSql, orderSql, params } = buildTestCaseFilter(req.query)
  const rows = db.prepare(`SELECT * FROM test_cases ${whereSql} ${orderSql}`).all(params)

  const csvRows = rows.map((row) => [
    row.id,
    row.title,
    row.severity,
    row.status,
    row.preconditions,
    JSON.parse(row.steps).join('\n'),
    row.expected_result,
    row.created_at,
    row.updated_at,
  ])
  const csv = stringifyCsv(EXPORT_COLUMNS, csvRows)

  const filename = `test-cases-${new Date().toISOString().slice(0, 10)}.csv`
  res.status(200)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(csv)
}

function handleGetTestCase(req, res) {
  const row = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id)
  if (!row) return fail(res, 404, 'test case not found')
  ok(res, rowToTestCase(row))
}

function handleCreateTestCase(req, res) {
  const { errors, value } = validateTestCasePayload(req.body)
  if (errors.length) return fail(res, 400, errors.join('; '))

  const now = new Date().toISOString()
  const info = db
    .prepare(
      `INSERT INTO test_cases
         (title, preconditions, steps, expected_result, severity, status, created_at, updated_at)
       VALUES
         (@title, @preconditions, @steps, @expectedResult, @severity, @status, @now, @now)`
    )
    .run({ ...value, steps: JSON.stringify(value.steps), now })

  const row = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(info.lastInsertRowid)
  ok(res, rowToTestCase(row), 201)
}

// Bulk-creates test cases from a CSV file's text content. `commit: false`
// (or omitted) is a dry run — parses, validates every row through the
// exact same validateTestCasePayload used by the manual form, checks
// duplicates against the *current* database, and writes nothing.
// `commit: true` repeats that entire pass from scratch against current
// data (it never trusts an earlier preview — someone else could have
// created a conflicting title in the meantime) and, in one transaction,
// inserts every row that came out both valid and non-duplicate.
//
// A duplicate title (matching an existing test case, or an earlier row in
// the same file) is never overwritten — it's simply skipped, same as an
// invalid row, just reported under a different reason.
function handleImportTestCases(req, res) {
  const csv = typeof req.body.csv === 'string' ? req.body.csv : null
  if (!csv) return fail(res, 400, 'csv is required')
  const commit = req.body.commit === true

  let parsed
  try {
    parsed = parseCsv(csv)
  } catch (err) {
    if (err instanceof CsvParseError) return fail(res, 400, err.message)
    throw err
  }

  const { headers, rows: dataRows } = parsed

  // Map each recognized header to its column index, and reject the whole
  // file (before looking at a single row) for a duplicate or missing
  // required column.
  const columnIndexByField = {}
  const duplicateHeaderLabels = []
  headers.forEach((header, index) => {
    const normalized = normalizeHeaderName(header)
    const fieldDef = IMPORT_FIELD_DEFS.find((def) => def.normalized === normalized)
    if (!fieldDef) return // unrecognized extra column — ignored, not an error
    if (fieldDef.key in columnIndexByField) {
      duplicateHeaderLabels.push(fieldDef.label)
      return
    }
    columnIndexByField[fieldDef.key] = index
  })
  if (duplicateHeaderLabels.length > 0) {
    return fail(res, 400, `CSV has duplicate column(s): ${duplicateHeaderLabels.join(', ')}`)
  }

  const missingRequired = IMPORT_FIELD_DEFS.filter((def) => def.required && !(def.key in columnIndexByField))
  if (missingRequired.length > 0) {
    return fail(res, 400, `CSV is missing required column(s): ${missingRequired.map((def) => def.label).join(', ')}`)
  }

  function cellFor(cells, key) {
    const index = columnIndexByField[key]
    return index === undefined ? undefined : cells[index]
  }

  // Every title currently in the database, for duplicate detection —
  // fetched once per request rather than once per row.
  const existingIdByTitle = new Map(db.prepare('SELECT id, title FROM test_cases').all().map((r) => [r.title, r.id]))
  // Titles seen so far within this file, mapped to the row they first
  // appeared on — a later row always cites the *first* occurrence, not
  // whichever earlier duplicate it happens to compare against.
  const firstRowByTitleInFile = new Map()

  const rows = dataRows.map((dataRow) => {
    const { rowNumber, cells } = dataRow

    if (cells.length !== headers.length) {
      const rawTitle = (cellFor(cells, 'title') ?? '').toString().trim()
      return {
        rowNumber,
        title: rawTitle,
        valid: false,
        errors: [`expected ${headers.length} columns, found ${cells.length}`],
        duplicate: null,
        imported: false,
      }
    }

    const payload = {
      title: cellFor(cells, 'title'),
      // Trimmed here (a CSV-cell-cleanup concern), not in
      // validateTestCasePayload itself, which is left unchanged and
      // doesn't trim severity/status.
      severity: cellFor(cells, 'severity')?.trim(),
      steps: splitStepsCell(cellFor(cells, 'steps')),
      expectedResult: cellFor(cells, 'expectedResult'),
      preconditions: cellFor(cells, 'preconditions'),
      status: cellFor(cells, 'status')?.trim() || undefined,
    }

    const { errors, value } = validateTestCasePayload(payload)
    const valid = errors.length === 0

    let duplicate = null
    if (valid) {
      if (existingIdByTitle.has(value.title)) {
        duplicate = { reason: 'existing-test-case', existingId: existingIdByTitle.get(value.title) }
      } else if (firstRowByTitleInFile.has(value.title)) {
        duplicate = { reason: 'duplicate-in-file', firstRowNumber: firstRowByTitleInFile.get(value.title) }
      } else {
        firstRowByTitleInFile.set(value.title, rowNumber)
      }
    }

    return {
      rowNumber,
      title: valid ? value.title : (cellFor(cells, 'title') ?? '').toString().trim(),
      valid,
      errors,
      duplicate,
      imported: false,
      _value: valid && !duplicate ? value : null, // internal only, stripped before responding
    }
  })

  if (commit) {
    const now = new Date().toISOString()
    const insert = db.prepare(
      `INSERT INTO test_cases
         (title, preconditions, steps, expected_result, severity, status, created_at, updated_at)
       VALUES
         (@title, @preconditions, @steps, @expectedResult, @severity, @status, @now, @now)`
    )
    const insertAll = db.transaction((importableRows) => {
      for (const row of importableRows) {
        insert.run({ ...row._value, steps: JSON.stringify(row._value.steps), now })
        row.imported = true
      }
    })
    insertAll(rows.filter((row) => row._value))
  }

  const summary = {
    imported: rows.filter((row) => row.imported).length,
    invalid: rows.filter((row) => !row.valid).length,
    duplicate: rows.filter((row) => row.valid && row.duplicate).length,
  }

  ok(res, {
    totalRows: rows.length,
    committed: commit,
    rows: rows.map(({ _value, ...row }) => row),
    summary,
  })
}

function handleUpdateTestCase(req, res) {
  const existing = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id)
  if (!existing) return fail(res, 404, 'test case not found')

  const { errors, value } = validateTestCasePayload(req.body)
  if (errors.length) return fail(res, 400, errors.join('; '))

  const now = new Date().toISOString()
  db.prepare(
    `UPDATE test_cases
     SET title = @title,
         preconditions = @preconditions,
         steps = @steps,
         expected_result = @expectedResult,
         severity = @severity,
         status = @status,
         updated_at = @now
     WHERE id = @id`
  ).run({ ...value, steps: JSON.stringify(value.steps), now, id: req.params.id })

  const row = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id)
  ok(res, rowToTestCase(row))
}

function handleDeleteTestCase(req, res) {
  const existing = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id)
  if (!existing) return fail(res, 404, 'test case not found')

  // suite_test_cases rows referencing it are removed automatically via
  // ON DELETE CASCADE (see server/db.js), so deleting a test case also
  // silently drops it from any suite it belongs to. test_run_results rows
  // are NOT cascaded, though — a case that's part of any test run's history
  // is intentionally kept from being deleted at all, so that run's record
  // stays meaningful. SQLite enforces that as a foreign key constraint;
  // catch it here and turn it into a clear error instead of a generic 500.
  try {
    db.prepare('DELETE FROM test_cases WHERE id = ?').run(req.params.id)
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return fail(res, 400, 'cannot delete: this test case is part of one or more test run results')
    }
    throw err
  }
  ok(res, { id: Number(req.params.id) })
}

// Lets a caller check suite membership *before* deleting, so a delete
// confirmation can warn the user their case will also disappear from
// those suites.
function handleListSuitesForTestCase(req, res) {
  const existing = db.prepare('SELECT id FROM test_cases WHERE id = ?').get(req.params.id)
  if (!existing) return fail(res, 404, 'test case not found')

  const suites = db
    .prepare(
      `SELECT s.id, s.name
       FROM suite_test_cases stc
       JOIN suites s ON s.id = stc.suite_id
       WHERE stc.test_case_id = ?
       ORDER BY s.name ASC`
    )
    .all(req.params.id)

  ok(res, { suites })
}

router.get('/', handleListTestCases)
router.get('/export', handleExportTestCases)
router.get('/:id', handleGetTestCase)
router.get('/:id/suites', handleListSuitesForTestCase)
router.post('/', handleCreateTestCase)
router.post('/import', handleImportTestCases)
router.put('/:id', handleUpdateTestCase)
router.delete('/:id', handleDeleteTestCase)

export default router
