// Regression tests for POST /api/test-cases/import. Uses Node's built-in
// test runner against a real, isolated temp database (never the real
// server/data.sqlite).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'

const dbPath = path.join(
  os.tmpdir(),
  `bootcamp-app-test-cases-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
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

function importCsv(csv, commit = false) {
  return api('/api/test-cases/import', { method: 'POST', body: JSON.stringify({ csv, commit }) })
}

async function testCaseCount() {
  const res = await api('/api/test-cases?page=1')
  return res.body.data.total
}

const VALID_HEADER = 'title,severity,steps,expected_result'

function validRow(title, { severity = 'Critical', steps = 'Step one.', expectedResult = 'It works.' } = {}) {
  return `"${title}",${severity},"${steps}","${expectedResult}"`
}

test('the response envelope follows { success, data, error }, with totalRows/committed/rows/summary', async () => {
  const csv = `${VALID_HEADER}\n${validRow('Login with valid credentials [Auth]')}\n`
  const res = await importCsv(csv, false)

  assert.equal(res.status, 200)
  assert.equal(res.body.success, true)
  assert.equal(res.body.error, null)

  const { data } = res.body
  assert.equal(data.totalRows, 1)
  assert.equal(data.committed, false)
  assert.equal(data.summary.imported, 0)
  assert.equal(data.summary.invalid, 0)
  assert.equal(data.summary.duplicate, 0)
  assert.equal(data.rows.length, 1)
  assert.deepEqual(data.rows[0], {
    rowNumber: 2,
    title: 'Login with valid credentials [Auth]',
    valid: true,
    errors: [],
    duplicate: null,
    imported: false,
  })
})

test('missing csv in the request body is rejected', async () => {
  const res = await api('/api/test-cases/import', { method: 'POST', body: JSON.stringify({ commit: false }) })
  assert.equal(res.status, 400)
  assert.equal(res.body.success, false)
  assert.match(res.body.error, /csv is required/)
})

test('a header missing any of title/severity/steps/expected_result rejects the whole file, before any row is processed', async () => {
  const before = await testCaseCount()

  const missingExpectedResult = await importCsv('title,severity,steps\n"Login [Auth]",Critical,"Step one."\n')
  assert.equal(missingExpectedResult.status, 400)
  assert.equal(missingExpectedResult.body.success, false)
  assert.match(missingExpectedResult.body.error, /expected_result/)

  const missingSteps = await importCsv('title,severity,expected_result\n"Login [Auth]",Critical,"Works."\n')
  assert.equal(missingSteps.status, 400)
  assert.match(missingSteps.body.error, /steps/)

  assert.equal(await testCaseCount(), before, 'a rejected file must not create anything')
})

test('expected_result is also accepted spelled expectedResult or "expected result"', async () => {
  const camel = await importCsv('title,severity,steps,expectedResult\n"Camel [Auth]",Critical,"Step.","Works."\n')
  assert.equal(camel.status, 200)
  assert.equal(camel.body.data.rows[0].valid, true)

  const spaced = await importCsv('title,severity,steps,expected result\n"Spaced [Auth]",Critical,"Step.","Works."\n')
  assert.equal(spaced.status, 200)
  assert.equal(spaced.body.data.rows[0].valid, true)
})

test('a duplicate header column is rejected as a whole-file error', async () => {
  const res = await importCsv('title,title,severity,steps,expected_result\n"A [X]","A [X]",Critical,"Step.","Works."\n')
  assert.equal(res.status, 400)
  assert.match(res.body.error, /duplicate column/)
})

test('preview (commit: false) never writes anything, even for an entirely valid file', async () => {
  const before = await testCaseCount()
  const csv = `${VALID_HEADER}\n${validRow('Preview only case [Import]')}\n`

  const res = await importCsv(csv, false)
  assert.equal(res.status, 200)
  assert.equal(res.body.data.rows[0].valid, true)
  assert.equal(res.body.data.rows[0].imported, false)
  assert.equal(res.body.data.summary.imported, 0)

  assert.equal(await testCaseCount(), before, 'preview must not create any row')
})

test('commit inserts only valid, non-duplicate rows, and the created row matches the CSV (including multi-line steps)', async () => {
  const csv =
    'title,severity,steps,expected_result,preconditions,status\n' +
    '"Multiline steps case [Import]",Major,"Go to the login page.\nEnter valid credentials.\nClick log in.","User is redirected to the dashboard.","User has an account.",ready\n'

  const res = await importCsv(csv, true)
  assert.equal(res.status, 200)
  assert.equal(res.body.data.summary.imported, 1)
  assert.equal(res.body.data.rows[0].imported, true)

  const list = await api(`/api/test-cases?search=${encodeURIComponent('Multiline steps case')}`)
  const created = list.body.data.items.find((tc) => tc.title === 'Multiline steps case [Import]')
  assert.ok(created, 'the row must actually exist in the database now')
  assert.deepEqual(created.steps, ['Go to the login page.', 'Enter valid credentials.', 'Click log in.'])
  assert.equal(created.preconditions, 'User has an account.')
  assert.equal(created.status, 'ready')
  assert.equal(created.severity, 'Major')
})

test('status defaults to draft and preconditions to null when their columns are absent, matching the manual form', async () => {
  const csv = `${VALID_HEADER}\n${validRow('Defaults case [Import]')}\n`
  await importCsv(csv, true)

  const list = await api(`/api/test-cases?search=${encodeURIComponent('Defaults case')}`)
  const created = list.body.data.items.find((tc) => tc.title === 'Defaults case [Import]')
  assert.equal(created.status, 'draft')
  assert.equal(created.preconditions, null)
})

test('a row missing the title-bracket feature area, an invalid severity, or no steps reuses the exact validator messages, unmodified', async () => {
  const csv =
    `${VALID_HEADER}\n` +
    'No brackets here,Critical,"Step one.",Works.\n' +
    `"Bad severity [Import]",Nonsense,"Step one.",Works.\n` +
    `"No steps [Import]",Critical,,Works.\n`

  const res = await importCsv(csv, false)
  assert.equal(res.status, 200)
  const [noBrackets, badSeverity, noSteps] = res.body.data.rows

  assert.equal(noBrackets.valid, false)
  assert.match(noBrackets.errors.join('; '), /feature area in square brackets/)

  assert.equal(badSeverity.valid, false)
  assert.match(badSeverity.errors.join('; '), /severity must be one of: Critical, Major, Minor, Trivial/)

  assert.equal(noSteps.valid, false)
  assert.match(noSteps.errors.join('; '), /at least one step is required/)

  assert.equal(res.body.data.summary.invalid, 3)
})

test('expected_result: a missing header rejects the whole file, but a present-and-blank cell only invalidates that one row', async () => {
  const before = await testCaseCount()

  // (a) header entirely absent -> whole file rejected, nothing processed.
  const noHeader = await importCsv('title,severity,steps\n"A [Import]",Critical,"Step."\n')
  assert.equal(noHeader.status, 400)
  assert.match(noHeader.body.error, /expected_result/)
  assert.equal(await testCaseCount(), before)

  // (b) header present, one row's cell blank -> only that row is invalid;
  // the other, genuinely valid row in the same file still imports.
  const csv =
    `${VALID_HEADER}\n` +
    `"Blank expected result [Import]",Critical,"Step.",\n` +
    `${validRow('Still valid alongside it [Import]')}\n`

  const preview = await importCsv(csv, false)
  assert.equal(preview.status, 200)
  const [blankRow, validRowResult] = preview.body.data.rows
  assert.equal(blankRow.valid, false)
  assert.match(blankRow.errors.join('; '), /expectedResult is required/)
  assert.equal(validRowResult.valid, true)

  const commit = await importCsv(csv, true)
  assert.equal(commit.body.data.summary.imported, 1)
  assert.equal(commit.body.data.summary.invalid, 1)
  assert.equal(await testCaseCount(), before + 1, 'only the genuinely valid row must have been created')
})

test('a structurally malformed file (an unterminated quoted field) is rejected as a whole-file error, and writes nothing', async () => {
  const before = await testCaseCount()
  // The steps field opens with a quote (right after a comma, so it's
  // read as the start of a quoted field) and no further " ever appears
  // before EOF, so it genuinely never closes.
  const csv = `${VALID_HEADER}\nNever closed [Import],Critical,"Step one with no closing quote,Works.\n`

  const res = await importCsv(csv, true)
  assert.equal(res.status, 400)
  assert.equal(res.body.success, false)
  assert.equal(await testCaseCount(), before, 'a malformed file must not corrupt or partially import anything')
})

