// Regression tests for GET /api/test-cases sort/order behavior — in
// particular the default sort (id, ascending — creation order, newest
// last) when no sort/order params are given at all, and that explicitly
// choosing severity/updatedAt still works exactly as before. Uses an
// isolated temporary database.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'

const dbPath = path.join(
  os.tmpdir(),
  `bootcamp-app-test-cases-list-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
)
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

function createTestCase(overrides = {}) {
  return api('/api/test-cases', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Untitled [Sort]',
      steps: ['Step one.'],
      expectedResult: 'It works.',
      severity: 'Major',
      ...overrides,
    }),
  })
}

test('GET /api/test-cases with no sort/order params at all defaults to id ascending (creation order, newest last)', async () => {
  const suiteLabel = `Default Sort ${Date.now()}`
  const first = await createTestCase({ title: `First created [${suiteLabel}]` })
  const second = await createTestCase({ title: `Second created [${suiteLabel}]` })
  const third = await createTestCase({ title: `Third created [${suiteLabel}]` })

  const res = await api(`/api/test-cases?search=${encodeURIComponent(suiteLabel)}`)
  assert.equal(res.status, 200)
  assert.deepEqual(
    res.body.data.items.map((item) => item.id),
    [first.body.data.id, second.body.data.id, third.body.data.id],
    'with nothing else specified, items must come back in ascending id order'
  )
})

test('explicitly sorting by updatedAt (desc) still works exactly as before, overriding the id default', async () => {
  const suiteLabel = `Explicit Updated Sort ${Date.now()}`
  const first = await createTestCase({ title: `First [${suiteLabel}]` })
  await new Promise((resolve) => setTimeout(resolve, 10))
  const second = await createTestCase({ title: `Second [${suiteLabel}]` })

  // Touch the first one again so it becomes the most recently updated,
  // even though it has the lower id.
  await api(`/api/test-cases/${first.body.data.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: `First [${suiteLabel}]`,
      steps: ['Step one, edited.'],
      expectedResult: 'It works.',
      severity: 'Major',
    }),
  })

  const res = await api(`/api/test-cases?search=${encodeURIComponent(suiteLabel)}&sort=updatedAt&order=desc`)
  assert.deepEqual(
    res.body.data.items.map((item) => item.id),
    [first.body.data.id, second.body.data.id],
    'an explicit updatedAt sort must still put the most recently touched row first, id default notwithstanding'
  )
})

test('explicitly sorting by severity still works exactly as before, overriding the id default', async () => {
  const suiteLabel = `Explicit Severity Sort ${Date.now()}`
  await createTestCase({ title: `Trivial [${suiteLabel}]`, severity: 'Trivial' })
  await createTestCase({ title: `Critical [${suiteLabel}]`, severity: 'Critical' })

  const res = await api(`/api/test-cases?search=${encodeURIComponent(suiteLabel)}&sort=severity&order=asc`)
  assert.deepEqual(
    res.body.data.items.map((item) => item.severity),
    ['Critical', 'Trivial']
  )
})

test('the id default combines correctly with an active status filter', async () => {
  const suiteLabel = `Default Sort With Filter ${Date.now()}`
  const firstReady = await createTestCase({ title: `First ready [${suiteLabel}]`, status: 'ready' })
  await createTestCase({ title: `Draft in between [${suiteLabel}]`, status: 'draft' })
  const secondReady = await createTestCase({ title: `Second ready [${suiteLabel}]`, status: 'ready' })

  const res = await api(`/api/test-cases?search=${encodeURIComponent(suiteLabel)}&status=ready`)
  assert.deepEqual(
    res.body.data.items.map((item) => item.id),
    [firstReady.body.data.id, secondReady.body.data.id],
    'the filtered-out draft case must not break ascending-id order among the remaining matches'
  )
})
