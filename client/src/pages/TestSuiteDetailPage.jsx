import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addCaseToSuite,
  deleteSuite,
  getSuite,
  removeCaseFromSuite,
  reorderSuiteCases,
  updateSuite,
} from '../api/suites.js'
import { listTestCases } from '../api/test-cases.js'
import { createTestRun } from '../api/test-runs.js'
import SeverityBadge from '../components/SeverityBadge.jsx'
import SuiteStatusBadge from '../components/SuiteStatusBadge.jsx'
import '../styles/test-cases.css'
import '../styles/test-suites.css'
import { getSuiteEditFields } from './test-suite-edit-fields.js'

const STATUSES = ['draft', 'ready', 'in-progress', 'passed', 'failed']

function TestSuiteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [suite, setSuite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editFeature, setEditFeature] = useState('')
  const [editStatus, setEditStatus] = useState('draft')
  const [savingEdit, setSavingEdit] = useState(false)

  const [availableCases, setAvailableCases] = useState([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [addingCase, setAddingCase] = useState(false)

  const [dragIndex, setDragIndex] = useState(null)

  const [runCreatorName, setRunCreatorName] = useState('')
  const [creatingRun, setCreatingRun] = useState(false)

  const [justSaved, setJustSaved] = useState(false)

  const fetchSuite = useCallback(() => {
    setLoading(true)
    setError(null)
    return getSuite(id)
      .then((data) => {
        setSuite(data)
        const fields = getSuiteEditFields(data)
        setEditName(fields.name)
        setEditFeature(fields.feature)
        setEditStatus(fields.status)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  // Reset the edit form's draft fields from the suite's real, current
  // values. Called both when opening the form and when cancelling out of
  // it, so a discarded edit can never linger and resurface next time the
  // form is reopened.
  function resetEditFields() {
    const fields = getSuiteEditFields(suite)
    setEditName(fields.name)
    setEditFeature(fields.feature)
    setEditStatus(fields.status)
  }

  function openEdit() {
    resetEditFields()
    setJustSaved(false)
    setEditing(true)
  }

  function closeEdit() {
    resetEditFields()
    setEditing(false)
  }

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    fetchSuite()
  }, [fetchSuite])

  // Auto-dismiss the "Suite updated." confirmation, so it can't linger
  // indefinitely across later, unrelated actions on this page (adding a
  // case, reordering, etc. don't otherwise touch this state).
  useEffect(() => {
    if (!justSaved) return
    const timeout = setTimeout(() => setJustSaved(false), 4000)
    return () => clearTimeout(timeout)
  }, [justSaved])

  // Load the test cases available to add. The list endpoint caps at 20 per
  // page; fine for now given how few test cases this app has.
  useEffect(() => {
    listTestCases({ page: 1 })
      // oxlint-disable-next-line react/set-state-in-effect
      .then((data) => setAvailableCases(data.items))
      .catch(() => {
        // Non-critical: the "add case" dropdown just stays empty.
      })
  }, [])

  async function handleSaveEdit(event) {
    event.preventDefault()
    setError(null)

    const trimmedName = editName.trim()
    const trimmedFeature = editFeature.trim()
    if (!trimmedName) return setError('Name is required.')
    if (!trimmedFeature) return setError('Feature is required.')

    setSavingEdit(true)
    try {
      const updated = await updateSuite(id, {
        name: trimmedName,
        feature: trimmedFeature,
        status: editStatus,
      })
      setSuite(updated)
      setEditing(false)
      setJustSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteSuite() {
    if (!window.confirm(`Delete suite "${suite.name}"? This can't be undone.`)) return
    try {
      await deleteSuite(id)
      navigate('/test-suites')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddCase(event) {
    event.preventDefault()
    if (!selectedCaseId) return

    setAddingCase(true)
    setError(null)
    try {
      const updated = await addCaseToSuite(id, Number(selectedCaseId))
      setSuite(updated)
      setSelectedCaseId('')
    } catch (err) {
      setError(err.message)
    } finally {
      setAddingCase(false)
    }
  }

  async function handleRemoveCase(testCaseId) {
    if (!window.confirm('Remove this test case from the suite?')) return
    try {
      const updated = await removeCaseFromSuite(id, testCaseId)
      setSuite(updated)
    } catch (err) {
      setError(err.message)
    }
  }

  async function persistOrder(nextCases) {
    // Optimistic update so the reorder feels instant; revert by refetching
    // from the server if the request fails.
    setSuite((current) => ({ ...current, cases: nextCases }))
    try {
      const updated = await reorderSuiteCases(
        id,
        nextCases.map((testCase) => testCase.id)
      )
      setSuite(updated)
    } catch (err) {
      setError(err.message)
      fetchSuite()
    }
  }

  function moveCase(fromIndex, toIndex) {
    if (!suite || toIndex < 0 || toIndex >= suite.cases.length || fromIndex === toIndex) return
    const next = [...suite.cases]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    persistOrder(next)
  }

  function handleDrop(targetIndex) {
    if (dragIndex === null) return
    moveCase(dragIndex, targetIndex)
    setDragIndex(null)
  }

  async function handleNewRun() {
    if (!runCreatorName.trim()) return
    setCreatingRun(true)
    setError(null)
    try {
      const run = await createTestRun({ suiteId: id, createdBy: runCreatorName.trim() })
      navigate(`/test-runs/${run.id}`)
    } catch (err) {
      setError(err.message)
      setCreatingRun(false)
    }
  }

  if (loading) {
    return (
      <section className="test-suite-detail-page">
        <Link to="/test-suites" className="back-link">
          &larr; Back to test suites
        </Link>
        <h1 className="page-title">Test Suite</h1>
        <p>Loading...</p>
      </section>
    )
  }

  if (!suite) {
    return (
      <section className="test-suite-detail-page">
        <Link to="/test-suites" className="back-link">
          &larr; Back to test suites
        </Link>
        <h1 className="page-title">Test Suite</h1>
        {error && <p className="error">{error}</p>}
      </section>
    )
  }

  const caseIdsInSuite = new Set(suite.cases.map((testCase) => testCase.id))
  const addableCases = availableCases.filter((testCase) => !caseIdsInSuite.has(testCase.id))

  return (
    <section className="test-suite-detail-page">
      <Link to="/test-suites" className="back-link">
        &larr; Back to test suites
      </Link>

      {error && <p className="error">{error}</p>}
      {justSaved && <p className="success">Suite updated.</p>}

      {!editing ? (
        <div className="suite-header">
          <div>
            <h1 className="page-title">{suite.name}</h1>
            <p className="suite-meta-line">
              {suite.feature} &middot; <SuiteStatusBadge status={suite.status} /> &middot;{' '}
              <span className="data-readout">{suite.cases.length}</span> case{suite.cases.length === 1 ? '' : 's'} &middot;
              updated <span className="data-readout">{new Date(suite.updatedAt).toLocaleString()}</span>
            </p>
          </div>
          <div className="suite-header-actions">
            <input
              value={runCreatorName}
              onChange={(event) => setRunCreatorName(event.target.value)}
              placeholder="Your name"
              aria-label="Your name (for the new run)"
              className="run-creator-input"
            />
            <button type="button" disabled={!runCreatorName.trim() || creatingRun} onClick={handleNewRun}>
              {creatingRun ? 'Creating...' : '+ New Run'}
            </button>
            <button type="button" onClick={openEdit}>
              Edit
            </button>
            <button type="button" className="danger" onClick={handleDeleteSuite}>
              Delete suite
            </button>
          </div>
        </div>
      ) : (
        <form className="suite-edit-form test-suite-form-page" onSubmit={handleSaveEdit}>
          <label>
            Name
            <input value={editName} onChange={(event) => setEditName(event.target.value)} required />
          </label>
          <label>
            Feature
            <input value={editFeature} onChange={(event) => setEditFeature(event.target.value)} required />
          </label>
          <label>
            Status
            <select value={editStatus} onChange={(event) => setEditStatus(event.target.value)} required>
              {STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="button" onClick={closeEdit}>
              Cancel
            </button>
            <button type="submit" disabled={savingEdit}>
              {savingEdit ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      <h2>Cases in this suite</h2>

      {suite.cases.length === 0 ? (
        <p>No cases in this suite yet. Add one below.</p>
      ) : (
        <ol className="suite-cases-list">
          {suite.cases.map((testCase, index) => (
            <li
              key={testCase.id}
              className="suite-case-row"
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(index)}
            >
              <span className="drag-handle" aria-hidden="true">
                ⠿
              </span>
              <Link to={`/test-cases/${testCase.id}`} className="row-title-link suite-case-title">
                {testCase.title}
              </Link>
              <SeverityBadge severity={testCase.severity} />
              <span className="suite-case-status">{testCase.status}</span>
              <div className="suite-case-actions">
                <button
                  type="button"
                  onClick={() => moveCase(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Move "${testCase.title}" up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveCase(index, index + 1)}
                  disabled={index === suite.cases.length - 1}
                  aria-label={`Move "${testCase.title}" down`}
                >
                  ↓
                </button>
                <button type="button" className="danger" onClick={() => handleRemoveCase(testCase.id)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form className="add-case-form" onSubmit={handleAddCase}>
        <select
          value={selectedCaseId}
          onChange={(event) => setSelectedCaseId(event.target.value)}
          aria-label="Test case to add"
        >
          <option value="">Select a test case to add...</option>
          {addableCases.map((testCase) => (
            <option key={testCase.id} value={testCase.id}>
              {testCase.title}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!selectedCaseId || addingCase}>
          {addingCase ? 'Adding...' : '+ Add case'}
        </button>
      </form>
    </section>
  )
}

export default TestSuiteDetailPage
