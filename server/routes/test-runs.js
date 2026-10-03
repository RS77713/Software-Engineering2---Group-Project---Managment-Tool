import { Router } from 'express'
import { db } from '../db.js'

const RESULTS = ['passed', 'failed', 'skipped']
const router = Router()

function ok(res, data, status = 200) {
  res.status(status).json({ success: true, data, error: null })
}

function fail(res, status, error) {
  res.status(status).json({ success: false, data: null, error })
}

function rowToRunSummary(row) {
  return {
    id: row.id,
    suiteId: row.suite_id,
    suiteName: row.suite_name,
    status: row.status,
    passCount: row.pass_count,
    failCount: row.fail_count,
    skipCount: row.skip_count,
    startTime: row.start_time,
    endTime: row.end_time,
    createdBy: row.created_by,
  }
}

function rowToResult(row) {
  return {
    id: row.id,
    runId: row.run_id,
    testCaseId: row.test_case_id,
    testCaseTitle: row.title,
    severity: row.severity,
    result: row.result,
    durationMs: row.duration_ms,
    notes: row.notes,
  }
}

function getRunDetail(id) {
  const run = db
    .prepare(
      `SELECT tr.*, s.name AS suite_name
       FROM test_runs_v2 tr
       JOIN suites s ON s.id = tr.suite_id
       WHERE tr.id = ?`
    )
    .get(id)
  if (!run) return null

  const results = db
    .prepare(
      `SELECT rr.*, tc.title, tc.severity
       FROM test_run_results rr
       JOIN test_cases tc ON tc.id = rr.test_case_id
       WHERE rr.run_id = ?
       ORDER BY rr.id ASC`
    )
    .all(id)

  return { ...rowToRunSummary(run), results: results.map(rowToResult) }
}

function syncRunTotals(runId) {
  const counts = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN result = 'passed' THEN 1 ELSE 0 END), 0) AS pass_count,
         COALESCE(SUM(CASE WHEN result = 'failed' THEN 1 ELSE 0 END), 0) AS fail_count,
         COALESCE(SUM(CASE WHEN result = 'skipped' THEN 1 ELSE 0 END), 0) AS skip_count,
         COALESCE(SUM(CASE WHEN result = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count
       FROM test_run_results
       WHERE run_id = ?`
    )
    .get(runId)

  const hasPending = counts.pending_count > 0
  const status = hasPending ? 'in-progress' : counts.fail_count > 0 ? 'failed' : 'passed'
  const run = db.prepare('SELECT end_time FROM test_runs_v2 WHERE id = ?').get(runId)
  const endTime = run.end_time ?? (hasPending ? null : new Date().toISOString())

  db.prepare(
    `UPDATE test_runs_v2
     SET pass_count = @passCount, fail_count = @failCount, skip_count = @skipCount,
         status = @status, end_time = @endTime
     WHERE id = @id`
  ).run({
    passCount: counts.pass_count,
    failCount: counts.fail_count,
    skipCount: counts.skip_count,
    status,
    endTime,
    id: runId,
  })
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT tr.*, s.name AS suite_name
       FROM test_runs_v2 tr
       JOIN suites s ON s.id = tr.suite_id
       ORDER BY tr.start_time DESC`
    )
    .all()
  ok(res, { items: rows.map(rowToRunSummary) })
})

router.get('/:id', (req, res) => {
  const detail = getRunDetail(req.params.id)
  if (!detail) return fail(res, 404, 'test run not found')
  ok(res, detail)
})

router.post('/', (req, res) => {
  const suiteId = Number(req.body.suiteId)
  if (!Number.isInteger(suiteId)) return fail(res, 400, 'suiteId is required')
  if (!db.prepare('SELECT id FROM suites WHERE id = ?').get(suiteId)) {
    return fail(res, 404, 'suite not found')
  }

  const createdBy = typeof req.body.createdBy === 'string' ? req.body.createdBy.trim() : ''
  if (!createdBy) return fail(res, 400, 'createdBy is required')

  const caseIds = db
    .prepare('SELECT test_case_id FROM suite_test_cases WHERE suite_id = ? ORDER BY sort_order ASC')
    .all(suiteId)
    .map((row) => row.test_case_id)

  const createRun = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO test_runs_v2
           (suite_id, status, pass_count, fail_count, skip_count, start_time, end_time, created_by)
         VALUES (@suiteId, 'in-progress', 0, 0, 0, @now, NULL, @createdBy)`
      )
      .run({ suiteId, now: new Date().toISOString(), createdBy })

    const insertResult = db.prepare(
      `INSERT INTO test_run_results (run_id, test_case_id, result)
       VALUES (@runId, @testCaseId, 'pending')`
    )
    for (const testCaseId of caseIds) {
      insertResult.run({ runId: info.lastInsertRowid, testCaseId })
    }

    syncRunTotals(info.lastInsertRowid)
    return info.lastInsertRowid
  })

  ok(res, getRunDetail(createRun()), 201)
})

router.put('/:id/results/:resultId', (req, res) => {
  if (!db.prepare('SELECT id FROM test_runs_v2 WHERE id = ?').get(req.params.id)) {
    return fail(res, 404, 'test run not found')
  }

  const existing = db
    .prepare('SELECT id FROM test_run_results WHERE id = ? AND run_id = ?')
    .get(req.params.resultId, req.params.id)
  if (!existing) return fail(res, 404, 'result not found on this run')

  const result = req.body.result
  if (!RESULTS.includes(result)) {
    return fail(res, 400, `result must be one of: ${RESULTS.join(', ')}`)
  }

  const durationMs = req.body.durationMs == null ? null : Number(req.body.durationMs)
  if (durationMs !== null && (!Number.isFinite(durationMs) || durationMs < 0)) {
    return fail(res, 400, 'durationMs must be a non-negative number')
  }

  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() || null : null
  db.prepare(
    `UPDATE test_run_results
     SET result = @result, duration_ms = @durationMs, notes = @notes
     WHERE id = @id`
  ).run({ result, durationMs, notes, id: req.params.resultId })

  syncRunTotals(req.params.id)
  ok(res, getRunDetail(req.params.id))
})

export default router
