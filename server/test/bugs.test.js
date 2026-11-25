import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import Database from 'better-sqlite3'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-bugs-'))
const databasePath = path.join(directory, 'test.sqlite')
process.env.TEST_DB_PATH = databasePath
const { default: app } = await import('../app.js')
const { db } = await import('../db.js')
const server = http.createServer(app)
let baseUrl
const tables = ['test_cases', 'suites', 'suite_test_cases', 'test_runs_v2', 'test_run_results']
const payload = { title: 'A defect', description: 'Steps\nExpected\nActual', severity: 'Major' }
const fields = ['id', 'title', 'description', 'severity', 'status', 'testCaseId', 'sourceResultId', 'sourceRunId', 'createdAt', 'updatedAt'].sort()

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise((resolve) => server.close(resolve))
  db.close()
  fs.rmSync(directory, { recursive: true, force: true })
})
beforeEach(() => {
  db.exec('DELETE FROM bugs; DELETE FROM test_run_results; DELETE FROM test_runs_v2; DELETE FROM suite_test_cases; DELETE FROM suites; DELETE FROM test_cases;')
  db.exec(`INSERT INTO test_cases (id,title,steps,expected_result,severity,status,created_at,updated_at)
    VALUES (10,'Case [Core]','["step"]','expected','Major','ready','2020-01-01','2020-01-01'),
           (20,'Other [Core]','["step"]','expected','Minor','ready','2020-01-01','2020-01-01');
    INSERT INTO suites (id,name,feature,status,created_at,updated_at) VALUES
      (30,'Suite','Core','ready','2020-01-01','2020-01-01'),(31,'Other','Core','ready','2020-01-01','2020-01-01');
    INSERT INTO suite_test_cases VALUES (30,10,0),(31,20,0);
    INSERT INTO test_runs_v2 (id,suite_id,status,start_time,created_by) VALUES
      (40,30,'passed','2020-01-01','test'),(41,31,'in-progress','2020-01-01','test');
    INSERT INTO test_run_results (id,run_id,test_case_id,result) VALUES (50,40,10,'failed'),(51,41,10,'failed');`)
})

async function request(url = '/api/bugs', { method = 'GET', body, raw, type = 'application/json', headers = {} } = {}) {
  const response = await fetch(baseUrl + url, {
    method, headers: { ...(type === null ? {} : { 'Content-Type': type }), ...headers },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  })
  return { status: response.status, body: await response.json(), headers: response.headers }
}
function failure(response, status) {
  assert.equal(response.status, status)
  assert.deepEqual(Object.keys(response.body).sort(), ['data', 'error', 'success'])
  assert.equal(response.body.success, false)
  assert.equal(response.body.data, null)
  assert.equal(typeof response.body.error, 'string')
  assert.ok(response.body.error.length)
}
async function create(extra = {}) {
  const response = await request('/api/bugs', { method: 'POST', body: { ...payload, ...extra } })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  assert.equal(response.body.success, true)
  assert.equal(response.body.error, null)
  assert.deepEqual(Object.keys(response.body.data).sort(), fields)
  return response.body.data
}
const snapshot = (names = [...tables, 'bugs']) => Object.fromEntries(names.map((name) => [name, db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]))
const count = () => db.prepare('SELECT count(*) AS n FROM bugs').get().n
const updateBody = (bug, extra = {}) => ({ title: bug.title, description: bug.description, severity: bug.severity, status: bug.status, testCaseId: bug.testCaseId, ...extra })

