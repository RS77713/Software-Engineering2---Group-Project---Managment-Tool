const BASE_URL = '/api/test-runs'

async function request(url, options) {
  const res = await fetch(url, options)
  const body = await res.json()
  if (!body.success) {
    const error = new Error(body.error || 'Request failed')
    error.status = res.status
    throw error
  }
  return body.data
}

export function listTestRuns() {
  return request(BASE_URL)
}

export function getTestRun(id) {
  return request(`${BASE_URL}/${id}`)
}

export function createTestRun({ suiteId, createdBy }) {
  return request(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suiteId, createdBy }),
  })
}

export function updateTestRunResult(runId, resultId, payload) {
  return request(`${BASE_URL}/${runId}/results/${resultId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
