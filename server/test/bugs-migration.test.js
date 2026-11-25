import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import Database from 'better-sqlite3'
import { createBug, getBug } from '../bugs.js'

const baselineSchema = fs.readFileSync(new URL('./fixtures/h1-baseline.sql', import.meta.url), 'utf8')
const dbModule = new URL('../db.js', import.meta.url).href
const inheritedTables = ['test_cases', 'suites', 'suite_test_cases', 'test_runs_v2', 'test_run_results']
const rows = (db, table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()
const legacySnapshot = (db) => ({
  data: Object.fromEntries(inheritedTables.map((table) => [table, rows(db, table)])),
  sequences: db.prepare("SELECT * FROM sqlite_sequence WHERE name != 'bugs' ORDER BY name").all(),
  schema: db.prepare("SELECT * FROM sqlite_master WHERE type = 'table' AND name != 'bugs' ORDER BY name").all(),
})

function temporaryDatabase(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-bugs-migration-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  return path.join(directory, 'test.sqlite')
}

function baseline(file) {
  const db = new Database(file)
  db.pragma('foreign_keys = ON')
  db.exec(baselineSchema)
  db.exec(`
    INSERT INTO test_cases (id,title,preconditions,steps,expected_result,severity,status,created_at,updated_at)
      VALUES (101,'Earlier [Core]','setup','["first","second"]','expected','Major','failed','2020-01-01','2020-01-02'),
             (109,'Other [Core]',NULL,'["step"]','other','Minor','ready','2020-02-01','2020-02-02');
    INSERT INTO suites VALUES (203,'Earlier suite','Core','ready','2020-01-01','2020-01-02');
    INSERT INTO suite_test_cases VALUES (203,101,7),(203,109,9);
    INSERT INTO test_runs_v2 VALUES (307,203,'failed',1,1,0,'2020-01-01','2020-01-02','synthetic tester');
    INSERT INTO test_run_results VALUES (409,307,101,'failed',123,'retained notes'),(419,307,109,'passed',456,NULL);
    -- Preserve AUTOINCREMENT history, not only the currently largest row ID.
    INSERT INTO test_cases (id,title,steps,expected_result,severity,created_at,updated_at)
      VALUES (999,'Deleted [Core]','[]','unused','Trivial','2020-01-01','2020-01-01');
    DELETE FROM test_cases WHERE id=999;
  `)
  return db
}

function startup(file) {
  // Import the real initializer in a new process, before any seeding or HTTP.
  // TEST_DB_PATH always points to this test's own temporary file.
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    const { db } = await import(${JSON.stringify(dbModule)});
    console.log(JSON.stringify({ version: db.pragma('user_version', { simple: true }),
      foreignKeys: db.pragma('foreign_keys', { simple: true }) }));
    db.close();
  `], { env: { ...process.env, TEST_DB_PATH: file }, encoding: 'utf8', timeout: 10000 })
}

function successfulStartup(file) {
  const result = startup(file)
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), { version: 1, foreignKeys: 1 })
}

test('a consistent earlier-data copy upgrades without changing inherited rows, IDs, schema or sequences', (t) => {
  const original = temporaryDatabase(t)
  let db = baseline(original)
  const before = legacySnapshot(db)
  assert.equal(db.pragma('user_version', { simple: true }), 0)
  db.close()
  const copy = path.join(path.dirname(original), 'upgrade-copy.sqlite')
  fs.copyFileSync(original, copy)
  successfulStartup(copy)
  db = new Database(copy)
  db.pragma('foreign_keys = ON')
  try {
    assert.deepEqual(legacySnapshot(db), before)
    assert.deepEqual(rows(db, 'bugs'), [])
    assert.deepEqual(db.pragma('foreign_key_check'), [])
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='bugs' ORDER BY name").all(), [
      { name: 'idx_bugs_source_result_id' }, { name: 'idx_bugs_test_case_id' },
    ])
    const bug = createBug(db, { title: 'From earlier history', description: 'Steps\nExpected\nActual', severity: 'Major', sourceResultId: 409 })
    assert.deepEqual([bug.testCaseId, bug.sourceResultId, bug.sourceRunId], [101, 409, 307])
    const afterCreate = legacySnapshot(db)
    const bugRows = rows(db, 'bugs')
    db.close()
    successfulStartup(copy)
    db = new Database(copy)
    assert.deepEqual(legacySnapshot(db), afterCreate)
    assert.deepEqual(rows(db, 'bugs'), bugRows)
    assert.deepEqual(getBug(db, bug.id), bug)
    // A new inherited ID must also continue its earlier AUTOINCREMENT sequence.
    assert.equal(db.prepare(`INSERT INTO test_cases (title,steps,expected_result,severity,created_at,updated_at)
      VALUES ('Next [Core]','[]','expected','Minor','2020-01-01','2020-01-01')`).run().lastInsertRowid, 1000)
  } finally { if (db.open) db.close() }
  const unchangedOriginal = new Database(original, { readonly: true })
  try {
    assert.equal(unchangedOriginal.pragma('user_version', { simple: true }), 0)
    assert.deepEqual(legacySnapshot(unchangedOriginal), before)
  } finally { unchangedOriginal.close() }
})

test('a fresh database initializes all tables and the second startup is a no-op', (t) => {
  const file = temporaryDatabase(t)
  successfulStartup(file)
  let db = new Database(file)
  const schema = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name),
    ['bugs', 'sqlite_sequence', 'suite_test_cases', 'suites', 'test_cases', 'test_run_results', 'test_runs_v2'])
  db.close()
  successfulStartup(file)
  db = new Database(file)
  try {
    assert.deepEqual(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all(), schema)
    for (const table of [...inheritedTables, 'bugs']) assert.deepEqual(rows(db, table), [])
  } finally { db.close() }
})

test('a failed 0-to-1 migration rolls back DDL and version changes and stops startup', (t) => {
  const file = temporaryDatabase(t)
  let db = baseline(file)
  // Fail after CREATE TABLE and the first CREATE INDEX have already executed.
  db.exec('CREATE INDEX idx_bugs_source_result_id ON test_cases(title)')
  const before = legacySnapshot(db)
  const schema = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()
  db.close()
  const result = startup(file)
  assert.equal(result.error, undefined)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /idx_bugs_source_result_id already exists/)
  assert.equal(result.stdout, '')
  db = new Database(file)
  try {
    assert.equal(db.pragma('user_version', { simple: true }), 0)
    assert.deepEqual(legacySnapshot(db), before)
    assert.deepEqual(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all(), schema)
    // Removing only the injected collision allows the same data to upgrade.
    db.exec('DROP INDEX idx_bugs_source_result_id')
  } finally { db.close() }
  successfulStartup(file)
})

test('unsupported schema versions stop startup without creating or changing tables or data', (t) => {
  for (const version of [-1, 2, 2147483647]) {
    const file = temporaryDatabase(t)
    let db = new Database(file)
    db.exec("CREATE TABLE marker (value TEXT); INSERT INTO marker VALUES ('preserve me')")
    db.pragma(`user_version = ${version}`)
    const bytes = fs.readFileSync(file)
    db.close()
    const result = startup(file)
    assert.equal(result.error, undefined)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, new RegExp(`unsupported database schema version: ${version}`))
    assert.equal(result.stdout, '')
    assert.deepEqual(fs.readFileSync(file), bytes)
    db = new Database(file, { readonly: true })
    try {
      assert.equal(db.pragma('user_version', { simple: true }), version)
      assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all(), [{ name: 'marker' }])
      assert.deepEqual(rows(db, 'marker'), [{ value: 'preserve me' }])
    } finally { db.close() }
  }
})
