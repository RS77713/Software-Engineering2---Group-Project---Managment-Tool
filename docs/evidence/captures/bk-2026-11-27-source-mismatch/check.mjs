import assert from 'node:assert/strict'

const base = 'http://127.0.0.1:55591'
const health = await fetch(`${base}/api/health`)
const before = await fetch(`${base}/api/bugs`)
const beforeBody = await before.json()
const post = await fetch(`${base}/api/bugs`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    title: 'BK bounded mismatch check',
    description: 'Synthetic validation check',
    severity: 'Major',
    sourceResultId: 2,
    testCaseId: null,
  }),
})
const postBody = await post.json()
const after = await fetch(`${base}/api/bugs`)
const afterBody = await after.json()
const result = {
  date: '2026-11-27',
  testedSha: '2b76cd99d4244d98023bcdd3b93ab17d2e3bdd15',
  command: 'node docs/evidence/local/2026-11-27/bounded-check/check.mjs',
  base,
  health: { status: health.status, body: await health.json() },
  before: { status: before.status, body: beforeBody },
  post: { status: post.status, body: postBody },
  after: { status: after.status, body: afterBody },
}
console.log(JSON.stringify(result, null, 2))
assert.equal(health.status, 200)
assert.equal(before.status, 200)
assert.equal(post.status, 400)
assert.equal(after.status, 200)
assert.equal(beforeBody.data.total, 0)
assert.equal(afterBody.data.total, 0)
