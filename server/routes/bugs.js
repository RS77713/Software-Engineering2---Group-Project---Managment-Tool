import express, { Router } from 'express'
import { db } from '../db.js'
import { BugError, createBug, getBug, listBugs, parseId, updateBug } from '../bugs.js'

const router = Router()
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data, error: null })

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  const mediaType = req.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase()
  if (['POST', 'PUT'].includes(req.method) && mediaType !== 'application/json') {
    return next(new BugError(415, 'Content-Type must be application/json'))
  }
  next()
})
router.use(express.json())

router.get('/', (req, res, next) => {
  try {
    const start = req.originalUrl.indexOf('?')
    const query = new URLSearchParams(start < 0 ? '' : req.originalUrl.slice(start + 1))
    ok(res, listBugs(db, query))
  } catch (error) { next(error) }
})
router.get('/:id', (req, res, next) => {
  try { ok(res, getBug(db, parseId(req.params.id))) } catch (error) { next(error) }
})
router.post('/', (req, res, next) => {
  try { ok(res, createBug(db, req.body), 201) } catch (error) { next(error) }
})
router.put('/:id', (req, res, next) => {
  try { ok(res, updateBug(db, parseId(req.params.id), req.body)) } catch (error) { next(error) }
})
router.use((req, res, next) => next(new BugError(404, 'bug route not found')))
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  const parserError = ['entity.parse.failed', 'entity.too.large', 'charset.unsupported', 'encoding.unsupported', 'request.aborted', 'request.size.invalid'].includes(error.type)
  const malformedPath = error instanceof URIError && error.status === 400
  const status = error instanceof BugError || parserError ? error.status : malformedPath ? 400 : 500
  res.status(status).json({ success: false, data: null, error: status >= 500 ? 'internal server error' : error.message })
})

export default router
