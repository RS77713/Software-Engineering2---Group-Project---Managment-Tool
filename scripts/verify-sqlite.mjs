import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import Database from 'better-sqlite3'

const require = createRequire(import.meta.url)
const db = new Database(':memory:')
try {
  db.exec('CREATE TABLE setup_probe (value TEXT NOT NULL)')
  db.prepare('INSERT INTO setup_probe (value) VALUES (?)').run('ready')
  assert.equal(db.prepare('SELECT value FROM setup_probe').get().value, 'ready')
  const nativeBinding = Object.keys(require.cache).find(
    (file) => file.includes('better-sqlite3') && file.endsWith('.node'),
  )
  assert.ok(nativeBinding, 'SQLite native binding was not loaded')
  console.log(JSON.stringify({
    node: process.version,
    sqlite: db.prepare('SELECT sqlite_version() AS version').get().version,
    binding: path.relative(process.cwd(), nativeBinding).replaceAll('\\', '/'),
    writeRead: 'passed',
  }))
} finally {
  db.close()
}
