import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chromium } from '/private/tmp/bk-h2-browser-tools/node_modules/playwright-core/index.mjs'
import Database from 'better-sqlite3'

const base = process.env.BASE_URL
const dbPath = process.env.DATABASE_PATH
const captureDir = 'docs/evidence/local/2026-11-26/bk-h2-checkpoint/screenshots'
fs.mkdirSync(captureDir, { recursive: true })
const db = new Database(dbPath, { readonly: true })
const countBugs = () => db.prepare('SELECT count(*) AS count FROM bugs').get().count
const event = { testedSha: process.env.TESTED_SHA, base, dbPath, posts: 0, puts: 0, postStatuses: [], page2Reads: 0, consoleErrors: [], pageErrors: [] }
let holdNextPost = false
let releaseHeldPost
let loseNextPostResponse = false
let abortNextPostBeforeServer = false
let failNextReconcileRead = false
let loseNextPutResponse = false
let failNextDetailRead = false

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 })
  page.on('console', (message) => { if (message.type() === 'error') event.consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => event.pageErrors.push(error.message))
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (request.method() === 'POST' && url.pathname === '/api/bugs') event.posts++
    if (request.method() === 'PUT' && /^\/api\/bugs\/\d+$/.test(url.pathname)) event.puts++
    if (request.method() === 'GET' && url.pathname === '/api/bugs' && url.searchParams.get('page') === '2') event.page2Reads++
  })
  await page.route('**/api/bugs**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'POST' && url.pathname === '/api/bugs') {
      if (holdNextPost) {
        holdNextPost = false
        await new Promise((resolve) => { releaseHeldPost = resolve })
        const response = await route.fetch()
        event.postStatuses.push(response.status())
        await route.fulfill({ response })
        return
      }
      if (loseNextPostResponse) {
        loseNextPostResponse = false
        const response = await route.fetch()
        event.postStatuses.push(response.status())
        await response.dispose()
        await route.abort('failed')
        return
      }
      if (abortNextPostBeforeServer) {
        abortNextPostBeforeServer = false
        await route.abort('failed')
        return
      }
    }
    if (request.method() === 'GET' && url.pathname === '/api/bugs' && failNextReconcileRead && url.searchParams.has('sourceResultId')) {
      failNextReconcileRead = false
      await route.abort('failed')
      return
    }
    if (request.method() === 'GET' && /^\/api\/bugs\/\d+$/.test(url.pathname) && failNextDetailRead) {
      failNextDetailRead = false
      await route.abort('failed')
      return
    }
    if (request.method() === 'PUT' && /^\/api\/bugs\/\d+$/.test(url.pathname) && loseNextPutResponse) {
      loseNextPutResponse = false
      const response = await route.fetch()
      event.putStatus = response.status()
      await response.dispose()
      await route.abort('failed')
      return
    }
    await route.continue()
  })

  const api = async (path, init = {}) => {
    const response = await fetch(`${base}${path}`, { cache: 'no-store', ...init })
    const body = await response.json()
    return { status: response.status, body }
  }
  const updateResult = async (resultId, result, notes) => {
    const r = await api(`/api/test-runs/1/results/${resultId}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ result, durationMs: 1200, notes }),
    })
    assert.equal(r.status, 200)
    return r.body.data
  }
  const fillCreateForm = async (title) => {
    await page.locator('#bug-title').fill(title)
    await page.locator('#bug-steps').fill('Open the synthetic reset form; submit the provided test value.')
    await page.locator('#bug-expected').fill('A clear validation message is shown.')
    await page.locator('#bug-actual').fill('The form continues without validation.')
    await page.locator('#bug-severity').selectOption('Major')
  }
  const health = await api('/api/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.data.status, 'ok')
  const initialRun = await api('/api/test-runs/1')
  assert.equal(initialRun.status, 200)
  assert.equal(initialRun.body.data.results.find((r) => r.id === 2).result, 'failed')
  event.initialRun = initialRun.body.data
  event.initialBugCount = countBugs()

  // Bounded keyboard check on an empty real form: Enter focuses the first invalid field.
  await page.goto(`${base}/test-runs/1?resultId=2`)
  await page.getByRole('link', { name: 'Create Bug', exact: true }).waitFor()
  assert.equal(event.posts, 0)
  await page.getByRole('link', { name: 'Create Bug', exact: true }).click()
  await page.locator('#bug-title').waitFor()
  await page.locator('form button[type="submit"]').focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.activeElement?.id === 'bug-title')
  const title = page.locator('#bug-title')
  const errorId = await title.getAttribute('aria-describedby')
  event.keyboard = {
    enterFocused: await page.evaluate(() => document.activeElement.id),
    ariaInvalid: await title.getAttribute('aria-invalid'),
    ariaDescribedBy: errorId,
    errorText: await page.locator(`#${errorId}`).innerText(),
    nextTab: null,
  }
  assert.equal(event.keyboard.enterFocused, 'bug-title')
  assert.equal(event.keyboard.ariaInvalid, 'true')
  assert.equal(event.posts, 0)
  await page.screenshot({ path: `${captureDir}/keyboard-validation.png`, fullPage: true })
  await page.keyboard.press('Tab')
  event.keyboard.nextTab = await page.evaluate(() => document.activeElement.id)
  assert.equal(event.keyboard.nextTab, 'bug-steps')
  await fillCreateForm('BK H2 integrated saved defect 😀')

  // Hold the real POST response; click plus Enter while pending must still produce one POST.
  holdNextPost = true
  const heldPromise = page.getByRole('button', { name: 'Create Bug', exact: true }).click({ noWaitAfter: true })
  await page.waitForFunction(() => document.querySelector('form button[type="submit"]')?.disabled)
  await page.locator('#bug-title').focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  event.pendingPostCount = event.posts
  event.pendingSubmitDisabled = await page.locator('form button[type="submit"]').isDisabled()
  assert.equal(event.pendingPostCount, 1)
  assert.equal(event.pendingSubmitDisabled, true)
  releaseHeldPost()
  await heldPromise
  await page.getByText('Bug report created successfully.', { exact: true }).waitFor()
  await page.getByRole('heading', { name: /Bug #/ }).waitFor()
  event.createdBug = (await api(`/api/bugs/${new URL(page.url()).pathname.split('/').pop()}`)).body.data
  assert.equal(event.createdBug.sourceResultId, 2)
  assert.equal(event.createdBug.sourceRunId, 1)
  assert.equal(event.createdBug.testCaseId, 2)
  assert.equal(event.createdBug.status, 'open')
  event.countAfterCreate = countBugs()
  assert.equal(event.countAfterCreate, event.initialBugCount + 1)
  await page.screenshot({ path: `${captureDir}/saved-created.png`, fullPage: true })

  // Successful edit/status transition; source identity must remain immutable.
  await page.locator('#bug-title').fill('BK H2 integrated saved defect — edited')
  await page.getByLabel('Status', { exact: true }).selectOption('in-progress')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page.getByText('Bug changes saved successfully.', { exact: true }).waitFor()
  event.updatedBug = (await api(`/api/bugs/${event.createdBug.id}`)).body.data
  assert.equal(event.updatedBug.title, 'BK H2 integrated saved defect — edited')
  assert.equal(event.updatedBug.status, 'in-progress')
  assert.equal(event.updatedBug.sourceResultId, event.createdBug.sourceResultId)
  assert.equal(event.updatedBug.sourceRunId, event.createdBug.sourceRunId)
  assert.equal(event.updatedBug.testCaseId, event.createdBug.testCaseId)
  event.runAfterBugUpdate = (await api('/api/test-runs/1')).body.data
  assert.deepEqual(event.runAfterBugUpdate.results.map((r) => [r.id, r.result]), event.initialRun.results.map((r) => [r.id, r.result]))
  assert.equal(event.runAfterBugUpdate.passCount, event.initialRun.passCount)
  assert.equal(event.runAfterBugUpdate.failCount, event.initialRun.failCount)
  await page.screenshot({ path: `${captureDir}/saved-updated.png`, fullPage: true })

  // Later source outcome changes must remain distinct from the retained Bug origin.
  await updateResult(2, 'passed', 'BK verification changed the current source outcome.')
  await page.reload()
  await page.getByText(/Current source outcome: passed/).waitFor()
  event.bugAfterSourceEdit = (await api(`/api/bugs/${event.createdBug.id}`)).body.data
  assert.equal(event.bugAfterSourceEdit.sourceResultId, 2)
  await updateResult(2, 'failed', 'BK verification restored the synthetic failed source.')

  // Source becomes nonfailed after form load: API 409, draft retained, no DB insertion.
  await page.goto(`${base}/test-runs/1?resultId=2`)
  await page.getByRole('link', { name: 'Create Bug', exact: true }).click()
  await fillCreateForm('BK H2 rejected stale source')
  const countBeforeRejected = countBugs()
  await updateResult(2, 'passed', 'Source changed before submit to exercise a definite rejection.')
  await page.getByRole('button', { name: 'Create Bug', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: /failed/i }).waitFor()
  event.rejectedDraftTitle = await page.locator('#bug-title').inputValue()
  event.countAfterRejected = countBugs()
  event.rejectedPosts = event.posts
  assert.equal(event.rejectedDraftTitle, 'BK H2 rejected stale source')
  assert.equal(event.countAfterRejected, countBeforeRejected)
  await page.screenshot({ path: `${captureDir}/rejected-source.png`, fullPage: true })
  await updateResult(2, 'failed', 'Synthetic source restored after rejection check.')

  // Commit POST then drop the browser response; inspect state, fail one GET, then reconcile.
  await page.goto(`${base}/test-runs/1?resultId=2`)
  await page.getByRole('link', { name: 'Create Bug', exact: true }).click()
  await fillCreateForm('BK H2 committed POST response lost')
  const beforeLostPost = countBugs()
  loseNextPostResponse = true
  await page.getByRole('button', { name: 'Create Bug', exact: true }).click({ noWaitAfter: true })
  await page.getByRole('alert').filter({ hasText: /may have been saved/i }).waitFor()
  assert.equal(countBugs(), beforeLostPost + 1)
  const lostPostRow = db.prepare('SELECT id, title, status, test_case_id, source_result_id FROM bugs WHERE title = ?').get('BK H2 committed POST response lost')
  assert.ok(lostPostRow)
  event.lostPost = { ...lostPostRow, realHttpStatusBeforeAbort: event.postStatuses.at(-1) }
  event.postCountAfterLostResponse = event.posts
  assert.equal(event.postCountAfterLostResponse, 3)
  assert.equal(await page.getByRole('button', { name: 'Create Bug', exact: true }).isDisabled(), true)

  // Add synthetic rows after the lost Bug so it is discoverable on reconciliation page 2.
  for (let i = 1; i <= 20; i++) {
    const response = await api('/api/bugs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `BK H2 page filler ${String(i).padStart(2,'0')}`, description: 'Steps: Synthetic filler\nExpected: Existing row\nActual: Existing row', severity: 'Trivial', sourceResultId: 2 }) })
    assert.equal(response.status, 201)
  }
  failNextReconcileRead = true
  await page.getByRole('button', { name: 'Check existing bugs', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: /Read failed/i }).waitFor()
  assert.equal(await page.getByRole('button', { name: /submit again despite/i }).count(), 0)
  assert.equal(event.posts, event.postCountAfterLostResponse)
  await page.screenshot({ path: `${captureDir}/uncertain-post.png`, fullPage: true })
  await page.getByRole('button', { name: 'Check existing bugs', exact: true }).click()
  const lostCandidate = page.getByRole('link', { name: `#${event.lostPost.id} BK H2 committed POST response lost`, exact: true })
  await lostCandidate.waitFor()
  assert.ok(event.page2Reads >= 2)
  event.reconciliationPage2ReadCount = event.page2Reads
  event.postsAfterReconciliation = event.posts
  await page.screenshot({ path: `${captureDir}/reconciled-page-two.png`, fullPage: true })
  await lostCandidate.click()
  await page.getByRole('button', { name: /I identify this as my saved bug/ }).click()
  assert.equal(event.posts, event.postsAfterReconciliation)

  // Real PUT commit with lost response; failed read keeps Save blocked; adopt fresh server version.
  const bugId = event.createdBug.id
  await page.goto(`${base}/bugs/${bugId}`)
  await page.getByLabel('Title (required)', { exact: true }).waitFor()
  await page.locator('#bug-title').fill('BK H2 update committed before lost response')
  await page.getByLabel('Status', { exact: true }).selectOption('resolved')
  const putBefore = event.puts
  loseNextPutResponse = true
  await page.getByRole('button', { name: 'Save changes', exact: true }).click({ noWaitAfter: true })
  await page.getByRole('alert').filter({ hasText: /update may have been saved/i }).waitFor()
  const committedPut = (await api(`/api/bugs/${bugId}`)).body.data
  assert.equal(committedPut.title, 'BK H2 update committed before lost response')
  assert.equal(committedPut.status, 'resolved')
  await page.locator('#bug-title').fill('BK H2 local draft after the commit')
  failNextDetailRead = true
  await page.getByRole('button', { name: 'Refresh saved details (keep draft)' }).click()
  await page.getByRole('alert').filter({ hasText: /Read failed/i }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Save changes', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'Refresh saved details (keep draft)' }).click()
  await page.getByRole('button', { name: 'Use refreshed saved version' }).waitFor()
  assert.equal(await page.getByRole('heading', { name: 'BK H2 update committed before lost response' }).count(), 1)
  assert.equal(await page.locator('#bug-title').inputValue(), 'BK H2 local draft after the commit')
  assert.equal(await page.getByRole('button', { name: 'Save changes', exact: true }).isDisabled(), true)
  await page.screenshot({ path: `${captureDir}/uncertain-put-recovery.png`, fullPage: true })
  const putsBeforeAdoption = event.puts
  await page.getByRole('button', { name: 'Use refreshed saved version', exact: true }).click()
  assert.equal(await page.locator('#bug-title').inputValue(), 'BK H2 update committed before lost response')
  assert.equal(event.puts, putsBeforeAdoption)
  event.putRecovery = { committedTitle: committedPut.title, committedStatus: committedPut.status, draftPreservedUntilChoice: true, failedReadStayedBlocked: true, adoptedSavedVersion: true, putRequestsForThisFlow: event.puts - putBefore }

  // No-match outcome: abort before server, reconcile twice with no Bug for source 3, explicit resubmit only.
  await updateResult(3, 'failed', 'Synthetic failed source for no-match retry check.')
  await page.goto(`${base}/test-runs/1?resultId=3`)
  await page.locator('a[href="/bugs/new/1/3"]').waitFor()
  await page.locator('a[href="/bugs/new/1/3"]').click()
  await fillCreateForm('BK H2 explicit no-match resubmission')
  event.postsBeforeNoMatch = event.posts
  event.countBeforeNoMatch = countBugs()
  abortNextPostBeforeServer = true
  await page.getByRole('button', { name: 'Create Bug', exact: true }).click({ noWaitAfter: true })
  await page.getByRole('alert').filter({ hasText: /may have been saved/i }).waitFor()
  assert.equal(countBugs(), event.countBeforeNoMatch)
  await page.getByRole('button', { name: 'Check existing bugs', exact: true }).click()
  await page.getByText('No existing bugs found.', { exact: true }).waitFor()
  assert.equal(event.posts, event.postsBeforeNoMatch + 1)
  await page.screenshot({ path: `${captureDir}/no-match-explicit-gate.png`, fullPage: true })
  await page.getByRole('button', { name: /submit again despite duplicate risk/i }).click()
  await page.getByText('Bug report created successfully.', { exact: true }).waitFor()
  event.noMatchResubmitted = (await api(`/api/bugs?sourceResultId=3&sort=id&order=desc&page=1`)).body.data.items[0]
  assert.equal(event.noMatchResubmitted.title, 'BK H2 explicit no-match resubmission')
  assert.equal(event.posts, event.postsBeforeNoMatch + 2)
  assert.equal(countBugs(), event.countBeforeNoMatch + 1)

  event.finalBrowserPosts = event.posts
  event.finalBugCountBeforeShutdown = countBugs()
  event.finalSourceState = (await api('/api/test-runs/1')).body.data.results.map((r) => ({ id: r.id, result: r.result, notes: r.notes }))
  event.expectedSummary = {
    pendingClickAndEnter: 'one POST, disabled submit while request pending',
    success: '201 persisted with derived result/case/run identity; complete PUT status update persisted',
    rejection: '409 after source outcome changed, retained draft, no insert',
    lostPost: 'server committed 201 then browser response was dropped; no automatic POST; failed GET kept uncertainty; page-2 fresh reconciliation found saved Bug',
    lostPut: 'server committed update then browser response was dropped; failed GET kept Save blocked; explicit adoption sent no extra PUT',
    noMatch: 'first POST aborted before server; fresh checks found no row; no retry until explicit duplicate-risk action; exactly one follow-up row',
  }
  assert.deepEqual(event.pageErrors, [])
  event.expectedConsoleErrors = event.consoleErrors.filter((message) => /status of 409 \(Conflict\)|net::ERR_FAILED/.test(message))
  event.unexpectedConsoleErrors = event.consoleErrors.filter((message) => !/status of 409 \(Conflict\)|net::ERR_FAILED/.test(message))
  assert.deepEqual(event.unexpectedConsoleErrors, [])
  console.log(JSON.stringify(event, null, 2))
} finally {
  db.close()
  await browser.close()
}