test('standalone creation trims text, retains internal whitespace, allows duplicates and persists', async () => {
  const inherited = snapshot(tables)
  const bug = await create({ title: '  Defect without a feature suffix  ', description: ' \nA  B\n C \n' })
  assert.equal(bug.title, 'Defect without a feature suffix')
  assert.equal(bug.description, 'A  B\n C')
  assert.equal(bug.status, 'open')
  assert.equal(bug.testCaseId, null)
  assert.equal(bug.sourceResultId, null)
  assert.equal(bug.sourceRunId, null)
  assert.equal(bug.createdAt, bug.updatedAt)
  assert.equal(new Date(bug.createdAt).toISOString(), bug.createdAt)
  assert.ok(Number.isSafeInteger(bug.id) && bug.id > 0)
  const linked = await create({ testCaseId: 20, sourceResultId: null })
  assert.equal(linked.testCaseId, 20)
  assert.equal(linked.sourceRunId, null)
  assert.notEqual((await create()).id, bug.id)
  assert.deepEqual((await request(`/api/bugs/${bug.id}`)).body.data, bug)
  const reopened = new Database(databasePath, { readonly: true })
  try { assert.equal(reopened.prepare('SELECT description FROM bugs WHERE id = ?').get(bug.id).description, bug.description) } finally { reopened.close() }
  assert.deepEqual(snapshot(tables), inherited)
})

test('source creation uses result identity and derives the case/run, with no implicit creation or deduplication', async () => {
  assert.equal(count(), 0)
  const inherited = snapshot(tables)
  const first = await create({ sourceResultId: 50 })
  const second = await create({ sourceResultId: 51, testCaseId: 10 })
  const repeated = await create({ sourceResultId: 50 })
  assert.deepEqual([first.testCaseId, first.sourceResultId, first.sourceRunId], [10, 50, 40])
  assert.deepEqual([second.testCaseId, second.sourceResultId, second.sourceRunId], [10, 51, 41])
  assert.notEqual(first.id, repeated.id)
  assert.deepEqual((await request(`/api/bugs/${first.id}`)).body.data, first)
  assert.deepEqual(snapshot(tables), inherited)
})

test('missing, mismatched and no-longer-failed sources reject without insertion', async () => {
  for (const extra of [{ sourceResultId: 999 }, { testCaseId: 999 }]) failure(await request('/api/bugs', { method: 'POST', body: { ...payload, ...extra } }), 404)
  for (const testCaseId of [null, 20]) failure(await request('/api/bugs', { method: 'POST', body: { ...payload, sourceResultId: 50, testCaseId } }), 400)
  for (const result of ['pending', 'passed', 'skipped']) {
    db.prepare('UPDATE test_run_results SET result = ? WHERE id = 50').run(result)
    failure(await request('/api/bugs', { method: 'POST', body: { ...payload, sourceResultId: 50 } }), 409)
  }
  db.prepare('DELETE FROM test_run_results WHERE id = 50').run()
  failure(await request('/api/bugs', { method: 'POST', body: { ...payload, sourceResultId: 50 } }), 404)
  assert.equal(count(), 0)
})

