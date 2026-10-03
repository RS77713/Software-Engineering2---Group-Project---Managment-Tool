import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import TestCasesListPage from './TestCasesListPage.jsx'

// getExportTestCasesUrl is left as the REAL implementation (not mocked) —
// this is exactly what's under test: that the "Download CSV" link's href
// stays in sync with the page's actual current filter/sort state.
vi.mock('../api/test-cases.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    listTestCases: vi.fn(),
    deleteTestCase: vi.fn(),
    getSuitesForTestCase: vi.fn(),
  }
})

import { listTestCases } from '../api/test-cases.js'

const ONE_ITEM_PAGE = {
  items: [
    { id: 1, title: 'Login with valid credentials [Authentication]', severity: 'Critical', status: 'ready', updatedAt: '2026-09-10T06:00:00.000Z' },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/test-cases']}>
      <Routes>
        <Route path="/test-cases" element={<TestCasesListPage />} />
      </Routes>
    </MemoryRouter>
  )
}

function downloadLink() {
  return screen.getByRole('link', { name: 'Download CSV' })
}

describe('TestCasesListPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  test('renders the loading state, then the items once loaded', async () => {
    listTestCases.mockResolvedValue(ONE_ITEM_PAGE)
    renderPage()

    expect(screen.getByText('Loading...')).toBeTruthy()
    await screen.findByText('Login with valid credentials [Authentication]')
  })

  test('shows an empty state when there are no matches', async () => {
    listTestCases.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 })
    renderPage()

    await screen.findByText('No test cases found.')
  })

  test('an API error is shown without crashing the page', async () => {
    listTestCases.mockRejectedValue(new Error('network unreachable'))
    renderPage()

    await screen.findByText('network unreachable')
  })

  test('defaults to id ascending (creation order) on first load, for both the list request and the Download CSV link', async () => {
    listTestCases.mockResolvedValue(ONE_ITEM_PAGE)
    renderPage()
    await screen.findByText('Login with valid credentials [Authentication]')

    expect(listTestCases).toHaveBeenCalledWith(expect.objectContaining({ sort: 'id', order: 'asc' }))

    const href = downloadLink().getAttribute('href')
    const params = new URLSearchParams(href.split('?')[1])
    expect(href.startsWith('/api/test-cases/export')).toBe(true)
    expect(params.get('status')).toBeNull()
    expect(params.get('search')).toBeNull()
    expect(params.get('sort')).toBe('id')
    expect(params.get('order')).toBe('asc')
  })

  test('the Download CSV link picks up the active status filter and (debounced) search text', async () => {
    listTestCases.mockResolvedValue(ONE_ITEM_PAGE)
    renderPage()
    await screen.findByText('Login with valid credentials [Authentication]')

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'ready' } })
    fireEvent.change(screen.getByLabelText('Search test cases by title'), { target: { value: 'Login' } })

    await waitFor(() => {
      const params = new URLSearchParams(downloadLink().getAttribute('href').split('?')[1])
      expect(params.get('status')).toBe('ready')
      expect(params.get('search')).toBe('Login')
    })
  })

  test('the Download CSV link picks up the active sort/order after clicking a sortable column', async () => {
    listTestCases.mockResolvedValue(ONE_ITEM_PAGE)
    renderPage()
    await screen.findByText('Login with valid credentials [Authentication]')

    fireEvent.click(screen.getByText('Severity', { exact: false }))

    await waitFor(() => {
      const params = new URLSearchParams(downloadLink().getAttribute('href').split('?')[1])
      expect(params.get('sort')).toBe('severity')
      expect(params.get('order')).toBe('asc')
    })
  })

  test('the "Download CSV" link is a real download link, alongside "+ New test case" and "Import CSV"', async () => {
    listTestCases.mockResolvedValue(ONE_ITEM_PAGE)
    renderPage()
    await screen.findByText('Login with valid credentials [Authentication]')

    expect(downloadLink().hasAttribute('download')).toBe(true)
    expect(screen.getByRole('link', { name: '+ New test case' }).getAttribute('href')).toBe('/test-cases/new')
    expect(screen.getByRole('link', { name: 'Import CSV' }).getAttribute('href')).toBe('/test-cases/import')
  })
})
