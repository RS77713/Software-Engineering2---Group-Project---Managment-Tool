import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createTestCase, getTestCase, updateTestCase } from '../api/test-cases.js'
import '../styles/test-cases.css'

const SEVERITIES = ['Critical', 'Major', 'Minor', 'Trivial']
const STATUSES = ['draft', 'ready', 'passed', 'failed', 'skipped']

// Project rule (CLAUDE.md): every test case title must end with its feature
// area in square brackets, e.g. "Login with valid credentials [Authentication]".
const TITLE_FEATURE_AREA_PATTERN = /\[[^[\]]+\]$/

function TestCaseFormPage({ mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = mode === 'edit'

  const [title, setTitle] = useState('')
  const [preconditions, setPreconditions] = useState('')
  const [steps, setSteps] = useState([''])
  const [expectedResult, setExpectedResult] = useState('')
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('draft')
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    getTestCase(id)
      .then((data) => {
        setTitle(data.title)
        setPreconditions(data.preconditions ?? '')
        setSteps(data.steps.length ? data.steps : [''])
        setExpectedResult(data.expectedResult)
        setSeverity(data.severity)
        setStatus(data.status)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  function updateStep(index, value) {
    setSteps((current) => current.map((step, i) => (i === index ? value : step)))
  }

  function addStep() {
    setSteps((current) => [...current, ''])
  }

  function removeStep(index) {
    setSteps((current) => current.filter((_, i) => i !== index))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    const trimmedTitle = title.trim()
    const trimmedSteps = steps.map((step) => step.trim()).filter(Boolean)
    if (!trimmedTitle) return setError('Title is required.')
    if (!TITLE_FEATURE_AREA_PATTERN.test(trimmedTitle)) {
      return setError(
        'Title must end with the feature area in square brackets, e.g. "Login with valid credentials [Authentication]".'
      )
    }
    if (trimmedSteps.length === 0) return setError('At least one step is required.')
    if (!expectedResult.trim()) return setError('Expected result is required.')
    if (!SEVERITIES.includes(severity)) return setError('Severity is required.')

    const payload = {
      title: trimmedTitle,
      preconditions: preconditions.trim() || null,
      steps: trimmedSteps,
      expectedResult: expectedResult.trim(),
      severity,
      status,
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        await updateTestCase(id, payload)
      } else {
        await createTestCase(payload)
      }
      navigate('/test-cases')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="test-case-form-page">
      <h1 className="page-title">{isEdit ? 'Edit test case' : 'New test case'}</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && (
      <form onSubmit={handleSubmit}>
        <label>
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Login with valid credentials [Authentication]"
            required
          />
        </label>

        <label>
          Preconditions <span className="optional">(optional)</span>
          <textarea
            value={preconditions}
            onChange={(event) => setPreconditions(event.target.value)}
            rows={2}
          />
        </label>

        <fieldset>
          <legend>Steps</legend>
          {steps.map((step, index) => (
            <div className="step-row" key={index}>
              <span className="step-number">{index + 1}.</span>
              <input
                value={step}
                onChange={(event) => updateStep(index, event.target.value)}
                required={steps.length === 1}
              />
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  aria-label={`Remove step ${index + 1}`}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addStep}>
            + Add step
          </button>
        </fieldset>

        <label>
          Expected result
          <textarea
            value={expectedResult}
            onChange={(event) => setExpectedResult(event.target.value)}
            rows={2}
            required
          />
        </label>

        <label>
          Severity
          <select value={severity} onChange={(event) => setSeverity(event.target.value)} required>
            <option value="" disabled>
              Select severity...
            </option>
            {SEVERITIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
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
          <button type="button" onClick={() => navigate('/test-cases')}>
            Cancel
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create test case'}
          </button>
        </div>
      </form>
      )}
    </section>
  )
}

export default TestCaseFormPage
