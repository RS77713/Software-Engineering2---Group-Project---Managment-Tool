/* eslint-disable react/set-state-in-effect -- Reset read state when the route or explicit refresh changes. */
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getBug, transitions, updateBug } from '../api/bugs.js'
import { getTestRun } from '../api/test-runs.js'
import BugFields, { focusError, validateBug } from '../components/BugFields.jsx'
import { useBugDraft } from '../components/BugDrafts.jsx'
import '../styles/test-cases.css'
function BugDetailPageContent() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const returnDraft = params.get('draft')
  const [, setRetainedDraft] = useBugDraft(returnDraft)
  const location = useLocation()
  const [bug, setBug] = useState(null)
  const [draft, setDraft] = useState(null)
  const [source, setSource] = useState(null)
  const [sourceError, setSourceError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState(location.state?.message || '')
  const [errors, setErrors] = useState({})
  const [pending, setPending] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    setError(''); setSource(null); setSourceError('')
    getBug(id).then(async (b) => {
      if (!active) return
      setBug(b); setDraft((previous) => previous || { ...b }); setUncertain(false)
      if (b.sourceRunId) {
        try {
          const run = await getTestRun(b.sourceRunId)
          if (!active) return
          const result = run.results.find((r) => r.id === b.sourceResultId)
          if (!result) throw new Error('Source result was not found.')
          setSource(result)
        } catch (e) { if (active) setSourceError(e.message) }
      }
    }).catch((e) => { if (active) setError(`Read failed: ${e.message}`) })
    return () => { active = false }
  }, [id, refresh])
  async function save(event) {
    event.preventDefault()
    if (lock.current || uncertain) return
    const validation = validateBug(draft)
    setErrors(validation)
    if (Object.keys(validation).length) { focusError(validation); return }
    lock.current = true; setPending(true); setError(''); setMessage('')
    try {
      const b = await updateBug(id, { title: draft.title.trim(), description: draft.description.trim(), severity: draft.severity, status: draft.status, testCaseId: bug.testCaseId })
      setBug(b); setDraft({ ...b }); setMessage('Bug changes saved successfully.')
    } catch (e) {
      setError(e.rejected ? e.message : 'The update may have been saved. Refresh saved details before choosing whether to save again; your draft is retained.')
      setUncertain(!e.rejected)
    } finally { lock.current = false; setPending(false) }
  }
  return <section className="test-case-form-page"><Link to="/bugs">Back to bugs</Link>
    {returnDraft && <p><Link to={`/bugs/new/${returnDraft}`}>Return to retained draft</Link></p>}
    <h1 className="page-title">Bug #{id}</h1>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="error">{error}</p>}
    <button disabled={pending} onClick={() => setRefresh((n) => n + 1)}>Refresh saved details (keep draft)</button>
    {!bug ? !error && <p role="status">Loading bug…</p> : <>
      <h2>{bug.title}</h2><p>Saved status: {bug.status}; severity: {bug.severity}</p><pre style={{ whiteSpace: 'pre-wrap' }}>{bug.description}</pre>
      {returnDraft && <button onClick={() => { setRetainedDraft(undefined); navigate(`/bugs/${id}`, { replace: true, state: { message: 'Using the existing saved bug; no new report submitted.' } }); setMessage('Using the existing saved bug; no new report submitted.') }}>I identify this as my saved bug — use it</button>}
      <p>Created: {bug.createdAt}; updated: {bug.updatedAt}. Concurrent edits use the last accepted write.</p>
      {bug.testCaseId && <p><Link to={`/test-cases/${bug.testCaseId}`}>Test case #{bug.testCaseId}</Link></p>}
      {bug.sourceResultId ? <div><Link to={`/test-runs/${bug.sourceRunId}?resultId=${bug.sourceResultId}`}>Source result #{bug.sourceResultId}, run #{bug.sourceRunId}</Link>
        <p>Failed when reported. {source ? `Current source outcome: ${source.result}. Current notes: ${source.notes || '(none)'}` : sourceError ? `Source read failed: ${sourceError}` : 'Loading current source…'}</p></div> : <p>No execution source.</p>}
      <form noValidate onSubmit={save}>
        <BugFields value={draft} errors={errors} disabled={pending} onChange={(name, value) => setDraft({ ...draft, [name]: value })} />
        <label>Status<select value={draft.status} disabled={pending} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{[...new Set([bug.status, draft.status, ...transitions[bug.status]])].map((s) => <option key={s}>{s}</option>)}</select></label>
        <p>Source and linked case identity are retained on update.</p>
        <button disabled={pending || uncertain} type="submit">{pending ? 'Saving…' : 'Save changes'}</button>
      </form>
    </>}
  </section>
}

export default function BugDetailPage() {
  const { id } = useParams()
  return <BugDetailPageContent key={id} />
}