test('a row with the wrong number of columns is reported as invalid for that row, not silently misaligned', async () => {
  const csv = `${VALID_HEADER}\n"Too few fields [Import]",Critical\n`
  const res = await importCsv(csv, false)
  assert.equal(res.status, 200)
  assert.equal(res.body.data.rows[0].valid, false)
  assert.match(res.body.data.rows[0].errors[0], /expected 4 columns, found 2/)
})

test('fully blank lines anywhere in the file are skipped — not counted as a row, and not an error', async () => {
  const csv = `${VALID_HEADER}\n\n${validRow('Around a blank line [Import]')}\n,,,\n`
  const res = await importCsv(csv, false)
  assert.equal(res.status, 200)
  assert.equal(res.body.data.totalRows, 1)
  assert.equal(res.body.data.rows[0].rowNumber, 2, 'row numbering must not be thrown off by the blank lines around it')
})

test('two rows in the same file sharing a title: the first is importable, the second is reported as a duplicate of it and skipped', async () => {
  const csv =
    `${VALID_HEADER}\n${validRow('Repeated title [Import]')}\n` +
    `"Repeated title [Import]",Major,"A different step.","A different result."\n`

  const preview = await importCsv(csv, false)
  const [first, second] = preview.body.data.rows
  assert.equal(first.valid, true)
  assert.equal(first.duplicate, null)
  assert.equal(second.valid, true)
  assert.deepEqual(second.duplicate, { reason: 'duplicate-in-file', firstRowNumber: 2 })

  const commit = await importCsv(csv, true)
  assert.equal(commit.body.data.summary.imported, 1)
  assert.equal(commit.body.data.summary.duplicate, 1)
})

