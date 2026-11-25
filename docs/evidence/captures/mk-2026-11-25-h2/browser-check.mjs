const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || './node_modules/playwright-core/index.mjs')
import { writeFile, mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const evidence = process.argv[2]
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch({ executablePath: '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
const notes = { startedAt: new Date().toISOString(), browser: browser.version(), screenshots: [], consoleErrors: [] }
page.on('pageerror', (e) => notes.consoleErrors.push(e.message))
const api = async (path, method = 'GET', payload) => {
  const response = await fetch(`http://127.0.0.1:3001/api${path}`, { method, ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}) })
  const body = await response.json()
  assert.equal(body.success, true, JSON.stringify(body))
  return body.data
}
let posts = 0
page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/bugs')) posts++ })
const shot = async (name) => { await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true }); notes.screenshots.push(`${name}.png`) }
try {
  await page.goto('http://127.0.0.1:5173/test-runs/1?resultId=2')
  await page.getByRole('link', { name: 'Create Bug', exact: true }).click()
  await page.getByRole('button', { name: 'Create Bug', exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled)
  assert.equal(posts, 0)
  // A real Enter key on submit must focus the first invalid field and expose its error.
  await page.getByRole('button', { name: 'Create Bug', exact: true }).focus()
  await page.keyboard.press('Enter')
  notes.keyboard = await page.evaluate(() => {
    const el = document.activeElement
    return { action: 'Enter on empty Create Bug submit', focusedId: el.id, label: el.labels[0].textContent, invalid: el.getAttribute('aria-invalid'), errorId: el.getAttribute('aria-describedby'), errorText: document.getElementById(el.getAttribute('aria-describedby'))?.textContent, outline: getComputedStyle(el).outline }
  })
  assert.equal(notes.keyboard.focusedId, 'bug-title')
  assert.equal(notes.keyboard.invalid, 'true')
  assert.equal(notes.keyboard.errorText, 'Enter a title of 1–200 characters.')
  assert.match(notes.keyboard.outline, /2px/)
  notes.keyboard.tabOrder = []
  await page.keyboard.type('H2 real UI defect')
  for (const text of ['Open reset flow', 'Reset email arrives', 'No reset email']) {
    await page.keyboard.press('Tab')
    notes.keyboard.tabOrder.push(await page.evaluate(() => document.activeElement.id))
    await page.keyboard.type(text)
  }
  await page.keyboard.press('Tab')
  notes.keyboard.tabOrder.push(await page.evaluate(() => document.activeElement.id))
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown')
  assert.equal(await page.locator('#bug-severity').inputValue(), 'Major')
  await page.keyboard.press('Tab')
  notes.keyboard.tabOrder.push(await page.evaluate(() => document.activeElement.textContent))
  await page.keyboard.press('Enter')
  await page.getByText('Bug report created successfully.', { exact: true }).waitFor()
  await page.getByLabel('Title (required)', { exact: true }).waitFor()
  assert.equal(posts, 1)
  const savedId = Number(new URL(page.url()).pathname.split('/').pop())
  notes.created = await api(`/bugs/${savedId}`)
  assert.equal(notes.created.sourceResultId, 2)
  assert.equal(notes.created.testCaseId, 2)
  assert.equal(notes.created.sourceRunId, 1)
  // Complete PUT across each lifecycle edge through the actual UI.
  await page.getByLabel('Title (required)', { exact: true }).fill('H2 real UI defect — reviewed details')
  for (const status of ['in-progress', 'resolved', 'closed', 'open']) {
    await page.getByLabel('Status', { exact: true }).selectOption(status)
    const response = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/api/bugs/${savedId}`))
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    assert.equal((await response).status(), 200)
    await page.getByText(`Saved status: ${status}; severity: Major`, { exact: true }).waitFor()
  }
  notes.updated = await api(`/bugs/${savedId}`)
  assert.equal(notes.updated.sourceResultId, notes.created.sourceResultId)
  assert.equal(notes.updated.testCaseId, notes.created.testCaseId)
  await shot('saved-success')
  await api('/test-runs/1/results/2', 'PUT', { result: 'passed', notes: 'Current source changed after reporting' })
  await page.getByRole('button', { name: 'Refresh saved details (keep draft)' }).click()
  await page.getByText(/Current source outcome: passed/).waitFor()
  await page.getByRole('link', { name: 'Source result #2, run #1' }).click()
  await page.waitForFunction(() => document.activeElement.id === 'result-2')
  notes.sourceFocus = await page.evaluate(() => document.activeElement.id)
  const failedButton = page.locator('#result-2').getByRole('button', { name: 'Failed', exact: true })
  await failedButton.click()
  await page.getByRole('link', { name: 'Create Bug', exact: true }).waitFor()
  assert.equal(posts, 1)
  await page.getByRole('link', { name: 'Create Bug', exact: true }).click()
  for (const [id, value] of [['title', 'H2 committed response lost'], ['steps', 'Submit once'], ['expected', 'Saved response'], ['actual', 'Transport interrupted']]) await page.locator(`#bug-${id}`).fill(value)
  await page.locator('#bug-severity').selectOption('Minor')
  let lostId
  await page.route('**/api/bugs', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const response = await route.fetch()
    const body = await response.json()
    assert.equal(response.status(), 201)
    lostId = body.data.id
    await route.abort('failed') // Real transaction committed; only its browser response is lost.
  }, { times: 1 })
  await page.getByRole('button', { name: 'Create Bug', exact: true }).click()
  await page.getByText('The bug may have been saved. Check existing bugs before submitting again.', { exact: true }).waitFor()
  assert.equal(posts, 2)
  assert.equal(await page.getByRole('button', { name: 'Create Bug', exact: true }).isDisabled(), true)
  notes.lostResponseSaved = await api(`/bugs/${lostId}`)
  await shot('uncertain-after-real-commit')
  // Push the actual saved report beyond page 1 without modifying its source or payload.
  for (let i = 0; i < 21; i++) await api('/bugs', 'POST', { title: `Synthetic pagination fixture ${i}`, description: 'Different report for pagination', severity: 'Trivial', sourceResultId: 2 })
  await page.route('**/api/bugs?*', (route) => route.abort('failed'), { times: 1 })
  await page.getByRole('button', { name: 'Check existing bugs' }).click()
  await page.getByText(/Read failed:.*creation outcome remains unresolved/).waitFor()
  notes.failedReadObserved = true
  assert.equal(await page.getByRole('button', { name: /submit again despite/ }).count(), 0)
  const reads = []
  page.on('request', (r) => { if (r.method() === 'GET' && r.url().includes('/api/bugs')) reads.push(r.url()) })
  await page.getByRole('button', { name: 'Check existing bugs' }).click()
  const candidate = page.getByRole('link', { name: `#${lostId} H2 committed response lost`, exact: true })
  await candidate.waitFor()
  await page.getByText('Fresh list and detail checks completed and refreshed. Inspect candidates before deciding.', { exact: true }).waitFor()
  notes.reconciliationReads = reads
  assert.equal(reads.filter((url) => url.includes('page=2')).length, 2)
  assert.equal(posts, 2)
  await shot('reconciled-later-page')
  await candidate.click()
  await page.getByLabel('Title (required)', { exact: true }).waitFor()
  await page.getByRole('link', { name: 'Return to retained draft' }).click()
  assert.equal(await page.locator('#bug-title').inputValue(), 'H2 committed response lost')
  await page.getByRole('link', { name: `#${lostId} H2 committed response lost`, exact: true }).click()
  await page.getByRole('button', { name: /I identify this as my saved bug/ }).click()
  await page.getByText('Using the existing saved bug; no new report submitted.', { exact: true }).waitFor()
  assert.equal(posts, 2)
  // A request stopped before reaching the server is still uncertain to the UI.
  // Successful refreshed reads do not resend it: only the risk-aware button does.
  await page.goto('http://127.0.0.1:5173/bugs/new/1/2')
  await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled)
  for (const [id, value] of [['title', 'H2 no-match explicit resubmission'], ['steps', 'Submit once'], ['expected', 'Report saved'], ['actual', 'Connection failed']]) await page.locator(`#bug-${id}`).fill(value)
  await page.locator('#bug-severity').selectOption('Major')
  await page.route('**/api/bugs', (route) => route.abort('failed'), { times: 1 })
  await page.getByRole('button', { name: 'Create Bug', exact: true }).click()
  await page.getByText('The bug may have been saved. Check existing bugs before submitting again.', { exact: true }).waitFor()
  assert.equal(posts, 3)
  await page.getByRole('button', { name: 'Check existing bugs' }).click()
  await page.getByText('Fresh list and detail checks completed and refreshed. Inspect candidates before deciding.', { exact: true }).waitFor()
  assert.equal(await page.getByText(/Matches submitted fields and source;/).count(), 0)
  assert.equal(posts, 3)
  await page.getByRole('button', { name: /I found no saved bug — submit again despite duplicate risk/ }).click()
  await page.getByText('Bug report created successfully.', { exact: true }).waitFor()
  await page.getByLabel('Title (required)', { exact: true }).waitFor()
  assert.equal(posts, 4)
  notes.noMatchResubmission = await api(`/bugs/${new URL(page.url()).pathname.split('/').pop()}`)
  notes.postRequests = posts
  notes.finalCount = (await api('/bugs')).total
  notes.passed = true
} catch (e) {
  notes.passed = false; notes.failure = e.stack
  await shot('failure')
  process.exitCode = 1
} finally {
  notes.finishedAt = new Date().toISOString()
  await writeFile(`${evidence}/browser-results.json`, JSON.stringify(notes, null, 2))
  await browser.close()
  console.log(JSON.stringify(notes, null, 2))
}
