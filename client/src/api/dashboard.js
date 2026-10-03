const BASE_URL = '/api/dashboard'

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

export function getDashboardMetrics() {
  return request(`${BASE_URL}/metrics`)
}

export function getDashboardTrends() {
  return request(`${BASE_URL}/trends`)
}
