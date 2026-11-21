import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const portText = process.env.PORT ?? '3001'
const port = Number(portText)
if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port > 65535) {
  throw new Error('PORT must be an integer from 0 to 65535')
}

// Choose a new database before importing the application, which opens/seeds it.
// TEST_DB_PATH otherwise takes precedence over DB_PATH in server/db.js.
const dataDirectory = mkdtempSync(path.join(os.tmpdir(), 'qa-baseline-isolated-'))
const databasePath = path.join(dataDirectory, 'synthetic.sqlite')
delete process.env.TEST_DB_PATH
process.env.DB_PATH = databasePath

const { default: app } = await import('../server/app.js')
const { db } = await import('../server/db.js')
const server = app.listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify({
    event: 'isolated-startup',
    address: server.address(),
    dataDirectory,
    databasePath,
  }))
})
server.on('error', (error) => {
  console.error(error)
  db.close()
  process.exitCode = 1
})

let stopping = false
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) return
    stopping = true
    server.close(() => {
      db.close()
      process.exit(0)
    })
  })
}
