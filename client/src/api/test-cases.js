const BASE_URL = '/api/test-cases'

async function request(url, options) {
  const res = await fetch(url, options)
  const body = await res.json()
  if (!body.success) {
    throw new Error(body.error || 'Request failed')
  }
  return body.data
}

// Shared by listTestCases and getExportTestCasesUrl, so the CSV export
// always reflects exactly the same search/status/sort the list is
// currently showing.
function buildTestCaseQuery({ status, search, sort, order, page } = {}) {
  const params = new URLSearchParams()
  if (status && status !== 'all') params.set('status', status)
  if (search) params.set('search', search)
  if (sort) params.set('sort', sort)
  if (order) params.set('order', order)
  if (page) params.set('page', String(page))
  return params.toString()
}

export function listTestCases(filters = {}) {
  const query = buildTestCaseQuery(filters)
  return request(`${BASE_URL}${query ? `?${query}` : ''}`)
}

export function getTestCase(id) {
  return request(`${BASE_URL}/${id}`)
}

export function getSuitesForTestCase(id) {
  return request(`${BASE_URL}/${id}/suites`)
}

export function createTestCase(payload) {
  return request(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function updateTestCase(id, payload) {
  return request(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteTestCase(id) {
  return request(`${BASE_URL}/${id}`, { method: 'DELETE' })
}

// `commit: false` (or omitted) is a dry-run preview — nothing is saved.
// `commit: true` re-validates and actually creates the valid, non-duplicate
// rows. Same request/response shape either way (see server/routes/test-cases.js).
export function importTestCases(csv, { commit = false } = {}) {
  return request(`${BASE_URL}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv, commit }),
  })
}

// The export endpoint returns a CSV file directly (not JSON), and sets its
// own Content-Disposition/filename — so this is a plain URL for an
// <a download> link, not a request() call, same as
export function getExportTestCasesUrl(filters = {}) {
  const query = buildTestCaseQuery(filters)
  return `${BASE_URL}/export${query ? `?${query}` : ''}`
}
