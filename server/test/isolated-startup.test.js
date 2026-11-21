import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const launcher = fileURLToPath(new URL('../../scripts/start-isolated.mjs', import.meta.url))

test('isolated startup binds loopback and uses fresh synthetic data despite inherited environment', async (t) => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-isolated-start-test-'))
  const sentinel = path.join(fixture, 'working-database.sqlite')
  await fs.writeFile(sentinel, 'do not open or modify')
  const child = spawn(process.execPath, [launcher], {
    env: {
      ...process.env,
      PORT: '0',
      HOST: '0.0.0.0',
      DB_PATH: sentinel,
      TEST_DB_PATH: sentinel,
      TMPDIR: fixture,
      TMP: fixture,
      TEMP: fixture,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const closed = once(child, 'close')
  let errors = ''
  child.stderr.on('data', (chunk) => { errors += chunk.toString() })
  const lines = createInterface({ input: child.stdout })
  t.after(async () => {
    lines.close()
    if (child.exitCode === null && child.signalCode === null) child.kill()
    await closed
    const resolvedFixture = path.resolve(fixture)
    assert.equal(path.dirname(resolvedFixture), path.resolve(os.tmpdir()))
    assert.match(path.basename(resolvedFixture), /^qa-isolated-start-test-/)
    await fs.rm(resolvedFixture, { recursive: true, force: true })
  })
  const startup = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${errors}`)), 20000)
    lines.on('line', (line) => {
      if (!line.startsWith('{')) return
      try {
        const record = JSON.parse(line)
        if (record.event === 'isolated-startup') {
          clearTimeout(timer)
          resolve(record)
        }
      } catch (error) {
        clearTimeout(timer)
        reject(error)
      }
    })
    closed.then(([code]) => {
      clearTimeout(timer)
      reject(new Error(`Exited before startup (${code}): ${errors}`))
    }, reject)
  })
  assert.equal(startup.address.address, '127.0.0.1')
  assert.equal(startup.address.family, 'IPv4')
  assert.ok(startup.address.port > 0)
  assert.equal(path.dirname(startup.dataDirectory), fixture)
  assert.notEqual(startup.databasePath, sentinel)
  const baseUrl = `http://127.0.0.1:${startup.address.port}`
  const health = await fetch(`${baseUrl}/api/health`)
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { success: true, data: { status: 'ok' }, error: null })
  const cases = await fetch(`${baseUrl}/api/test-cases`).then((response) => response.json())
  assert.equal(cases.data.items.length, 5)
  assert.ok((await fs.stat(startup.databasePath)).isFile())
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'do not open or modify')
  t.diagnostic(JSON.stringify({
    actualBoundAddress: startup.address,
    freshSyntheticDatabase: true,
    seededCases: cases.data.items.length,
    inheritedDatabasePreserved: true,
  }))
})

test('isolated startup rejects an out-of-range port before starting the application', () => {
  const result = spawnSync(process.execPath, [launcher], {
    env: { ...process.env, PORT: '65536' },
    encoding: 'utf8',
    timeout: 10000,
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /PORT must be an integer from 0 to 65535/)
})
