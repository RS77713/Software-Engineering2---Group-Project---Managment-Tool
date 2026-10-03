import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'

const dbPath = path.join(os.tmpdir(), `qa-runs-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`)
process.env.TEST_DB_PATH = dbPath

const { default: app } = await import('../app.js')
const { db } = await import('../db.js')

let server
let baseUrl
let suiteId
let runId
let resultIds

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

async function createCase(title) {
  return api('/api/test-cases', {
    method: 'POST',
    body: JSON.stringify({
      title,
      steps: ['Perform the action'],
      expectedResult: 'Expected result appears',
      severity: 'Major',
      status: 'ready',
    }),
  })
}

test('creating a run snapshots the suite cases', async () => {
  const first = await createCase('First case [Core]')
  const second = await createCase('Second case [Core]')
  const suite = await api('/api/suites', {
    method: 'POST',
    body: JSON.stringify({ name: 'Smoke Suite', feature: 'Core', status: 'ready' }),
  })
  suiteId = suite.body.data.id

  for (const testCaseId of [first.body.data.id, second.body.data.id]) {
    const linked = await api(`/api/suites/${suiteId}/cases`, {
      method: 'POST',
      body: JSON.stringify({ testCaseId }),
    })
    assert.equal(linked.status, 201)
  }

  const created = await api('/api/test-runs', {
    method: 'POST',
    body: JSON.stringify({ suiteId, createdBy: 'MK' }),
  })
  assert.equal(created.status, 201)
  assert.equal(created.body.data.status, 'in-progress')
  assert.equal(created.body.data.results.length, 2)
  assert.ok(created.body.data.results.every(({ result }) => result === 'pending'))
  runId = created.body.data.id
  resultIds = created.body.data.results.map(({ id }) => id)

  const third = await createCase('Added later [Core]')
  await api(`/api/suites/${suiteId}/cases`, {
    method: 'POST',
    body: JSON.stringify({ testCaseId: third.body.data.id }),
  })
  const unchanged = await api(`/api/test-runs/${runId}`)
  assert.equal(unchanged.body.data.results.length, 2)
})

test('result updates maintain totals and automatically complete the run', async () => {
  const firstUpdate = await api(`/api/test-runs/${runId}/results/${resultIds[0]}`, {
    method: 'PUT',
    body: JSON.stringify({ result: 'passed', durationMs: 120, notes: 'works' }),
  })
  assert.equal(firstUpdate.body.data.status, 'in-progress')
  assert.equal(firstUpdate.body.data.passCount, 1)

  const finalUpdate = await api(`/api/test-runs/${runId}/results/${resultIds[1]}`, {
    method: 'PUT',
    body: JSON.stringify({ result: 'failed', notes: 'needs attention' }),
  })
  assert.equal(finalUpdate.status, 200)
  assert.equal(finalUpdate.body.data.status, 'failed')
  assert.equal(finalUpdate.body.data.passCount, 1)
  assert.equal(finalUpdate.body.data.failCount, 1)
  assert.ok(finalUpdate.body.data.endTime)
})

test('invalid execution input returns a useful failure response', async () => {
  const response = await api(`/api/test-runs/${runId}/results/${resultIds[0]}`, {
    method: 'PUT',
    body: JSON.stringify({ result: 'unknown' }),
  })
  assert.equal(response.status, 400)
  assert.match(response.body.error, /result must be one of/)
})
