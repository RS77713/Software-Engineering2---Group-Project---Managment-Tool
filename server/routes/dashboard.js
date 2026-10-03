import { Router } from 'express'
import { db } from '../db.js'

const router = Router()
const TEST_CASE_STATUSES = ['draft', 'ready', 'passed', 'failed', 'skipped']

function ok(res, data) {
  res.json({ success: true, data, error: null })
}

function getCount(table) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count
}

function getPassRate() {
  const totals = db
    .prepare(
      `SELECT
         SUM(CASE WHEN result = 'passed' THEN 1 ELSE 0 END) AS passed,
         SUM(CASE WHEN result = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM test_run_results`
    )
    .get()
  const passed = totals.passed || 0
  const failed = totals.failed || 0
  const executed = passed + failed
  return executed > 0 ? Math.round((passed / executed) * 1000) / 10 : null
}

function getAverageRunDurationSeconds() {
  const { avgSeconds } = db
    .prepare(
      `SELECT AVG((julianday(end_time) - julianday(start_time)) * 86400) AS avgSeconds
       FROM test_runs_v2
       WHERE end_time IS NOT NULL`
    )
    .get()
  return avgSeconds === null ? null : Math.round(avgSeconds * 10) / 10
}

function getRecentRuns() {
  return db
    .prepare(
      `SELECT tr.id, tr.status, tr.pass_count, tr.fail_count, tr.skip_count,
              tr.start_time, tr.end_time, s.name AS suite_name
       FROM test_runs_v2 tr
       JOIN suites s ON s.id = tr.suite_id
       ORDER BY tr.start_time DESC
       LIMIT 10`
    )
    .all()
    .map((row) => ({
      id: row.id,
      suiteName: row.suite_name,
      status: row.status,
      passCount: row.pass_count,
      failCount: row.fail_count,
      skipCount: row.skip_count,
      startTime: row.start_time,
      endTime: row.end_time,
    }))
}

function getPassRateTrend() {
  const rows = db
    .prepare(
      `SELECT tr.id, tr.start_time, s.name AS suite_name,
              COALESCE(SUM(CASE WHEN rr.result = 'passed' THEN 1 ELSE 0 END), 0) AS passed,
              COALESCE(SUM(CASE WHEN rr.result = 'failed' THEN 1 ELSE 0 END), 0) AS failed
       FROM test_runs_v2 tr
       JOIN suites s ON s.id = tr.suite_id
       LEFT JOIN test_run_results rr ON rr.run_id = tr.id
       GROUP BY tr.id
       ORDER BY tr.start_time DESC
       LIMIT 10`
    )
    .all()

  return rows.reverse().map((row) => {
    const executed = row.passed + row.failed
    return {
      runId: row.id,
      suiteName: row.suite_name,
      startTime: row.start_time,
      passRate: executed > 0 ? Math.round((row.passed / executed) * 1000) / 10 : null,
    }
  })
}

function getTestCasesByStatus() {
  const rows = db.prepare('SELECT status, COUNT(*) AS count FROM test_cases GROUP BY status').all()
  const counts = Object.fromEntries(rows.map((row) => [row.status, row.count]))
  return TEST_CASE_STATUSES.map((status) => ({ status, count: counts[status] || 0 }))
}

router.get('/metrics', (req, res) => {
  ok(res, {
    totalTestCases: getCount('test_cases'),
    totalSuites: getCount('suites'),
    totalRuns: getCount('test_runs_v2'),
    passRate: getPassRate(),
    averageRunDurationSeconds: getAverageRunDurationSeconds(),
    recentRuns: getRecentRuns(),
  })
})

router.get('/trends', (req, res) => {
  ok(res, {
    passRateTrend: getPassRateTrend(),
    testCasesByStatus: getTestCasesByStatus(),
  })
})

export default router
