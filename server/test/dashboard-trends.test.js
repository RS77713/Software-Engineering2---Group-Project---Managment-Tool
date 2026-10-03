import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'

const dbPath = path.join(os.tmpdir(), `qa-dashboard-empty-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`)
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

test('an empty database returns stable zero-data dashboard contracts', async () => {
  const metricsResponse = await fetch(`${baseUrl}/api/dashboard/metrics`)
  const trendsResponse = await fetch(`${baseUrl}/api/dashboard/trends`)
  const metrics = (await metricsResponse.json()).data
  const trends = (await trendsResponse.json()).data

  assert.equal(metrics.totalTestCases, 0)
  assert.equal(metrics.totalSuites, 0)
  assert.equal(metrics.totalRuns, 0)
  assert.equal(metrics.passRate, null)
  assert.equal(metrics.averageRunDurationSeconds, null)
  assert.deepEqual(metrics.recentRuns, [])
  assert.deepEqual(trends.passRateTrend, [])
  assert.equal(trends.testCasesByStatus.length, 5)
  assert.ok(trends.testCasesByStatus.every(({ count }) => count === 0))
})
