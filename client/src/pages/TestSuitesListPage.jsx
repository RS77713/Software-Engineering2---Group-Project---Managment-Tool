import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteSuite, listSuites } from '../api/suites.js'
import SuiteStatusBadge from '../components/SuiteStatusBadge.jsx'
import '../styles/test-cases.css'
import '../styles/test-suites.css'

const STATUS_OPTIONS = ['all', 'draft', 'ready', 'in-progress', 'passed', 'failed']

function TestSuitesListPage() {
  const navigate = useNavigate()

  const [suites, setSuites] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSuites = useCallback(() => {
    setLoading(true)
    setError(null)
    return listSuites({ status: statusFilter })
      .then((data) => setSuites(data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [statusFilter])

  // Refetch whenever the status filter changes. See TestCasesListPage for
  // why this "start loading, then fetch" pattern is intentional.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    fetchSuites()
  }, [fetchSuites])

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete suite "${name}"? This can't be undone.`)) return
    try {
      await deleteSuite(id)
      fetchSuites()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="test-suites-page">
      <h1 className="page-title">Test Suites</h1>
      <div className="test-cases-toolbar">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === 'all' ? 'All statuses' : option}
            </option>
          ))}
        </select>
        <Link to="/test-suites/new" className="button">
          + New suite
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="table-scroll">
        <table className="test-cases-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Feature</th>
              <th>Status</th>
              <th>Cases</th>
              <th>Updated</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>Loading...</td>
              </tr>
            ) : suites.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state">
                    <p>No test suites found.</p>
                  </div>
                </td>
              </tr>
            ) : (
              suites.map((suite) => (
                <tr
                  key={suite.id}
                  className="clickable-row"
                  onClick={(event) => {
                    if (event.target.closest('a, button')) return
                    navigate(`/test-suites/${suite.id}`)
                  }}
                >
                  <td>
                    <Link to={`/test-suites/${suite.id}`} className="row-title-link">
                      {suite.name}
                    </Link>
                  </td>
                  <td>{suite.feature}</td>
                  <td>
                    <SuiteStatusBadge status={suite.status} />
                  </td>
                  <td className="data-readout">{suite.caseCount}</td>
                  <td className="data-readout">{new Date(suite.updatedAt).toLocaleString()}</td>
                  <td className="row-actions">
                    <button type="button" className="danger" onClick={() => handleDelete(suite.id, suite.name)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default TestSuitesListPage
