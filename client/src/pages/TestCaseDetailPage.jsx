import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTestCase } from '../api/test-cases.js'
import SeverityBadge from '../components/SeverityBadge.jsx'
import '../styles/test-cases.css'

function TestCaseDetailPage() {
  const { id } = useParams()

  const [testCase, setTestCase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch the test case whenever the id changes. setLoading/setError run
  // synchronously to start the "loading" state before the request resolves,
  // which is the standard first step of a data-fetching effect.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    setError(null)
    getTestCase(id)
      .then(setTestCase)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  return (
    <section className="test-case-detail-page">
      <Link to="/test-cases" className="back-link">
        &larr; Back to test cases
      </Link>

      <h1 className="page-title">{testCase ? testCase.title : 'Test Case'}</h1>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {testCase && (
        <>
          <dl className="detail-meta">
            <div>
              <dt>Severity</dt>
              <dd>
                <SeverityBadge severity={testCase.severity} />
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{testCase.status}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd className="data-readout">{new Date(testCase.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd className="data-readout">{new Date(testCase.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>

          <h2>Preconditions</h2>
          <p>{testCase.preconditions || 'None'}</p>

          <h2>Steps</h2>
          <ol>
            {testCase.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>

          <h2>Expected Result</h2>
          <p>{testCase.expectedResult}</p>
        </>
      )}
    </section>
  )
}

export default TestCaseDetailPage
