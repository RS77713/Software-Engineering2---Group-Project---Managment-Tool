// Regression tests for GET /api/test-cases/export. Uses Node's built-in
// test runner against a real, isolated temp database (never the real
// server/data.sqlite).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { parseCsv } from '../csv-parser.js'

const dbPath = path.join(
  os.tmpdir(),
  `bootcamp-app-test-cases-export-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
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

// The export response isn't JSON, so this returns the raw text + headers.
async function exportCsv(query = '') {
  const res = await fetch(`${baseUrl}/api/test-cases/export${query}`)
  return { status: res.status, headers: res.headers, text: await res.text() }
}

function createTestCase(overrides = {}) {
  return api('/api/test-cases', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Untitled [Export]',
      steps: ['Step one.'],
      expectedResult: 'It works.',
      severity: 'Major',
      ...overrides,
    }),
  })
}

test('the response is a downloadable text/csv file with a dated filename', async () => {
  const res = await exportCsv()
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /text\/csv/)
  assert.match(res.headers.get('content-disposition'), /^attachment; filename="test-cases-\d{4}-\d{2}-\d{2}\.csv"$/)
})

test('headers are exactly the columns requested, in order, and are compatible with CSV import', async () => {
  const res = await exportCsv()
  const { headers } = parseCsv(res.text)
  assert.deepEqual(headers, ['id', 'title', 'severity', 'status', 'preconditions', 'steps', 'expected_result', 'created_at', 'updated_at'])
})

test('an empty result set still exports just the header row, as a valid CSV', async () => {
  const res = await exportCsv('?search=NoSuchTitleAnywhere12345')
  assert.equal(res.status, 200)
  const { headers, rows } = parseCsv(res.text)
  assert.deepEqual(headers, ['id', 'title', 'severity', 'status', 'preconditions', 'steps', 'expected_result', 'created_at', 'updated_at'])
  assert.equal(rows.length, 0)
})

test('the export honors the active status filter, matching the list endpoint', async () => {
  const draftCase = await createTestCase({ title: 'Draft export case [Export]', status: 'draft' })
  const readyCase = await createTestCase({ title: 'Ready export case [Export]', status: 'ready' })

  const res = await exportCsv('?status=ready')
  const { rows } = parseCsv(res.text)
  const titles = rows.map((r) => r.cells[1])

  assert.ok(titles.includes(readyCase.body.data.title))
  assert.ok(!titles.includes(draftCase.body.data.title), 'a non-matching status must not appear in the export')
})

test('the export honors the active search filter, matching the list endpoint', async () => {
  await createTestCase({ title: 'Findable via search export [Export]' })
  await createTestCase({ title: 'Should not match this search [Export]' })

  const res = await exportCsv(`?search=${encodeURIComponent('Findable via search')}`)
  const { rows } = parseCsv(res.text)
  const titles = rows.map((r) => r.cells[1])

  assert.ok(titles.every((title) => title.includes('Findable via search export')))
  assert.ok(titles.length > 0)
})

test('the export honors the current sort/order, matching the list endpoint (severity, ascending)', async () => {
  const suiteLabel = `Sort Order ${Date.now()}`
  await createTestCase({ title: `Trivial case [${suiteLabel}]`, severity: 'Trivial' })
  await createTestCase({ title: `Critical case [${suiteLabel}]`, severity: 'Critical' })
  await createTestCase({ title: `Minor case [${suiteLabel}]`, severity: 'Minor' })
  await createTestCase({ title: `Major case [${suiteLabel}]`, severity: 'Major' })

  const res = await exportCsv(`?search=${encodeURIComponent(suiteLabel)}&sort=severity&order=asc`)
  const { rows } = parseCsv(res.text)
  const severities = rows.map((r) => r.cells[2])

  assert.deepEqual(severities, ['Critical', 'Major', 'Minor', 'Trivial'])
})

test('with no sort param at all, the export defaults to id ascending (creation order, newest last), matching the list default', async () => {
  const suiteLabel = `Export Default Sort ${Date.now()}`
  const first = await createTestCase({ title: `First [${suiteLabel}]` })
  const second = await createTestCase({ title: `Second [${suiteLabel}]` })
  const third = await createTestCase({ title: `Third [${suiteLabel}]` })

  const res = await exportCsv(`?search=${encodeURIComponent(suiteLabel)}`)
  const { rows } = parseCsv(res.text)
  assert.deepEqual(
    rows.map((r) => Number(r.cells[0])),
    [first.body.data.id, second.body.data.id, third.body.data.id]
  )
})

test('the export still honors an explicitly chosen updatedAt sort, overriding the id default', async () => {
  const suiteLabel = `Export Explicit Updated Sort ${Date.now()}`
  const first = await createTestCase({ title: `First [${suiteLabel}]` })
  await new Promise((resolve) => setTimeout(resolve, 10))
  const second = await createTestCase({ title: `Second [${suiteLabel}]` })

  const res = await exportCsv(`?search=${encodeURIComponent(suiteLabel)}&sort=updatedAt&order=desc`)
  const { rows } = parseCsv(res.text)
  assert.deepEqual(
    rows.map((r) => Number(r.cells[0])),
    [second.body.data.id, first.body.data.id],
    'an explicit sort choice must still be honored, not silently replaced by the id default'
  )
})

test('the export includes every matching row, not just one page worth (beyond PAGE_SIZE=20)', async () => {
  const suiteLabel = `Beyond One Page ${Date.now()}`
  const createdTitles = []
  for (let i = 1; i <= 25; i++) {
    const title = `Case ${i} [${suiteLabel}]`
    await createTestCase({ title })
    createdTitles.push(title)
  }

  // Sanity check: the paginated list endpoint really does cap at 20.
  const list = await api(`/api/test-cases?search=${encodeURIComponent(suiteLabel)}&page=1`)
  assert.equal(list.body.data.items.length, 20, 'the list endpoint should still be capped at one page')
  assert.equal(list.body.data.total, 25)

  const res = await exportCsv(`?search=${encodeURIComponent(suiteLabel)}`)
  const { rows } = parseCsv(res.text)
  assert.equal(rows.length, 25, 'the export must include all 25 matching rows, not just the first page')

  const exportedTitles = rows.map((r) => r.cells[1]).sort()
  assert.deepEqual(exportedTitles, [...createdTitles].sort())
})

test('commas, double quotes, multi-line steps, and UTF-8 all survive the export/import round trip exactly', async () => {
  const originalSteps = ['Go to the login page.', 'Enter "valid" credentials, then submit.', 'Confirm café ☕ 日本語 appears.']
  const created = await createTestCase({
    title: 'Escaping, quoting "and" UTF-8 café [Export]',
    steps: originalSteps,
    preconditions: 'Notes with a comma, and "quotes".',
    expectedResult: 'Résumé displays correctly, with no mangled text.',
    severity: 'Minor',
  })

  const res = await exportCsv(`?search=${encodeURIComponent('Escaping, quoting')}`)
  const { rows } = parseCsv(res.text)
  assert.equal(rows.length, 1)

  const [id, title, severity, status, preconditions, steps, expectedResult] = rows[0].cells
  assert.equal(Number(id), created.body.data.id)
  assert.equal(title, 'Escaping, quoting "and" UTF-8 café [Export]')
  assert.equal(severity, 'Minor')
  assert.equal(status, 'draft')
  assert.equal(preconditions, 'Notes with a comma, and "quotes".')
  assert.deepEqual(steps.split('\n'), originalSteps, 'steps must be one per line in a single cell, exactly as saved')
  assert.equal(expectedResult, 'Résumé displays correctly, with no mangled text.')
})

test('a re-import of the exported CSV recognizes its headers and reports every row as an existing duplicate', async () => {
  await createTestCase({ title: 'Round trip case A [Export]' })
  await createTestCase({ title: 'Round trip case B [Export]', preconditions: 'Some precondition.' })

  const exported = await exportCsv('?search=Round trip case')
  const preview = await api('/api/test-cases/import', {
    method: 'POST',
    body: JSON.stringify({ csv: exported.text, commit: false }),
  })

  assert.equal(preview.status, 200, 'the exported CSV must be accepted — its headers must satisfy the import requirements')
  assert.equal(preview.body.data.rows.length, 2)
  for (const row of preview.body.data.rows) {
    assert.equal(row.valid, true)
    assert.equal(row.duplicate?.reason, 'existing-test-case', 'every exported row already exists, so re-importing it must be recognized as a duplicate, not re-created')
  }
})
