import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function HomePage() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((body) => setStatus(body.data?.status ?? 'unknown'))
      .catch(() => setStatus('unreachable'))
  }, [])

  const statusClass = status === 'checking...' ? 'status-loading' : status === 'unreachable' ? 'status-down' : 'status-ok'

  return (
    <main className="app">
      <Link to="/dashboard" className="app-hero-logo-link" aria-label="Enter the dashboard">
        <span className="app-hero-logo-glow" aria-hidden="true" />
        <span className="app-hero-logo-float">
          <img src="/favicon.svg" alt="" aria-hidden="true" className="app-hero-logo" />
        </span>
      </Link>
      <p className="app-hero-hint">Enter the Dashboard →</p>

      <div className="app-footer-status">
        <h1>QA Management Tool</h1>
        <p>
          Client (React) is running. Server status:{' '}
          <strong className={`data-readout ${statusClass}`}>{status}</strong>
        </p>
      </div>
    </main>
  )
}

export default HomePage
