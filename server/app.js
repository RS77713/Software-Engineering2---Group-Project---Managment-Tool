import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import dashboardRouter from './routes/dashboard.js'
import suitesRouter from './routes/suites.js'
import testCasesRouter from './routes/test-cases.js'
import testRunsRouter from './routes/test-runs.js'
import { seedSuites } from './seed-suites.js'
import { seedTestCases } from './seed-test-cases.js'
import { seedTestRuns } from './seed-test-runs.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDistPath = path.join(__dirname, '../client/dist')

const app = express()

app.use(cors())
app.use('/api/test-cases/import', express.json({ limit: '2mb' }))
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, error: null })
})

app.use('/api/test-cases', testCasesRouter)
app.use('/api/suites', suitesRouter)
app.use('/api/test-runs', testRunsRouter)
app.use('/api/dashboard', dashboardRouter)

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'))
  })
}

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  if (status >= 500) console.error(err)
  const message = status === 500 ? 'internal server error' : err.message
  res.status(status).json({ success: false, data: null, error: message })
})

seedTestCases()
seedSuites()
seedTestRuns()

export default app
