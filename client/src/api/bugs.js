const severities = ['Critical', 'Major', 'Minor', 'Trivial']
export { severities }
export const transitions = { open: ['in-progress'], 'in-progress': ['open', 'resolved'], resolved: ['in-progress', 'closed'], closed: ['open'] }
const positive = (n) => Number.isSafeInteger(n) && n > 0
export function isBug(b) {
  return b && positive(b.id) && typeof b.title === 'string' && b.title.trim().length > 0 && [...b.title].length <= 200 &&
    typeof b.description === 'string' && b.description.trim().length > 0 && [...b.description].length <= 5000 &&
    severities.includes(b.severity) && Object.hasOwn(transitions, b.status) &&
    (b.testCaseId === null || positive(b.testCaseId)) &&
    (b.sourceResultId === null ? b.sourceRunId === null : positive(b.sourceResultId) && positive(b.sourceRunId) && positive(b.testCaseId)) &&
    typeof b.createdAt === 'string' && Number.isFinite(Date.parse(b.createdAt)) &&
    typeof b.updatedAt === 'string' && Number.isFinite(Date.parse(b.updatedAt))
}
async function request(path, method = 'GET', payload) {
  try {
    const response = await fetch(`/api/bugs${path}`, {
      method, cache: 'no-store', signal: AbortSignal.timeout(15000),
      ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
    })
    const body = await response.json()
    if ([400, 404, 409, 413, 415].includes(response.status) && body.success === false && body.data === null && typeof body.error === 'string' && body.error.trim()) {
      throw Object.assign(new Error(body.error), { rejected: true, status: response.status })
    }
    const data = body.data
    const valid = path === '' || path.startsWith('?')
      ? method === 'POST' ? isBug(data) : data && Array.isArray(data.items) && data.items.every(isBug) &&
        positive(data.page) && data.pageSize === 20 && Number.isSafeInteger(data.total) && data.total >= 0 && data.totalPages === Math.max(1, Math.ceil(data.total / 20))
      : isBug(data)
    if (response.status !== (method === 'POST' ? 201 : 200) || body.success !== true || body.error !== null || !valid) throw new Error('Invalid Bug API response.')
    return data
  } catch (error) {
    if (!error.rejected && method !== 'GET') error.uncertain = true
    throw error
  }
}
export const listBugs = (params = {}) => request(`?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))}`)
export async function getBug(id) {
  const bug = await request(`/${id}`)
  if (bug.id !== Number(id)) throw new Error('Bug API returned a different resource.')
  return bug
}
export const createBug = (payload) => request('', 'POST', payload)
export const updateBug = (id, payload) => request(`/${id}`, 'PUT', payload)

// Two complete fresh passes, including detail reads, make a first-page or stale
// cached list insufficient to unlock explicit resubmission. Nothing retries POST.
export async function reconcileBugs(attempt) {
  let candidates
  for (let pass = 0; pass < 2; pass++) {
    candidates = []
    let pages = 1
    for (let page = 1; page <= pages; page++) {
      const data = await listBugs({ sourceResultId: attempt.payload.sourceResultId, sort: 'id', order: 'desc', page })
      if (data.page !== page) throw new Error('Unexpected reconciliation page.')
      pages = Math.max(pages, data.totalPages)
      for (const item of data.items) {
        const bug = await getBug(item.id)
        const p = attempt.payload
        const matches = bug.title === p.title.trim() && bug.description === p.description.trim() && bug.severity === p.severity &&
          (bug.sourceResultId ?? null) === (p.sourceResultId ?? null) &&
          bug.testCaseId === (attempt.source?.testCaseId ?? p.testCaseId ?? null) &&
          bug.sourceRunId === (attempt.source?.runId ?? null)
        candidates.push({ bug, matches })
      }
    }
  }
  return candidates.filter((c, i, all) => all.findIndex((other) => other.bug.id === c.bug.id) === i)
}
