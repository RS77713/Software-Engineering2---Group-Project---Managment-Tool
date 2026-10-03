import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSuite } from '../api/suites.js'
import '../styles/test-cases.css'
import '../styles/test-suites.css'

const STATUSES = ['draft', 'ready', 'in-progress', 'passed', 'failed']

function TestSuiteFormPage() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [feature, setFeature] = useState('')
  const [status, setStatus] = useState('draft')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const trimmedFeature = feature.trim()
    if (!trimmedName) return setError('Name is required.')
    if (!trimmedFeature) return setError('Feature is required.')

    setSubmitting(true)
    try {
      const suite = await createSuite({ name: trimmedName, feature: trimmedFeature, status })
      // Land on the new suite's detail page so cases can be added right away.
      navigate(`/test-suites/${suite.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="test-suite-form-page">
      <h1 className="page-title">New test suite</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Account Flows Suite"
            required
          />
        </label>

        <label>
          Feature
          <input
            value={feature}
            onChange={(event) => setFeature(event.target.value)}
            placeholder="e.g. Authentication"
            required
          />
        </label>

        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} required>
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/test-suites')}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create suite'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default TestSuiteFormPage
