import { afterEach, describe, expect, test, vi } from 'vitest'
import { createBug, getBug, reconcileBugs, updateBug } from './bugs.js'
const bug = { id: 17, title: 'Defect', description: 'Details', severity: 'Major', status: 'open', testCaseId: 3, sourceResultId: 42, sourceRunId: 7, createdAt: '2026-11-25T18:00:00Z', updatedAt: '2026-11-25T18:00:00Z' }
const response = (status, data, error = null) => ({ status, json: async () => ({ success: error === null, data, error }) })
afterEach(() => vi.unstubAllGlobals())
describe('Bug transport contract', () => {
  test('accepts only complete 201 creation and never retries uncertain responses', async () => {
    const fetch = vi.fn().mockResolvedValue(response(201, bug))
    vi.stubGlobal('fetch', fetch)
    await expect(createBug({ title: 'Defect' })).resolves.toEqual(bug)
    fetch.mockResolvedValue(response(200, bug))
    await expect(createBug({})).rejects.toMatchObject({ uncertain: true })
    fetch.mockResolvedValue(response(201, { id: 17 }))
    await expect(createBug({})).rejects.toMatchObject({ uncertain: true })
    fetch.mockRejectedValue(new TypeError('lost response'))
    await expect(createBug({})).rejects.toMatchObject({ uncertain: true })
    expect(fetch).toHaveBeenCalledTimes(4)
  })
  test.each([400, 404, 409, 413, 415])('classifies valid %s rejection without retry', async (status) => {
    const fetch = vi.fn().mockResolvedValue(response(status, null, 'Actual server message'))
    vi.stubGlobal('fetch', fetch)
    await expect(createBug({})).rejects.toMatchObject({ rejected: true, status, message: 'Actual server message' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  test.each([500, 503])('keeps %s failure uncertain even with failure envelope', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(status, null, 'failure')))
    await expect(createBug({})).rejects.toMatchObject({ uncertain: true })
  })
  test('unreadable JSON and malformed failures remain uncertain; GET failure is read failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 201, json: async () => { throw new Error('unreadable') } }))
    await expect(createBug({})).rejects.toMatchObject({ uncertain: true })
    await expect(getBug(17)).rejects.not.toHaveProperty('uncertain')
  })
  test('sends documented PUT unchanged through a single request', async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, bug))
    vi.stubGlobal('fetch', fetch)
    const payload = { title: 'Defect', description: 'Details', severity: 'Major', status: 'open', testCaseId: 3 }
    await updateBug(17, payload)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(payload)
  })
  test('reads every page and candidate detail twice, detects multiple matches and mismatched links', async () => {
    const fetch = vi.fn(async (url) => {
      const parsed = new URL(url, 'http://local')
      if (parsed.search) {
        expect(parsed.searchParams.get('sourceResultId')).toBe('42')
        expect(parsed.searchParams.get('status')).toBe(null)
        const page = Number(parsed.searchParams.get('page'))
        return response(200, { items: [{ ...bug, id: page }], page, pageSize: 20, total: 21, totalPages: 2 })
      }
      return response(200, { ...bug, id: Number(parsed.pathname.split('/').pop()) })
    })
    vi.stubGlobal('fetch', fetch)
    const attempt = { payload: { title: ' Defect ', description: 'Details', severity: 'Major', sourceResultId: 42 }, source: { runId: 7, testCaseId: 3 } }
    const candidates = await reconcileBugs(attempt)
    expect(candidates.map((c) => c.matches)).toEqual([true, true])
    expect(fetch).toHaveBeenCalledTimes(8)
    expect(fetch.mock.calls.every(([, options]) => options.method === 'GET' && options.cache === 'no-store')).toBe(true)
    attempt.source.testCaseId = 4
    expect((await reconcileBugs(attempt)).every((c) => !c.matches)).toBe(true)
  })
  test('standalone empty checks are unfiltered and refreshed; failed reads do not complete', async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }))
    vi.stubGlobal('fetch', fetch)
    await expect(reconcileBugs({ payload: {} })).resolves.toEqual([])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][0]).toBe('/api/bugs?sort=id&order=desc&page=1')
    fetch.mockRejectedValue(new Error('offline'))
    await expect(reconcileBugs({ payload: {} })).rejects.toThrow('offline')
  })
})