test('a title that already exists in the database is reported as a duplicate and skipped, never overwritten', async () => {
  const create = await api('/api/test-cases', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Already exists [Import]',
      steps: ['Original step.'],
      expectedResult: 'Original result.',
      severity: 'Minor',
    }),
  })
  const existingId = create.body.data.id

  const csv = `${VALID_HEADER}\n"Already exists [Import]",Critical,"New step.","New result."\n`
  const preview = await importCsv(csv, false)
  assert.deepEqual(preview.body.data.rows[0].duplicate, { reason: 'existing-test-case', existingId })

  const commit = await importCsv(csv, true)
  assert.equal(commit.body.data.summary.duplicate, 1)
  assert.equal(commit.body.data.summary.imported, 0)

  const stillOriginal = await api(`/api/test-cases/${existingId}`)
  assert.equal(stillOriginal.body.data.steps[0], 'Original step.', 'the existing row must be untouched, not overwritten')
})

test('commit re-checks duplicates against live data, not a stale earlier preview', async () => {
  const title = 'Created between preview and commit [Import]'
  const csv = `${VALID_HEADER}\n"${title}",Critical,"Step.","Works."\n`

  // Preview first: title doesn't exist yet, so it's reported as importable.
  const preview = await importCsv(csv, false)
  assert.equal(preview.body.data.rows[0].valid, true)
  assert.equal(preview.body.data.rows[0].duplicate, null)

  // Someone creates that exact title through the normal API in the
  // meantime — the preview above has no way of knowing this happened.
  await api('/api/test-cases', {
    method: 'POST',
    body: JSON.stringify({
      title,
      steps: ['Some other step.'],
      expectedResult: 'Some other result.',
      severity: 'Minor',
    }),
  })
  const countAfterManualCreate = await testCaseCount()

  // Committing the *same* CSV must re-detect the now-existing title as a
  // duplicate and skip it — not blindly trust the earlier preview.
  const commit = await importCsv(csv, true)
  assert.equal(commit.body.data.rows[0].valid, true)
  assert.ok(commit.body.data.rows[0].duplicate, 'must now be flagged duplicate, unlike in the earlier preview')
  assert.equal(commit.body.data.summary.imported, 0)
  assert.equal(commit.body.data.summary.duplicate, 1)
  assert.equal(await testCaseCount(), countAfterManualCreate, 'commit must not have inserted a second copy')
})
