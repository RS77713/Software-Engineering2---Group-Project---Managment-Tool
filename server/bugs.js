export const SEVERITIES = ['Critical', 'Major', 'Minor', 'Trivial']
export const STATUSES = ['open', 'in-progress', 'resolved', 'closed']
const NEXT_STATUS = {
  open: ['in-progress'],
  'in-progress': ['open', 'resolved'],
  resolved: ['in-progress', 'closed'],
  closed: ['open'],
}
const PAGE_SIZE = 20
const SELECT_BUG = `SELECT b.*, r.run_id AS source_run_id FROM bugs b
  LEFT JOIN test_run_results r ON r.id = b.source_result_id`

export class BugError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function parseId(value, name = 'id') {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new BugError(400, `${name} must be a positive safe integer`)
  }
  return Number(value)
}

function optionalId(value, name) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new BugError(400, `${name} must be a positive safe integer or null`)
  }
  return value
}

function textField(value, name, limit) {
  if (typeof value !== 'string' || !value.trim()) throw new BugError(400, `${name} is required`)
  const text = value.trim()
  if ([...text].length > limit) throw new BugError(400, `${name} must contain at most ${limit} Unicode code points`)
  return text
}

function validateBody(body, update) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BugError(400, 'body must be a JSON object')
  const allowed = ['title', 'description', 'severity', 'testCaseId', update ? 'status' : 'sourceResultId']
  for (const field of Object.keys(body)) {
    if (!allowed.includes(field)) throw new BugError(400, `unknown or read-only field: ${field}`)
  }
  const title = textField(body.title, 'title', 200)
  const description = textField(body.description, 'description', 5000)
  if (!SEVERITIES.includes(body.severity)) throw new BugError(400, 'invalid severity')
  if (update && !STATUSES.includes(body.status)) throw new BugError(400, 'invalid or missing status')
  return {
    title, description, severity: body.severity, status: update ? body.status : 'open',
    testCaseId: optionalId(body.testCaseId, 'testCaseId'),
    ...(update ? {} : { sourceResultId: optionalId(body.sourceResultId, 'sourceResultId') }),
  }
}

function resource(row) {
  return {
    id: row.id, title: row.title, description: row.description, severity: row.severity,
    status: row.status, testCaseId: row.test_case_id, sourceResultId: row.source_result_id,
    sourceRunId: row.source_run_id, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function getBug(db, id) {
  const row = db.prepare(`${SELECT_BUG} WHERE b.id = ?`).get(id)
  if (!row) throw new BugError(404, 'bug not found')
  return resource(row)
}

function requireCase(db, id) {
  if (id !== null && !db.prepare('SELECT id FROM test_cases WHERE id = ?').get(id)) {
    throw new BugError(404, 'test case not found')
  }
}

export function createBug(db, body) {
  const value = validateBody(body, false)
  return db.transaction(() => {
    if (value.sourceResultId !== null) {
      const source = db.prepare('SELECT test_case_id, result FROM test_run_results WHERE id = ?').get(value.sourceResultId)
      if (!source) throw new BugError(404, 'source result not found')
      if (source.result !== 'failed') throw new BugError(409, 'source result must currently be failed')
      if (Object.hasOwn(body, 'testCaseId') && value.testCaseId !== source.test_case_id) {
        throw new BugError(400, 'testCaseId must match the source result')
      }
      value.testCaseId = source.test_case_id
    } else {
      requireCase(db, value.testCaseId)
    }
    const info = db.prepare(`INSERT INTO bugs
      (title, description, severity, status, test_case_id, source_result_id, created_at, updated_at)
      VALUES (@title, @description, @severity, @status, @testCaseId, @sourceResultId, @now, @now)`)
      .run({ ...value, now: new Date().toISOString() })
    if (!Number.isSafeInteger(info.lastInsertRowid)) throw new Error('bug ID exceeds the supported range')
    return getBug(db, info.lastInsertRowid)
  }).immediate()
}

export function updateBug(db, id, body) {
  const value = validateBody(body, true)
  return db.transaction(() => {
    const current = getBug(db, id)
    if (current.sourceResultId !== null) {
      if (value.testCaseId !== current.testCaseId) throw new BugError(409, 'cannot change or clear the source-derived testCaseId')
    } else {
      requireCase(db, value.testCaseId)
    }
    if (value.status !== current.status && !NEXT_STATUS[current.status].includes(value.status)) {
      throw new BugError(409, `cannot change bug status from ${current.status} to ${value.status}`)
    }
    db.prepare(`UPDATE bugs SET title = @title, description = @description, severity = @severity,
      status = @status, test_case_id = @testCaseId, updated_at = @now WHERE id = @id`)
      .run({ ...value, id, now: new Date().toISOString() })
    return getBug(db, id)
  }).immediate()
}

export function listBugs(db, searchParams) {
  const allowed = ['page', 'search', 'status', 'severity', 'testCaseId', 'sourceResultId', 'sort', 'order']
  const query = Object.create(null)
  for (const [key, value] of searchParams) {
    if (!allowed.includes(key) || Object.hasOwn(query, key)) throw new BugError(400, `unknown or repeated query parameter: ${key}`)
    query[key] = value
  }
  const page = query.page === undefined ? 1 : parseId(query.page, 'page')
  const sort = query.sort ?? 'id'
  const order = query.order ?? 'asc'
  if (!['id', 'severity', 'updatedAt'].includes(sort) || !['asc', 'desc'].includes(order)) throw new BugError(400, 'invalid sort or order')
  const where = []
  const params = {}
  for (const [field, values] of [['status', STATUSES], ['severity', SEVERITIES]]) {
    if (query[field] !== undefined) {
      if (!values.includes(query[field])) throw new BugError(400, `invalid ${field}`)
      where.push(`b.${field} = @${field}`)
      params[field] = query[field]
    }
  }
  for (const [field, column] of [['testCaseId', 'test_case_id'], ['sourceResultId', 'source_result_id']]) {
    if (query[field] !== undefined) {
      params[field] = parseId(query[field], field)
      where.push(`b.${column} = @${field}`)
    }
  }
  if (query.search !== undefined) {
    params.search = query.search.trim()
    if ([...params.search].length > 200) throw new BugError(400, 'search must contain at most 200 Unicode code points')
    // SQLite lower() folds ASCII only. instr() treats %, _ and backslash literally.
    where.push('instr(lower(b.title), lower(@search)) > 0')
  }
  const filter = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const column = {
    id: 'b.id', updatedAt: 'b.updated_at',
    severity: "CASE b.severity WHEN 'Critical' THEN 0 WHEN 'Major' THEN 1 WHEN 'Minor' THEN 2 ELSE 3 END",
  }[sort]
  return db.transaction(() => {
    const { total } = db.prepare(`SELECT count(*) AS total FROM bugs b ${filter}`).get(params)
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    // Avoid overflowing SQLite's integer OFFSET for a valid, very large page.
    const items = page > totalPages ? [] : db.prepare(`${SELECT_BUG} ${filter}
      ORDER BY ${column} ${order.toUpperCase()}, b.id ASC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }).map(resource)
    return { items, page, pageSize: PAGE_SIZE, total, totalPages }
  })()
}
