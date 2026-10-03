import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'

const dbPath = path.join(os.tmpdir(), `qa-dashboard-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`)
process.env.TEST_DB_PATH = dbPath

const { default: app } = await import('../app.js')
const { db } = await import('../db.js')

let server
let baseUrl

before(async () => {
  db.exec('DELETE FROM test_run_results; DELETE FROM test_runs_v2; DELETE FROM suite_test_cases; DELETE FROM suites; DELETE FROM test_cases;')
  server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.close()
  for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(dbPath + suffix, { force: true })
})

async function api(requestPath, options = {}) {
  const response = await fetch(`${baseUrl}${requestPath}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  return { status: response.status, body: await response.json() }
}

async function createCoreData() {
  const testCase = await api('/api/test-cases', {
    method: 'POST',
    body: JSON.stringify({
      title: 'User can sign in [Authentication]',
      steps: ['Open sign-in', 'Submit valid credentials'],
      expectedResult: 'Dashboard opens',
      severity: 'Critical',
      status: 'ready',
    }),
  })
  const suite = await api('/api/suites', {
    method: 'POST',
    body: JSON.stringify({ name: 'Authentication', feature: 'Sign in', status: 'ready' }),
  })
  await api(`/api/suites/${suite.body.data.id}/cases`, {
    method: 'POST',
    body: JSON.stringify({ testCaseId: testCase.body.data.id }),
  })
  const run = await api('/api/test-runs', {
    method: 'POST',
    body: JSON.stringify({ suiteId: suite.body.data.id, createdBy: 'EM' }),
  })
  await api(`/api/test-runs/${run.body.data.id}/results/${run.body.data.results[0].id}`, {
    method: 'PUT',
    body: JSON.stringify({ result: 'passed' }),
  })
  return run.body.data.id
}

test('dashboard metrics summarize the core workflow', async () => {
  const runId = await createCoreData()
  const response = await api('/api/dashboard/metrics')

  assert.equal(response.status, 200)
  assert.equal(response.body.data.totalTestCases, 1)
  assert.equal(response.body.data.totalSuites, 1)
  assert.equal(response.body.data.totalRuns, 1)
  assert.equal(response.body.data.passRate, 100)
  assert.equal(response.body.data.recentRuns[0].id, runId)
  assert.equal(response.body.data.recentRuns[0].suiteName, 'Authentication')
})

test('dashboard trends contain pass-rate and every test-case status bucket', async () => {
  const response = await api('/api/dashboard/trends')

  assert.equal(response.status, 200)
  assert.equal(response.body.data.passRateTrend.length, 1)
  assert.equal(response.body.data.passRateTrend[0].passRate, 100)
  assert.deepEqual(
    response.body.data.testCasesByStatus.map(({ status }) => status),
    ['draft', 'ready', 'passed', 'failed', 'skipped']
  )
  assert.equal(response.body.data.testCasesByStatus.find(({ status }) => status === 'ready').count, 1)
})
