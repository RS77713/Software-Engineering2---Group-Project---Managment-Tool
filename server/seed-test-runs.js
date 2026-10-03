import { db } from './db.js'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const RUN_SEED = {
  suiteName: 'Account Flows Suite',
  createdBy: 'QA Team',
  daysAgo: 2,
  results: [
    { caseTitle: 'Login with valid credentials [Authentication]', result: 'passed', durationMs: 850 },
    {
      caseTitle: 'Reset a forgotten password [Authentication]',
      result: 'failed',
      durationMs: 1200,
      notes: 'Reset email never arrived after 5 minutes.',
    },
    { caseTitle: 'Update profile picture [Profile]', result: 'skipped', notes: 'Blocked by the failure above.' },
  ],
}

export function seedTestRuns() {
  if (db.prepare('SELECT COUNT(*) AS count FROM test_runs_v2').get().count > 0) return

  const suite = db.prepare('SELECT id FROM suites WHERE name = ?').get(RUN_SEED.suiteName)
  if (!suite) return

  const findCaseId = db.prepare('SELECT id FROM test_cases WHERE title = ?')
  const caseRows = RUN_SEED.results
    .map((entry) => ({ ...entry, testCaseId: findCaseId.get(entry.caseTitle)?.id }))
    .filter((entry) => entry.testCaseId)
  if (caseRows.length === 0) return

  const seedRun = db.transaction(() => {
    const startTime = new Date(Date.now() - RUN_SEED.daysAgo * DAY_MS).toISOString()
    const endTime = new Date(Date.now() - RUN_SEED.daysAgo * DAY_MS + HOUR_MS).toISOString()
    const passCount = caseRows.filter((entry) => entry.result === 'passed').length
    const failCount = caseRows.filter((entry) => entry.result === 'failed').length
    const skipCount = caseRows.filter((entry) => entry.result === 'skipped').length

    const info = db
      .prepare(
        `INSERT INTO test_runs_v2
           (suite_id, status, pass_count, fail_count, skip_count, start_time, end_time, created_by)
         VALUES (@suiteId, @status, @passCount, @failCount, @skipCount, @startTime, @endTime, @createdBy)`
      )
      .run({
        suiteId: suite.id,
        status: failCount > 0 ? 'failed' : 'passed',
        passCount,
        failCount,
        skipCount,
        startTime,
        endTime,
        createdBy: RUN_SEED.createdBy,
      })

    const insertResult = db.prepare(
      `INSERT INTO test_run_results (run_id, test_case_id, result, duration_ms, notes)
       VALUES (@runId, @testCaseId, @result, @durationMs, @notes)`
    )
    for (const entry of caseRows) {
      insertResult.run({
        runId: info.lastInsertRowid,
        testCaseId: entry.testCaseId,
        result: entry.result,
        durationMs: entry.durationMs ?? null,
        notes: entry.notes ?? null,
      })
    }
  })

  seedRun()
  console.log('Seeded 1 test run.')
}
