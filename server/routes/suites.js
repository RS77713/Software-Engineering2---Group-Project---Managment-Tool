import { Router } from 'express'
import { db } from '../db.js'
import { rowToTestCase } from './test-cases.js'

const SUITE_STATUSES = ['draft', 'ready', 'in-progress', 'passed', 'failed']

const router = Router()

function ok(res, data, status = 200) {
  res.status(status).json({ success: true, data, error: null })
}

function fail(res, status, error) {
  res.status(status).json({ success: false, data: null, error })
}

function rowToSuiteSummary(row) {
  return {
    id: row.id,
    name: row.name,
    feature: row.feature,
    status: row.status,
    caseCount: row.case_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Name and feature are required. When status is omitted from the request
// body, it falls back to `fallbackStatus` — 'draft' on create (no prior
// status exists yet), but the suite's own current status on update, so a
// partial update can never silently reset it back to 'draft'.
function validateSuitePayload(body = {}, { fallbackStatus = 'draft' } = {}) {
  const errors = []

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) errors.push('name is required')

  const feature = typeof body.feature === 'string' ? body.feature.trim() : ''
  if (!feature) errors.push('feature is required')

  const status = body.status || fallbackStatus
  if (!SUITE_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${SUITE_STATUSES.join(', ')}`)
  }

  return { errors, value: { name, feature, status } }
}

// A suite's full detail: its own fields plus its test cases, in order.
function getSuiteDetail(id) {
  const suite = db.prepare('SELECT * FROM suites WHERE id = ?').get(id)
  if (!suite) return null

  const caseRows = db
    .prepare(
      `SELECT tc.*
       FROM suite_test_cases stc
       JOIN test_cases tc ON tc.id = stc.test_case_id
       WHERE stc.suite_id = ?
       ORDER BY stc.sort_order ASC`
    )
    .all(id)

  return {
    id: suite.id,
    name: suite.name,
    feature: suite.feature,
    status: suite.status,
    createdAt: suite.created_at,
    updatedAt: suite.updated_at,
    cases: caseRows.map(rowToTestCase),
  }
}

function handleListSuites(req, res) {
  const where = []
  const params = {}

  if (req.query.status && SUITE_STATUSES.includes(req.query.status)) {
    where.push('s.status = @status')
    params.status = req.query.status
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const rows = db
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM suite_test_cases stc WHERE stc.suite_id = s.id) AS case_count
       FROM suites s
       ${whereSql}
       ORDER BY s.updated_at DESC`
    )
    .all(params)

  ok(res, { items: rows.map(rowToSuiteSummary) })
}

function handleGetSuite(req, res) {
  const detail = getSuiteDetail(req.params.id)
  if (!detail) return fail(res, 404, 'suite not found')
  ok(res, detail)
}

function handleCreateSuite(req, res) {
  const { errors, value } = validateSuitePayload(req.body)
  if (errors.length) return fail(res, 400, errors.join('; '))

  const now = new Date().toISOString()
  const info = db
    .prepare(
      `INSERT INTO suites (name, feature, status, created_at, updated_at)
       VALUES (@name, @feature, @status, @now, @now)`
    )
    .run({ ...value, now })

  ok(res, getSuiteDetail(info.lastInsertRowid), 201)
}

function handleUpdateSuite(req, res) {
  const existing = db.prepare('SELECT * FROM suites WHERE id = ?').get(req.params.id)
  if (!existing) return fail(res, 404, 'suite not found')

  const { errors, value } = validateSuitePayload(req.body, { fallbackStatus: existing.status })
  if (errors.length) return fail(res, 400, errors.join('; '))

  const now = new Date().toISOString()
  db.prepare(
    `UPDATE suites
     SET name = @name, feature = @feature, status = @status, updated_at = @now
     WHERE id = @id`
  ).run({ ...value, now, id: req.params.id })

  ok(res, getSuiteDetail(req.params.id))
}

function handleDeleteSuite(req, res) {
  const existing = db.prepare('SELECT * FROM suites WHERE id = ?').get(req.params.id)
  if (!existing) return fail(res, 404, 'suite not found')

  // suite_test_cases rows are removed automatically via ON DELETE CASCADE.
  db.prepare('DELETE FROM suites WHERE id = ?').run(req.params.id)
  ok(res, { id: Number(req.params.id) })
}

function handleReorderSuiteCases(req, res) {
  const suite = db.prepare('SELECT * FROM suites WHERE id = ?').get(req.params.id)
  if (!suite) return fail(res, 404, 'suite not found')

  const testCaseIds = Array.isArray(req.body.testCaseIds)
    ? req.body.testCaseIds.map(Number).filter((id) => Number.isInteger(id))
    : null
  if (!testCaseIds || testCaseIds.length !== req.body.testCaseIds.length) {
    return fail(res, 400, 'testCaseIds must be an array of test case ids')
  }

  const current = db
    .prepare('SELECT test_case_id FROM suite_test_cases WHERE suite_id = ?')
    .all(req.params.id)
    .map((row) => row.test_case_id)

  const sameSet =
    testCaseIds.length === current.length &&
    [...current].sort((a, b) => a - b).every((id, i) => id === [...testCaseIds].sort((a, b) => a - b)[i])

  if (!sameSet) {
    return fail(res, 400, "testCaseIds must contain exactly the suite's current cases")
  }

  const update = db.prepare(
    'UPDATE suite_test_cases SET sort_order = @sortOrder WHERE suite_id = @suiteId AND test_case_id = @testCaseId'
  )
  const reorder = db.transaction((ids) => {
    ids.forEach((testCaseId, index) => {
      update.run({ sortOrder: index, suiteId: req.params.id, testCaseId })
    })
  })
  reorder(testCaseIds)

  ok(res, getSuiteDetail(req.params.id))
}

function handleAddCaseToSuite(req, res) {
  const suite = db.prepare('SELECT * FROM suites WHERE id = ?').get(req.params.id)
  if (!suite) return fail(res, 404, 'suite not found')

  const testCaseId = Number(req.body.testCaseId)
  if (!Number.isInteger(testCaseId)) return fail(res, 400, 'testCaseId is required')

  const testCase = db.prepare('SELECT id FROM test_cases WHERE id = ?').get(testCaseId)
  if (!testCase) return fail(res, 404, 'test case not found')

  const alreadyLinked = db
    .prepare('SELECT 1 FROM suite_test_cases WHERE suite_id = ? AND test_case_id = ?')
    .get(req.params.id, testCaseId)
  if (alreadyLinked) return fail(res, 400, 'that test case is already in this suite')

  const { max } = db
    .prepare('SELECT MAX(sort_order) AS max FROM suite_test_cases WHERE suite_id = ?')
    .get(req.params.id)
  const nextOrder = max === null ? 0 : max + 1

  db.prepare(
    `INSERT INTO suite_test_cases (suite_id, test_case_id, sort_order)
     VALUES (@suiteId, @testCaseId, @sortOrder)`
  ).run({ suiteId: req.params.id, testCaseId, sortOrder: nextOrder })

  ok(res, getSuiteDetail(req.params.id), 201)
}

function handleRemoveCaseFromSuite(req, res) {
  const suite = db.prepare('SELECT * FROM suites WHERE id = ?').get(req.params.id)
  if (!suite) return fail(res, 404, 'suite not found')

  const linked = db
    .prepare('SELECT 1 FROM suite_test_cases WHERE suite_id = ? AND test_case_id = ?')
    .get(req.params.id, req.params.testCaseId)
  if (!linked) return fail(res, 404, 'that test case is not in this suite')

  const removeAndRenumber = db.transaction(() => {
    db.prepare('DELETE FROM suite_test_cases WHERE suite_id = ? AND test_case_id = ?').run(
      req.params.id,
      req.params.testCaseId
    )
    const remaining = db
      .prepare('SELECT test_case_id FROM suite_test_cases WHERE suite_id = ? ORDER BY sort_order ASC')
      .all(req.params.id)
    const renumber = db.prepare(
      'UPDATE suite_test_cases SET sort_order = @sortOrder WHERE suite_id = @suiteId AND test_case_id = @testCaseId'
    )
    remaining.forEach((row, index) => {
      renumber.run({ sortOrder: index, suiteId: req.params.id, testCaseId: row.test_case_id })
    })
  })
  removeAndRenumber()

  ok(res, getSuiteDetail(req.params.id))
}

router.get('/', handleListSuites)
router.get('/:id', handleGetSuite)
router.post('/', handleCreateSuite)
router.put('/:id', handleUpdateSuite)
router.delete('/:id', handleDeleteSuite)
router.put('/:id/reorder', handleReorderSuiteCases)
router.post('/:id/cases', handleAddCaseToSuite)
router.delete('/:id/cases/:testCaseId', handleRemoveCaseFromSuite)

export default router
