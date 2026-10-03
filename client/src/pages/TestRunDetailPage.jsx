import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTestRun, updateTestRunResult } from '../api/test-runs.js'
import RunStatusBadge from '../components/RunStatusBadge.jsx'
import SeverityBadge from '../components/SeverityBadge.jsx'
import TestResultBadge from '../components/TestResultBadge.jsx'
import '../styles/test-cases.css'
import '../styles/test-runs.css'

function TestRunDetailPage() {
  const { id } = useParams()
  const [run, setRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notesDrafts, setNotesDrafts] = useState({})
  const [savingResultId, setSavingResultId] = useState(null)

  useEffect(() => {
    let cancelled = false
    getTestRun(id)
      .then((data) => {
        if (cancelled) return
        setRun(data)
        setNotesDrafts(Object.fromEntries(data.results.map((result) => [result.id, result.notes ?? ''])))
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleMarkResult(resultId, result) {
    setSavingResultId(resultId)
    setError(null)
    try {
      const updated = await updateTestRunResult(id, resultId, {
        result,
        notes: notesDrafts[resultId]?.trim() || null,
      })
      setRun(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingResultId(null)
    }
  }

  if (loading) {
    return (
      <section className="test-run-detail-page">
        <Link to="/test-runs" className="back-link">
          &larr; Back to test runs
        </Link>
        <h1 className="page-title">Test Run</h1>
        <p>Loading...</p>
      </section>
    )
  }

  if (!run) {
    return (
      <section className="test-run-detail-page">
        <Link to="/test-runs" className="back-link">
          &larr; Back to test runs
        </Link>
        <h1 className="page-title">Test Run</h1>
        {error && <p className="error">{error}</p>}
      </section>
    )
  }

  return (
    <section className="test-run-detail-page">
      <Link to="/test-runs" className="back-link">
        &larr; Back to test runs
      </Link>

      {error && <p className="error">{error}</p>}

      <div className="run-header">
        <div>
          <h1 className="page-title">{run.suiteName}</h1>
          <p className="run-meta-line">
            <RunStatusBadge status={run.status} /> &middot; <span className="data-readout">{run.passCount}</span>{' '}
            passed, <span className="data-readout">{run.failCount}</span> failed,{' '}
            <span className="data-readout">{run.skipCount}</span> skipped &middot; started by {run.createdBy}
          </p>
        </div>
      </div>

      <h2>Results</h2>

      {run.results.length === 0 ? (
        <p>This run has no snapshotted cases.</p>
      ) : (
        <ol className="run-results-list">
          {run.results.map((result) => (
            <li key={result.id} className="run-result-row">
              <div className="run-result-summary">
                <Link to={`/test-cases/${result.testCaseId}`} className="row-title-link run-result-title">
                  {result.testCaseTitle}
                </Link>
                <SeverityBadge severity={result.severity} />
                <TestResultBadge result={result.result} />
              </div>

              <label className="run-result-notes">
                Notes
                <textarea
                  value={notesDrafts[result.id] ?? ''}
                  onChange={(event) =>
                    setNotesDrafts((current) => ({ ...current, [result.id]: event.target.value }))
                  }
                  rows={2}
                  placeholder="Optional notes..."
                />
              </label>

              <div className="run-result-actions">
                {['passed', 'failed', 'skipped'].map((outcome) => (
                  <button
                    key={outcome}
                    type="button"
                    className={`result-${outcome}`}
                    disabled={savingResultId === result.id}
                    onClick={() => handleMarkResult(result.id, outcome)}
                  >
                    {outcome[0].toUpperCase() + outcome.slice(1)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="form-help">The run completes automatically when every case has a result.</p>
    </section>
  )
}

export default TestRunDetailPage
