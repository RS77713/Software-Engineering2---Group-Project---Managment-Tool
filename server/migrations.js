import fs from 'node:fs'

const bugsMigration = fs.readFileSync(new URL('./migrations/001-bugs.sql', import.meta.url), 'utf8')

export function assertSupportedSchemaVersion(db) {
  const version = db.pragma('user_version', { simple: true })
  if (version !== 0 && version !== 1) {
    throw new Error(`unsupported database schema version: ${version}`)
  }
  return version
}

export function migrate(db) {
  db.transaction(() => {
    const version = assertSupportedSchemaVersion(db)
    if (version === 1) return
    db.exec(bugsMigration)
    db.pragma('user_version = 1')
  }).immediate()
}
