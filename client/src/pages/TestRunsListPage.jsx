import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listTestRuns } from '../api/test-runs.js'
import RunStatusBadge from '../components/RunStatusBadge.jsx'
import '../styles/test-cases.css'
import '../styles/test-runs.css'

function TestRunsListPage() {
  const navigate = useNavigate()

  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // setLoading/setError run synchronously to start the "loading" state
  // before the request resolves — the standard first step of a
  // data-fetching effect (see TestCasesListPage for the same pattern).
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    setError(null)
    listTestRuns()
      .then((data) => setRuns(data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="test-runs-page">
      <h1 className="page-title">Test Runs</h1>

      {error && <p className="error">{error}</p>}

      <div className="table-scroll">
        <table className="test-cases-table">
          <thead>
            <tr>
              <th>Suite</th>
              <th>Status</th>
              <th>Passed</th>
              <th>Failed</th>
              <th>Skipped</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Loading...</td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <p>No test runs found.</p>
                  </div>
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr
                  key={run.id}
                  className="clickable-row"
                  onClick={(event) => {
                    if (event.target.closest('a, button')) return
                    navigate(`/test-runs/${run.id}`)
                  }}
                >
                  <td>
                    <Link to={`/test-runs/${run.id}`} className="row-title-link">
                      {run.suiteName}
                    </Link>
                  </td>
                  <td>
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="data-readout">{run.passCount}</td>
                  <td className="data-readout">{run.failCount}</td>
                  <td className="data-readout">{run.skipCount}</td>
                  <td className="data-readout">{new Date(run.startTime).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default TestRunsListPage
