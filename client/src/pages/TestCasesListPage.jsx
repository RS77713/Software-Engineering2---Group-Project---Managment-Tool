import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteTestCase, getExportTestCasesUrl, getSuitesForTestCase, listTestCases } from '../api/test-cases.js'
import SeverityBadge from '../components/SeverityBadge.jsx'
import '../styles/test-cases.css'

const STATUS_OPTIONS = ['all', 'draft', 'ready', 'passed', 'failed', 'skipped']

function TestCasesListPage() {
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  // Default is creation order (id, ascending — newer cases last), matching
  // the server's own default when no sort is specified at all. Clicking a
  // sortable column (Severity/Updated) moves away from this via toggleSort.
  const [sort, setSort] = useState('id')
  const [order, setOrder] = useState('asc')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Debounce the search box so we don't fetch on every keystroke. The state
  // updates below run inside a setTimeout callback, not synchronously during
  // the effect, so this is a deliberate debounce rather than a render loop.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const fetchPage = useCallback(() => {
    setLoading(true)
    setError(null)
    return listTestCases({ status: statusFilter, search, sort, order, page })
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [statusFilter, search, sort, order, page])

  // Refetch whenever a filter/sort/page dependency changes. fetchPage sets
  // loading/error state synchronously before the request resolves, which is
  // the standard "start loading" step of a data-fetching effect.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    fetchPage()
  }, [fetchPage])

  function toggleSort(column) {
    if (sort === column) {
      setOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(column)
      setOrder('asc')
    }
    setPage(1)
  }

  function sortIndicator(column) {
    if (sort !== column) return null
    return order === 'asc' ? ' ▲' : ' ▼'
  }

  async function handleDelete(id, title) {
    // Check suite membership first, so the confirmation can warn the user
    // this case will also disappear from any suite it's part of. If the
    // check itself fails, fall back to the plain warning rather than
    // blocking delete on it.
    let message = `Delete test case "${title}"? This can't be undone.`
    try {
      const { suites } = await getSuitesForTestCase(id)
      if (suites.length > 0) {
        const names = suites.map((suite) => suite.name).join(', ')
        const suiteWord = suites.length === 1 ? 'suite' : 'suites'
        message = `Delete test case "${title}"? It's also used in ${suites.length} ${suiteWord} (${names}) and will be removed from ${suites.length === 1 ? 'it' : 'them'} too. This can't be undone.`
      }
    } catch {
      // Non-critical: proceed with the generic warning above.
    }

    if (!window.confirm(message)) return
    try {
      await deleteTestCase(id)
      // If that was the last item on a page beyond the first, step back a page;
      // otherwise just refetch the current page.
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1)
      } else {
        fetchPage()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="test-cases-page">
      <h1 className="page-title">Test Cases</h1>
      <div className="test-cases-toolbar">
        <input
          type="search"
          placeholder="Search by title..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Search test cases by title"
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === 'all' ? 'All statuses' : option}
            </option>
          ))}
        </select>
        <Link to="/test-cases/new" className="button">
          + New test case
        </Link>
        <Link to="/test-cases/import" className="button">
          Import CSV
        </Link>
        <a href={getExportTestCasesUrl({ status: statusFilter, search, sort, order })} className="button" download>
          Download CSV
        </a>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="table-scroll">
        <table className="test-cases-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>
                <button type="button" className="sort-button" onClick={() => toggleSort('severity')}>
                  Severity{sortIndicator('severity')}
                </button>
              </th>
              <th>Status</th>
              <th>
                <button type="button" className="sort-button" onClick={() => toggleSort('updatedAt')}>
                  Updated{sortIndicator('updatedAt')}
                </button>
              </th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>Loading...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <p>No test cases found.</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="clickable-row"
                  onClick={(event) => {
                    // Let links and buttons (Edit/Delete) handle their own
                    // clicks; only navigate to the detail page otherwise.
                    if (event.target.closest('a, button')) return
                    navigate(`/test-cases/${item.id}`)
                  }}
                >
                  <td>
                    <Link to={`/test-cases/${item.id}`} className="row-title-link">
                      {item.title}
                    </Link>
                  </td>
                  <td>
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td>{item.status}</td>
                  <td className="data-readout">{new Date(item.updatedAt).toLocaleString()}</td>
                  <td className="row-actions">
                    <button type="button" onClick={() => navigate(`/test-cases/${item.id}/edit`)}>
                      Edit
                    </button>
                    <button type="button" className="danger" onClick={() => handleDelete(item.id, item.title)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="test-cases-pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages} ({total} total)
        </span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
          Next
        </button>
      </div>
    </section>
  )
}

export default TestCasesListPage
