import { useState } from 'react'
import { Link } from 'react-router-dom'
import { importTestCases } from '../api/test-cases.js'
import '../styles/test-cases.css'

// Matches each row status this page can show, except Invalid — that gets
// the solid-filled alarm treatment instead (see RowStatusBadge below).
// Colors echo the same language used by the app's other badges (green =
// good outcome, blue = ready/active, amber = needs attention but not broken).
const ROW_STATUS_COLORS = {
  Imported: 'var(--color-success)',
  Ready: 'var(--color-info)',
  Duplicate: 'var(--color-warning)',
}

function rowStatusLabel(row) {
  if (row.imported) return 'Imported'
  if (!row.valid) return 'Invalid'
  if (row.duplicate) return 'Duplicate'
  return 'Ready'
}

// Invalid rows get the same solid-filled "alarm" treatment as
// SeverityBadge's Critical/PriorityBadge's Urgent (see index.css/
// test-cases.css) — the most severe outcome in this row-status scale.
function RowStatusBadge({ label }) {
  if (label === 'Invalid') {
    return <span className="badge badge-solid">{label}</span>
  }
  return (
    <span className="badge" style={{ color: ROW_STATUS_COLORS[label] }}>
      {label}
    </span>
  )
}

function duplicateDetail(duplicate) {
  if (!duplicate) return null
  return duplicate.reason === 'existing-test-case'
    ? `Duplicate of existing test case #${duplicate.existingId}.`
    : `Duplicate of row ${duplicate.firstRowNumber} in this file.`
}

function rowDetail(row) {
  if (row.errors.length > 0) return row.errors.join('; ')
  return duplicateDetail(row.duplicate)
}

function TestCaseImportPage() {
  const [fileName, setFileName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState(null)

  async function runPreview(text) {
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const data = await importTestCases(text, { commit: false })
      setPreview(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setCsvText('')
    setPreview(null)
    setError(null)

    let text
    try {
      text = await file.text()
    } catch {
      setError('Could not read the selected file.')
      return
    }

    setCsvText(text)
    runPreview(text)
  }

  async function handleConfirm() {
    setCommitting(true)
    setError(null)
    try {
      const data = await importTestCases(csvText, { commit: true })
      setPreview(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setCommitting(false)
    }
  }

  const importableCount = preview ? preview.rows.filter((row) => row.valid && !row.duplicate).length : 0
  const alreadyCommitted = Boolean(preview?.committed)

  return (
    <section className="test-case-import-page">
      <Link to="/test-cases" className="back-link">
        &larr; Back to test cases
      </Link>

      <h1 className="page-title">Import test cases from CSV</h1>

      <div className="import-format-help">
        <p>
          Required columns: <code>title</code>, <code>severity</code>, <code>steps</code>, <code>expected_result</code>{' '}
          (also accepted as <code>expectedResult</code>). Optional: <code>preconditions</code>, <code>status</code> (defaults
          to <code>draft</code>).
        </p>
        <p>
          Put one step per line inside the <code>steps</code> cell, using your spreadsheet's normal multi-line-cell quoting
          (Excel/Sheets/Numbers all do this automatically when a cell contains a line break):
        </p>
        <pre>{`title,severity,steps,expected_result
"Login with valid credentials [Authentication]",Critical,"Navigate to the login page.
Enter a valid email and password.
Click ""Log in"".","User is redirected to the dashboard."`}</pre>
        <p>A title that already exists is treated as a duplicate and skipped — nothing is ever overwritten.</p>
      </div>

      <label className="import-file-label">
        CSV file
        <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
      </label>

      {error && <p className="error">{error}</p>}

      {loading && <p>Checking {fileName}...</p>}

      {preview && (
        <>
          <div className="import-summary">
            <span>
              {preview.totalRows} row{preview.totalRows === 1 ? '' : 's'} found
            </span>
            {alreadyCommitted ? (
              <span>
                {preview.summary.imported} imported, {preview.summary.invalid} invalid, {preview.summary.duplicate} duplicate
                {preview.summary.duplicate === 1 ? '' : 's'} skipped
              </span>
            ) : (
              <span>
                {importableCount} ready to import, {preview.summary.invalid} invalid, {preview.summary.duplicate} duplicate
                {preview.summary.duplicate === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="table-scroll">
          <table className="test-cases-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Title</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => {
                const label = rowStatusLabel(row)
                return (
                  <tr key={row.rowNumber}>
                    <td className="data-readout">{row.rowNumber}</td>
                    <td>{row.title || <span className="import-row-empty-title">(no title)</span>}</td>
                    <td>
                      <RowStatusBadge label={label} />
                    </td>
                    <td>{rowDetail(row) || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>

          {!alreadyCommitted && (
            <div className="form-actions">
              <button type="button" disabled={importableCount === 0 || committing} onClick={handleConfirm}>
                {committing ? 'Importing...' : `Confirm import (${importableCount})`}
              </button>
            </div>
          )}

          {alreadyCommitted && (
            <div className="form-actions">
              <Link to="/test-cases" className="button">
                Done — back to test cases
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default TestCaseImportPage
