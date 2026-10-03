import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardMetrics, getDashboardTrends } from '../api/dashboard.js'
import PassRateTrendChart from '../components/PassRateTrendChart.jsx'
import RunStatusBadge from '../components/RunStatusBadge.jsx'
import TestCaseStatusDonutChart from '../components/TestCaseStatusDonutChart.jsx'
import '../styles/test-cases.css'
import '../styles/dashboard.css'

const REFRESH_INTERVAL_MS = 30000

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return null
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return minutes === 0 ? `${secs}s` : `${minutes}m ${secs}s`
}

function MetricCard({ label, value, hint, accent = 'neutral' }) {
  const missing = value === null || value === undefined
  return (
    <div className={`metric-card metric-card-${accent}`}>
      <div className="metric-label eyebrow-label">{label}</div>
      <div className={missing ? 'metric-value metric-value-missing' : 'metric-value data-readout'}>
        {missing ? 'Not enough data yet' : value}
      </div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  )
}

function DashboardPage() {
  const [metrics, setMetrics] = useState(null)
  const [trends, setTrends] = useState(null)
  const [loading, setLoading] = useState(true)
  const [trendsLoading, setTrendsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [trendsError, setTrendsError] = useState(null)

  useEffect(() => {
    let cancelled = false

    function load() {
      getDashboardMetrics()
        .then((data) => {
          if (!cancelled) {
            setMetrics(data)
            setError(null)
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err.message)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })

      getDashboardTrends()
        .then((data) => {
          if (!cancelled) {
            setTrends(data)
            setTrendsError(null)
          }
        })
        .catch((err) => {
          if (!cancelled) setTrendsError(err.message)
        })
        .finally(() => {
          if (!cancelled) setTrendsLoading(false)
        })
    }

    load()
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [])

  return (
    <section className="dashboard-page">
      <h1 className="page-title">Dashboard</h1>

      {error && <p className="error">{error}</p>}
      {loading && <p>Loading metrics...</p>}

      {!loading && metrics && (
        <>
          <div className="metric-cards">
            <MetricCard
              label="Total Test Cases"
              value={metrics.totalTestCases}
              hint={metrics.totalTestCases === 0 ? <Link to="/test-cases/new">Create your first test case</Link> : null}
            />
            <MetricCard label="Test Suites" value={metrics.totalSuites} />
            <MetricCard label="Test Runs" value={metrics.totalRuns} />
            <MetricCard
              label="Pass Rate"
              value={metrics.passRate === null ? null : `${metrics.passRate}%`}
              hint={metrics.passRate === null ? <Link to="/test-suites">Start a test run</Link> : null}
              accent="passed"
            />
            <MetricCard
              label="Avg. Run Duration"
              value={formatDuration(metrics.averageRunDurationSeconds)}
              accent="info"
            />
          </div>

          <section className="dashboard-section">
            <h2>Recent Test Runs</h2>
            {metrics.recentRuns.length === 0 ? (
              <div className="empty-state">
                <p>No test runs yet.</p>
                <Link to="/test-suites" className="button">
                  Start a test run
                </Link>
              </div>
            ) : (
              <div className="table-scroll dashboard-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Suite</th>
                      <th>Status</th>
                      <th>Passed</th>
                      <th>Failed</th>
                      <th>Skipped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.recentRuns.map((run) => (
                      <tr key={run.id}>
                        <td>
                          <Link to={`/test-runs/${run.id}`}>{run.suiteName}</Link>
                        </td>
                        <td>
                          <RunStatusBadge status={run.status} />
                        </td>
                        <td>{run.passCount}</td>
                        <td>{run.failCount}</td>
                        <td>{run.skipCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {trendsError && <p className="error">{trendsError}</p>}
      {trendsLoading && <p>Loading trends...</p>}
      {!trendsLoading && trends && (
        <div className="dashboard-charts">
          <div className="chart-card">
            <h2>Pass Rate (Latest 10 Runs)</h2>
            <PassRateTrendChart runs={trends.passRateTrend} />
          </div>
          <div className="chart-card">
            <h2>Test Cases by Status</h2>
            <TestCaseStatusDonutChart statuses={trends.testCasesByStatus} />
          </div>
        </div>
      )}
    </section>
  )
}

export default DashboardPage