test('write transaction observes another writer changing or deleting the source before validation', async (t) => {
  for (const [sql, status] of [["UPDATE test_run_results SET result='passed' WHERE id=50", 409], ['DELETE FROM test_run_results WHERE id=51', 404]]) {
    const sourceResultId = status === 409 ? 50 : 51
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      import Database from 'better-sqlite3';
      const db=new Database(process.argv[1]);
      db.exec('BEGIN IMMEDIATE'); db.exec(process.argv[2]);
      console.log('locked');
      setTimeout(() => { db.exec('COMMIT'); db.close(); }, 300);
    `, databasePath, sql], { stdio: ['ignore', 'pipe', 'pipe'] })
    const closed = once(child, 'close')
    t.after(async () => { if (child.exitCode === null) child.kill(); await closed })
    await Promise.race([once(child.stdout, 'data'), closed.then(() => { throw new Error('writer exited before locking') })])
    failure(await request('/api/bugs', { method: 'POST', body: { ...payload, sourceResultId } }), status)
    assert.equal((await closed)[0], 0)
  }
  assert.equal(count(), 0)
})

test('creation rejects missing, mistyped, read-only and unknown fields with no writes', async () => {
  const invalid = [null, [], 42, 'text', {}, ...['title', 'description', 'severity'].map((key) => Object.fromEntries(Object.entries(payload).filter(([name]) => name !== key))),
    ...['', '   ', 12, null, true, {}].flatMap((value) => [{ ...payload, title: value }, { ...payload, description: value }]),
    ...['major', 'all', null, 1].map((severity) => ({ ...payload, severity })),
    ...['status', 'id', 'sourceRunId', 'createdAt', 'updatedAt', 'extra'].map((key) => ({ ...payload, [key]: 'open' })),
    ...['testCaseId', 'sourceResultId'].flatMap((key) => ['50', 0, -1, 1.5, true, {}, Number.MAX_SAFE_INTEGER + 1].map((value) => ({ ...payload, [key]: value }))) ]
  const initial = snapshot()
  for (const body of invalid) failure(await request('/api/bugs', { method: 'POST', body }), 400)
  assert.deepEqual(snapshot(), initial)
})

test('Unicode code-point boundaries include non-BMP characters and embedded NUL', async () => {
  for (const character of ['a', '😀', '\u0000']) {
    const bug = await create({ title: ` ${character.repeat(200)} `, description: ` ${character.repeat(5000)} ` })
    assert.equal([...bug.title].length, 200)
    assert.equal([...bug.description].length, 5000)
    assert.equal(bug.title, character.repeat(200))
    for (const extra of [{ title: character.repeat(201) }, { description: character.repeat(5001) }]) {
      failure(await request('/api/bugs', { method: 'POST', body: { ...payload, ...extra } }), 400)
    }
    assert.throws(() => db.prepare('UPDATE bugs SET title = ? WHERE id = ?').run(character.repeat(201), bug.id), /CHECK constraint/)
  }
  assert.equal(count(), 3)
  // A multibyte character followed by NUL exercises UTF-8 byte boundaries.
  const mixed = await create({ title: '😀\u0000'.repeat(100), description: '😀\u0000'.repeat(2500) })
  assert.equal([...mixed.title].length, 200)
  assert.throws(() => db.prepare('UPDATE bugs SET title = ? WHERE id = ?').run('😀\u0000'.repeat(101), mixed.id), /CHECK constraint/)
})

test('JSON/media/size errors and unexpected database failures use the failure envelope', async () => {
  failure(await request('/api/bugs', { method: 'POST' }), 400)
  failure(await request('/api/bugs', { method: 'POST', raw: '{bad' }), 400)
  failure(await request('/api/bugs', { method: 'POST', body: payload, type: 'text/plain' }), 415)
  failure(await request('/api/bugs', { method: 'POST', body: payload, type: null }), 415)
  failure(await request('/api/bugs', { method: 'POST', body: payload, type: 'application/json; charset=iso-8859-1' }), 415)
  failure(await request('/api/bugs', { method: 'POST', body: { ...payload, description: 'a'.repeat(110000) } }), 413)
  db.exec("CREATE TRIGGER fail_bug_insert BEFORE INSERT ON bugs BEGIN SELECT RAISE(ABORT,'private database details'); END")
  try {
    const result = await request('/api/bugs', { method: 'POST', body: payload })
    failure(result, 500)
    assert.equal(result.body.error, 'internal server error')
  } finally { db.exec('DROP TRIGGER fail_bug_insert') }
  assert.equal(count(), 0)
})

test('detail IDs are strict decimal safe integers; unsupported operations do not delete or modify', async () => {
  const bug = await create()
  for (const id of ['0', '-1', '+1', '1.0', '1e1', '0x10', 'abc', '9007199254740992', '%', '%FF']) failure(await request(`/api/bugs/${id}`), 400)
  failure(await request('/api/bugs/999999'), 404)
  failure(await request('/api/bugs/999999', { method: 'PUT', body: updateBody(bug) }), 404)
  for (const method of ['DELETE', 'PATCH']) failure(await request(`/api/bugs/${bug.id}`, { method, body: payload }), 404)
  assert.deepEqual((await request(`/api/bugs/${bug.id}`)).body.data, bug)
})

test('every lifecycle edge validates the stored state and failed edits preserve all fields and timestamps', async () => {
  const allowed = { open: ['open', 'in-progress'], 'in-progress': ['in-progress', 'open', 'resolved'], resolved: ['resolved', 'in-progress', 'closed'], closed: ['closed', 'open'] }
  const bug = await create()
  const inherited = snapshot(tables)
  for (const from of Object.keys(allowed)) for (const to of Object.keys(allowed)) {
    db.prepare("UPDATE bugs SET status = ?, updated_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(from, bug.id)
    const before = (await request(`/api/bugs/${bug.id}`)).body.data
    const response = await request(`/api/bugs/${bug.id}`, { method: 'PUT', body: updateBody(before, { title: 'edited', status: to }) })
    if (allowed[from].includes(to)) {
      assert.equal(response.status, 200)
      assert.equal(response.body.data.status, to)
      assert.equal(response.body.data.title, 'edited')
      assert.equal(response.body.data.createdAt, bug.createdAt)
      assert.ok(response.body.data.updatedAt > before.updatedAt)
    } else {
      failure(response, 409)
      assert.deepEqual((await request(`/api/bugs/${bug.id}`)).body.data, before)
    }
  }
  assert.deepEqual(snapshot(tables), inherited)
})

test('complete PUT requires all fields, prohibits source/read-only fields and clears omitted standalone links', async () => {
  const bug = await create({ testCaseId: 20 })
  const valid = updateBody(bug)
  for (const field of ['title', 'description', 'severity', 'status']) {
    const body = { ...valid }; delete body[field]
    failure(await request(`/api/bugs/${bug.id}`, { method: 'PUT', body }), 400)
  }
  for (const field of ['sourceResultId', 'sourceRunId', 'id', 'createdAt', 'updatedAt', 'extra']) failure(await request(`/api/bugs/${bug.id}`, { method: 'PUT', body: { ...valid, [field]: null } }), 400)
  failure(await request(`/api/bugs/${bug.id}`, { method: 'PUT', body: { ...valid, testCaseId: 999 } }), 404)
  assert.deepEqual((await request(`/api/bugs/${bug.id}`)).body.data, bug)
  const body = { ...valid }; delete body.testCaseId
  assert.equal((await request(`/api/bugs/${bug.id}`, { method: 'PUT', body })).body.data.testCaseId, null)
  assert.equal((await request(`/api/bugs/${bug.id}`, { method: 'PUT', body: valid })).body.data.testCaseId, 20)
  assert.equal((await request(`/api/bugs/${bug.id}`, { method: 'PUT', body: { ...valid, testCaseId: null } })).body.data.testCaseId, null)
})

test('source identity remains immutable across PUT and later outcome/notes edits', async () => {
  const bug = await create({ sourceResultId: 50 })
  for (const value of [undefined, null, 20]) {
    const body = updateBody(bug, { title: 'changed', testCaseId: value })
    failure(await request(`/api/bugs/${bug.id}`, { method: 'PUT', body }), 409)
  }
  for (const testCaseId of ['10', false, 0]) failure(await request(`/api/bugs/${bug.id}`, { method: 'PUT', body: updateBody(bug, { testCaseId }) }), 400)
  for (const field of ['sourceResultId', 'sourceRunId']) failure(await request(`/api/bugs/${bug.id}`, { method: 'PUT', body: { ...updateBody(bug), [field]: bug[field] } }), 400)
  assert.deepEqual((await request(`/api/bugs/${bug.id}`)).body.data, bug)
  assert.equal((await request('/api/test-runs/40/results/50', { method: 'PUT', body: { result: 'passed', notes: 'later result' } })).status, 200)
  assert.deepEqual((await request(`/api/bugs/${bug.id}`)).body.data, bug)
  failure(await request('/api/bugs', { method: 'POST', body: { ...payload, sourceResultId: 50 } }), 409)
  const response = await request(`/api/bugs/${bug.id}`, { method: 'PUT', body: updateBody(bug, { status: 'in-progress' }) })
  assert.equal(response.status, 200)
  assert.deepEqual([response.body.data.testCaseId, response.body.data.sourceResultId, response.body.data.sourceRunId], [10, 50, 40])
  for (const change of ['id = 500', 'run_id = 41', 'test_case_id = 20']) assert.throws(() => db.exec(`UPDATE test_run_results SET ${change} WHERE id = 50`), /retained bug source/)
})

test('source retention blocks suite/run/result deletion atomically, including after closure', async () => {
  const bug = await create({ sourceResultId: 50 })
  for (const status of ['open', 'closed']) {
    db.prepare('UPDATE bugs SET status = ? WHERE id = ?').run(status, bug.id)
    const before = snapshot()
    failure(await request('/api/suites/30', { method: 'DELETE' }), 409)
    for (const sql of ['DELETE FROM test_run_results WHERE id = 50', 'DELETE FROM test_runs_v2 WHERE id = 40', 'DELETE FROM suites WHERE id = 30']) assert.throws(() => db.exec(sql), /FOREIGN KEY constraint/)
    failure(await request('/api/test-cases/10', { method: 'DELETE' }), 400)
    assert.deepEqual(snapshot(), before)
  }
})

test('unreferenced suite deletion and standalone test-case unlink retain inherited behaviour', async () => {
  const bug = await create({ testCaseId: 20 })
  assert.equal((await request('/api/test-cases/20', { method: 'DELETE' })).status, 200)
  assert.deepEqual((await request(`/api/bugs/${bug.id}`)).body.data, { ...bug, testCaseId: null })
  assert.equal((await request('/api/suites/31', { method: 'DELETE' })).status, 200)
  assert.equal(db.prepare('SELECT id FROM test_runs_v2 WHERE id=41').get(), undefined)
  assert.equal(db.prepare('SELECT id FROM test_run_results WHERE id=51').get(), undefined)
  failure(await request('/api/suites/31', { method: 'DELETE' }), 404)
})

test('unrelated suite database failures stay 500 and roll back instead of becoming a retention conflict', async () => {
  const before = snapshot()
  db.exec("CREATE TRIGGER fail_suite_delete BEFORE DELETE ON suites BEGIN SELECT RAISE(ABORT,'synthetic unrelated failure'); END")
  try { failure(await request('/api/suites/31', { method: 'DELETE' }), 500) } finally { db.exec('DROP TRIGGER fail_suite_delete') }
  assert.deepEqual(snapshot(), before)
})

test('list filters, deterministic sorting and pagination support later-page reconciliation without writes', async () => {
  const bugs = []
  for (let i = 0; i < 42; i++) bugs.push(await create({ title: `Bug ${i}`, sourceResultId: i < 21 ? 50 : null, severity: i < 21 ? 'Major' : 'Critical' }))
  const before = snapshot()
  const first = await request('/api/bugs')
  assert.equal(first.status, 200)
  assert.equal(first.headers.get('cache-control'), 'no-store')
  assert.deepEqual([first.body.data.page, first.body.data.pageSize, first.body.data.total, first.body.data.totalPages], [1, 20, 42, 3])
  assert.deepEqual(first.body.data.items, bugs.slice(0, 20))
  const later = (await request('/api/bugs?sourceResultId=50&sort=id&order=desc&page=2')).body.data
  assert.equal(later.total, 21)
  assert.deepEqual(later.items, [bugs[0]])
  assert.deepEqual((await request(`/api/bugs/${later.items[0].id}`)).body.data, bugs[0])
  const filtered = (await request('/api/bugs?testCaseId=10&sourceResultId=50&severity=Major&status=open&search=BUG%201&sort=id&order=desc')).body.data
  assert.deepEqual(filtered.items.map((b) => b.id), [19,18,17,16,15,14,13,12,11,10,1].map((i) => bugs[i].id))
  assert.deepEqual((await request('/api/bugs?sort=severity')).body.data.items.map((b) => b.id), bugs.slice(21, 41).map((b) => b.id))
  assert.deepEqual((await request('/api/bugs?sort=severity&order=desc')).body.data.items.map((b) => b.id), bugs.slice(0, 20).map((b) => b.id))
  db.exec("UPDATE bugs SET updated_at = '2020-01-01T00:00:00.000Z'")
  assert.deepEqual((await request('/api/bugs?sort=updatedAt&order=desc')).body.data.items.map((b) => b.id), bugs.slice(0, 20).map((b) => b.id))
  for (const query of ['page=4', `page=${Number.MAX_SAFE_INTEGER}`, 'sourceResultId=999', 'testCaseId=999', 'status=closed']) assert.deepEqual((await request(`/api/bugs?${query}`)).body.data.items, [])
  const after = snapshot(); before.bugs.forEach((b) => { b.updated_at = '2020-01-01T00:00:00.000Z' })
  assert.deepEqual(after, before)
})

test('search is literal, ASCII-case-insensitive and preserves the complete query string', async () => {
  const literal = await create({ title: 'Mix%_\\tail' })
  await create({ title: 'MixXXtail' })
  const accent = await create({ title: 'Écho' })
  const question = await create({ title: 'why?now' })
  for (const search of ['%_\\', 'mIX%']) assert.deepEqual((await request(`/api/bugs?search=${encodeURIComponent(search)}`)).body.data.items, [literal])
  assert.deepEqual((await request('/api/bugs?search=%C3%A9')).body.data.items, [])
  assert.deepEqual((await request('/api/bugs?search=%C3%89')).body.data.items, [accent])
  assert.deepEqual((await request('/api/bugs?search=why?now')).body.data.items, [question])
  assert.equal((await request('/api/bugs?search=%20%20')).body.data.total, 4)
})

test('all severity ranks and timestamp sort directions use ascending IDs for ties', async () => {
  const bugs = []
  for (const severity of ['Trivial', 'Minor', 'Major', 'Critical', 'Major']) bugs.push(await create({ severity }))
  const ids = (indices) => indices.map((i) => bugs[i].id)
  const listed = async (query) => (await request(`/api/bugs?${query}`)).body.data.items.map((bug) => bug.id)
  assert.deepEqual(await listed('sort=severity'), ids([3, 2, 4, 1, 0]))
  assert.deepEqual(await listed('sort=severity&order=desc'), ids([0, 1, 2, 4, 3]))
  db.exec("UPDATE bugs SET updated_at = '2020-01-01T00:00:00.000Z'")
  db.prepare("UPDATE bugs SET updated_at = '2020-02-01T00:00:00.000Z' WHERE id IN (?, ?)").run(bugs[1].id, bugs[3].id)
  assert.deepEqual(await listed('sort=updatedAt'), ids([0, 2, 4, 1, 3]))
  assert.deepEqual(await listed('sort=updatedAt&order=desc'), ids([1, 3, 0, 2, 4]))
})

test('invalid, repeated and unknown list parameters reject instead of being ignored', async () => {
  for (const query of ['page=0','page=-1','page=1.5','page=1e2','page=','page=9007199254740992','status=all','severity=major','sort=title','order=DESC','testCaseId=0','sourceResultId=1x','other=x','page=1&page=1','search=a&search=b','status[]=open','__proto__=x',`search=${'a'.repeat(201)}`]) {
    failure(await request(`/api/bugs?${query}`), 400)
  }
  const empty = (await request('/api/bugs')).body.data
  assert.deepEqual(empty, { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 })
})
