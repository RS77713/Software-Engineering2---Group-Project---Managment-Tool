/* eslint-disable react/set-state-in-effect -- Reset read state when the route or explicit refresh changes. */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createBug, reconcileBugs } from '../api/bugs.js'
import { getTestRun } from '../api/test-runs.js'
import { useBugDraft } from '../components/BugDrafts.jsx'
import BugFields, { descriptionFor, focusError, validateBug } from '../components/BugFields.jsx'
import '../styles/test-cases.css'

function BugCreatePageContent() {
  const { runId, resultId } = useParams()
  const key = `${runId}/${resultId}`
  const [draft, setDraft] = useBugDraft(key)
  const [source, setSource] = useState(null)
  const [readError, setReadError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [errors, setErrors] = useState({})
  const lock = useRef(false)
  const navigate = useNavigate()
  useEffect(() => {
    let active = true
    setSource(null); setReadError('')
    getTestRun(runId).then((run) => {
      if (!active) return
      const result = run.results.find((r) => r.id === Number(resultId))
      if (!result) throw new Error('The selected test result was not found.')
      setSource({ resultId: result.id, runId: Number(runId), testCaseId: result.testCaseId, outcome: result.result })
    }).catch((e) => { if (active) setReadError(e.message) })
    return () => { active = false }
  }, [runId, resultId, refresh])
  const d = draft || { title: '', steps: '', expected: '', actual: '', severity: '', state: 'editing' }
  const change = (name, value) => setDraft({ ...d, [name]: value })
  const unresolved = ['uncertain', 'reconciling', 'checked'].includes(d.state)
  async function submit(event, resubmit = false) {
    event?.preventDefault()
    if (lock.current || d.state === 'submitting' || (unresolved && !resubmit) || !source || source.outcome !== 'failed') return
    const validation = validateBug(d, true)
    setErrors(validation)
    if (Object.keys(validation).length) { focusError(validation); return }
    lock.current = true
    const payload = { title: d.title.trim(), description: descriptionFor(d), severity: d.severity, sourceResultId: source.resultId }
    const attempt = { payload, source: { ...source }, submittedAt: new Date().toISOString() }
    // Keep the first attempted payload even if a later explicit submission changes it.
    const next = { ...d, originalAttempt: d.originalAttempt || attempt, attempt, state: 'submitting', message: '' }
    setDraft(next)
    try {
      const bug = await createBug(payload)
      setDraft(undefined)
      navigate(`/bugs/${bug.id}`, { state: { message: 'Bug report created successfully.' } })
    } catch (e) {
      setDraft({ ...next, state: e.rejected ? 'rejected' : 'uncertain', message: e.rejected ? `${e.message}${[404, 409].includes(e.status) ? ' Review the source before submitting again.' : ''}` : 'The bug may have been saved. Check existing bugs before submitting again.' })
    } finally { lock.current = false }
  }
  async function check() {
    if (lock.current) return
    lock.current = true
    setDraft({ ...d, state: 'reconciling', message: '' })
    try {
      const candidates = await reconcileBugs(d.attempt)
      setDraft({ ...d, state: 'checked', candidates, message: 'Fresh list and detail checks completed and refreshed. Inspect candidates before deciding.' })
    } catch (e) {
      setDraft({ ...d, state: 'uncertain', message: `Read failed: ${e.message} The creation outcome remains unresolved.` })
    } finally { lock.current = false }
  }
  return <section className="test-case-form-page">
    <Link to={`/test-runs/${runId}?resultId=${resultId}`}>Back to source result</Link>
    <h1 className="page-title">Create Bug</h1>
    <p>Source result #{resultId} in run #{runId}. Opening this form creates no bug.</p>
    {!source && !readError && <p role="status">Loading source…</p>}
    {readError && <p role="alert" className="error">{readError}</p>}
    {source && source.outcome !== 'failed' && <p role="alert">This result is currently {source.outcome}. A failed result is required.</p>}
    <button type="button" onClick={() => setRefresh((n) => n + 1)}>Refresh source</button>
    {d.message && <p role={d.state === 'checked' ? 'status' : 'alert'} className="error">{d.message}</p>}
    <form noValidate onSubmit={submit}>
      <BugFields create value={d} onChange={change} errors={errors} disabled={d.state === 'submitting' || d.state === 'reconciling'} />
      <button type="submit" disabled={!source || source.outcome !== 'failed' || d.state === 'submitting' || unresolved}>{d.state === 'submitting' ? 'Submitting…' : 'Create Bug'}</button>
    </form>
    {unresolved && <div>
      <p>The original request may still complete. No match does not prove failure; a late request or an edited record can cause a duplicate.</p>
      <button disabled={d.state === 'reconciling'} onClick={check}>{d.state === 'reconciling' ? 'Checking…' : 'Check existing bugs'}</button>
      {d.state === 'checked' && <>
        {!d.candidates.length && <p>No existing bugs found.</p>}
        <ul>{d.candidates.map(({ bug, matches }) => <li key={bug.id}><Link to={`/bugs/${bug.id}?draft=${encodeURIComponent(key)}`}>#{bug.id} {bug.title}</Link> — {matches ? 'Matches submitted fields and source; inspect to identify' : 'Fields differ; inspect for later edits'} (created {bug.createdAt})</li>)}</ul>
        <button disabled={!source || source.outcome !== 'failed'} onClick={() => submit(null, true)}>I found no saved bug — submit again despite duplicate risk</button>
      </>}
      <details><summary>Original attempted payload and source</summary><pre>{JSON.stringify(d.originalAttempt, null, 2)}</pre></details>
    </div>}
    <button disabled={['submitting', 'reconciling'].includes(d.state)} onClick={() => { setDraft(undefined); navigate(`/test-runs/${runId}?resultId=${resultId}`) }}>Discard draft</button>
  </section>
}

export default function BugCreatePage() {
  const { runId, resultId } = useParams()
  return <BugCreatePageContent key={`${runId}/${resultId}`} />
}
