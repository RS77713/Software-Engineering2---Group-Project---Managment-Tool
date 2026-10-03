// Focused regression tests for the three QA-review fixes below. Uses Node's
// built-in test runner (`node --test`) against a real, isolated temp
// database, so it never touches the real dev database.
//
// 1. PUT /api/suites/:id must not silently reset status to 'draft' when the
//    request body omits it.
// 2. Deleting a test case must be discoverable as removing it from any
//    suite it belongs to (via GET /api/test-cases/:id/suites), and the
//    suite must actually no longer contain it afterward.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'

// Point every module that touches the DB at a fresh temp file *before*
// anything imports server/db.js, so the real dev database is never opened.
const dbPath = path.join(os.tmpdir(), `bootcamp-app-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`)
process.env.TEST_DB_PATH = dbPath

const { default: app } = await import('../app.js')
const { db } = await import('../db.js')

let server
let baseUrl

before(async () => {
  server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.close()
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    fs.rmSync(dbPath + suffix, { force: true })
  }
})

async function api(requestPath, options = {}) {
  const res = await fetch(`${baseUrl}${requestPath}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  return { status: res.status, body: await res.json() }
}

test('PUT /api/suites/:id preserves status when the request omits it', async () => {
  const created = await api('/api/suites', {
    method: 'POST',
    body: JSON.stringify({ name: 'Regression Suite', feature: 'Regression', status: 'passed' }),
  })
  assert.equal(created.status, 201)
  assert.equal(created.body.data.status, 'passed')
  const suiteId = created.body.data.id

  // Rename only — status is intentionally left out of this payload.
  const renamed = await api(`/api/suites/${suiteId}`, {
    method: 'PUT',
    body: JSON.stringify({ name: 'Renamed Regression Suite', feature: 'Regression' }),
  })
  assert.equal(renamed.status, 200)
  assert.equal(renamed.body.data.name, 'Renamed Regression Suite')
  assert.equal(renamed.body.data.status, 'passed', 'status must be preserved, not reset to draft')

  // Explicitly changing status still works.
  const changed = await api(`/api/suites/${suiteId}`, {
    method: 'PUT',
    body: JSON.stringify({ name: 'Renamed Regression Suite', feature: 'Regression', status: 'failed' }),
  })
  assert.equal(changed.body.data.status, 'failed')

  // Creating a suite with no status still defaults to 'draft' (unchanged behavior).
  const createdNoStatus = await api('/api/suites', {
    method: 'POST',
    body: JSON.stringify({ name: 'Default Status Suite', feature: 'Regression' }),
  })
  assert.equal(createdNoStatus.body.data.status, 'draft')
})

test('deleting a test case is discoverable as removing it from its suites', async () => {
  const testCase = await api('/api/test-cases', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Regression case [Regression]',
      steps: ['Step one.'],
      expectedResult: 'It works.',
      severity: 'Minor',
    }),
  })
  assert.equal(testCase.status, 201)
  const testCaseId = testCase.body.data.id

  const suite = await api('/api/suites', {
    method: 'POST',
    body: JSON.stringify({ name: 'Suite With A Case', feature: 'Regression' }),
  })
  const suiteId = suite.body.data.id

  await api(`/api/suites/${suiteId}/cases`, {
    method: 'POST',
    body: JSON.stringify({ testCaseId }),
  })

  // Before deleting, the lookup endpoint must report the suite.
  const before = await api(`/api/test-cases/${testCaseId}/suites`)
  assert.equal(before.status, 200)
  assert.deepEqual(
    before.body.data.suites.map((s) => s.id),
    [suiteId]
  )

  // A test case that belongs to no suite reports an empty list (not an error).
  const otherCase = await api('/api/test-cases', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Unattached case [Regression]',
      steps: ['Step one.'],
      expectedResult: 'It works.',
      severity: 'Trivial',
    }),
  })
  const unattached = await api(`/api/test-cases/${otherCase.body.data.id}/suites`)
  assert.deepEqual(unattached.body.data.suites, [])

  // Delete the case, then confirm the suite no longer contains it.
  const deleted = await api(`/api/test-cases/${testCaseId}`, { method: 'DELETE' })
  assert.equal(deleted.status, 200)

  const suiteAfter = await api(`/api/suites/${suiteId}`)
  assert.equal(suiteAfter.body.data.cases.length, 0, 'the deleted case must be gone from the suite')

  // The lookup endpoint itself now 404s for the deleted test case.
  const afterLookup = await api(`/api/test-cases/${testCaseId}/suites`)
  assert.equal(afterLookup.status, 404)
})

test('an error passed to next() (e.g. malformed JSON) still gets the {success,data,error} shape', async () => {
  // express.json() calls next(err) itself on unparseable JSON, with
  // err.status set to 400 — this never reaches our route handlers at all,
  // so it's a real test of the app-level error middleware, not the routes.
  const res = await fetch(`${baseUrl}/api/test-cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not valid json',
  })
  const body = await res.json()

  assert.equal(res.status, 400, 'a malformed request body is a client error, not a server error')
  assert.equal(body.success, false)
  assert.equal(body.data, null)
  assert.equal(typeof body.error, 'string')
})
