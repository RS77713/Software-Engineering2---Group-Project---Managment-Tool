import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'

// Select owned synthetic data before importing the real application/database.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-h2-smoke-'))
const databasePath = path.join(directory, 'synthetic.sqlite')
process.env.TEST_DB_PATH = databasePath
let server
let db
let summary
const checks = []
const passed = (name, actual) => checks.push({ name, actual })

try {
  const initialized = await import('../server/db.js')
  db = initialized.db
  const { default: app } = await import('../server/app.js')
  server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert.equal(address.address, '127.0.0.1')
  const base = 'http://127.0.0.1:' + address.port
  const request = async (url, method = 'GET', body) => {
    const response = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    return { status: response.status, body: await response.json() }
  }
  const tables = ['test_cases', 'suites', 'suite_test_cases', 'test_runs_v2', 'test_run_results', 'bugs']
  const snapshot = () => Object.fromEntries(tables.map(table =>
    [table, db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()]))
  assert.equal(db.pragma('user_version', { simple: true }), 1)
  const health = await request('/api/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.data.status, 'ok')
  passed('startup and additive schema available', { http: 200, version: 1 })

  // Use inherited APIs and the documented fresh seed to make distinct identities.
  const testCase = await request('/api/test-cases', 'POST', {
    title: 'Synthetic source [H2 Smoke]', steps: ['Exercise synthetic action'],
    expectedResult: 'Expected result', severity: 'Major', status: 'ready',
  })
  assert.equal(testCase.status, 201)
  const suite = await request('/api/suites', 'POST', {
    name: 'H2 synthetic smoke suite', feature: 'H2 Smoke', status: 'ready',
  })
  assert.equal(suite.status, 201)
  assert.equal((await request('/api/suites/' + suite.body.data.id + '/cases', 'POST',
    { testCaseId: testCase.body.data.id })).status, 201)
  const run = await request('/api/test-runs', 'POST',
    { suiteId: suite.body.data.id, createdBy: 'synthetic smoke fixture' })
  assert.equal(run.status, 201)
  const source = run.body.data.results[0]
  assert.notEqual(source.id, run.body.data.id, 'fixture requires different result/run IDs')
  assert.notEqual(source.id, source.testCaseId, 'fixture requires different result/case IDs')
  const sourceUrl = '/api/test-runs/' + run.body.data.id + '/results/' + source.id
  assert.equal((await request(sourceUrl, 'PUT', { result: 'failed', notes: 'Synthetic failure' })).status, 200)

  const payload = {
    title: 'H2 synthetic defect',
    description: 'Steps: synthetic action\nExpected: success\nActual: failure',
    severity: 'Major', sourceResultId: source.id,
  }
  const created = await request('/api/bugs', 'POST', payload)
  assert.equal(created.status, 201)
  let bug = created.body.data
  assert.equal(bug.status, 'open')
  assert.deepEqual([bug.sourceResultId, bug.sourceRunId, bug.testCaseId],
    [source.id, run.body.data.id, source.testCaseId])
  assert.deepEqual((await request('/api/bugs/' + bug.id)).body.data, bug)
  passed('explicit creation derives source identity and reads saved bug',
    { http: 201, sourceResultId: bug.sourceResultId, sourceRunId: bug.sourceRunId, testCaseId: bug.testCaseId })

  let before = snapshot()
  const inconsistent = await request('/api/bugs', 'POST', { ...payload, testCaseId: null })
  assert.equal(inconsistent.status, 400)
  assert.deepEqual([inconsistent.body.success, inconsistent.body.data], [false, null])
  assert.deepEqual(snapshot(), before)
  passed('source/case mismatch rejected without state changes', { http: 400 })

  const update = status => ({
    title: bug.title, description: bug.description, severity: bug.severity,
    status, testCaseId: bug.testCaseId,
  })
  before = snapshot()
  assert.equal((await request('/api/bugs/' + bug.id, 'PUT', update('closed'))).status, 409)
  assert.deepEqual(snapshot(), before)
  passed('forbidden transition preserves fields and timestamps', { http: 409 })
  for (const status of ['in-progress', 'resolved', 'closed']) {
    const response = await request('/api/bugs/' + bug.id, 'PUT', update(status))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.status, status)
    bug = response.body.data
  }
  before = snapshot()
  assert.equal((await request('/api/suites/' + run.body.data.suiteId, 'DELETE')).status, 409)
  assert.deepEqual(snapshot(), before)
  passed('closed bug retains source and suite deletion is atomic', { http: 409 })

  assert.equal((await request(sourceUrl, 'PUT', { result: 'passed', notes: 'Later observation' })).status, 200)
  assert.deepEqual((await request('/api/bugs/' + bug.id)).body.data, bug)
  before = snapshot()
  assert.equal((await request('/api/bugs', 'POST', payload)).status, 409)
  assert.deepEqual(snapshot(), before)
  passed('later source edit retained; nonfailed source rejects new bug', { http: 409 })

  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  db.close()
  const reopened = new Database(databasePath, { readonly: true })
  try {
    assert.deepEqual(reopened.prepare('SELECT status, source_result_id, test_case_id FROM bugs WHERE id = ?').get(bug.id),
      { status: 'closed', source_result_id: source.id, test_case_id: source.testCaseId })
  } finally {
    reopened.close()
  }
  passed('SQLite reopen preserves status and source identity', { status: 'closed' })
  summary = {
    event: 'h2-smoke-passed', node: process.version, address,
    database: 'Owned temporary synthetic SQLite; removed on completion',
    checks,
  }
} finally {
  if (server?.listening) await new Promise(resolve => server.close(resolve))
  if (db?.open) db.close()
  // Remove only the files belonging to this database, never arbitrary contents.
  for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(databasePath + suffix, { force: true })
  fs.rmdirSync(directory)
}
console.log(JSON.stringify(summary, null, 2))
