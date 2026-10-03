import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import TestSuiteDetailPage from './TestSuiteDetailPage.jsx'

// Focused regression test for QA finding #1: cancelling a suite edit must
// not leave the discarded draft sitting in the fields for the next time
// the edit form is opened.
vi.mock('../api/suites.js', () => ({
  getSuite: vi.fn(),
  updateSuite: vi.fn(),
  deleteSuite: vi.fn(),
  addCaseToSuite: vi.fn(),
  removeCaseFromSuite: vi.fn(),
  reorderSuiteCases: vi.fn(),
}))
vi.mock('../api/test-cases.js', () => ({
  listTestCases: vi.fn(),
}))

import { getSuite } from '../api/suites.js'
import { listTestCases } from '../api/test-cases.js'

const SAMPLE_SUITE = {
  id: 1,
  name: 'Original Name',
  feature: 'Original Feature',
  status: 'ready',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  cases: [],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/test-suites/1']}>
      <Routes>
        <Route path="/test-suites/:id" element={<TestSuiteDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TestSuiteDetailPage — edit/cancel', () => {
  beforeEach(() => {
    getSuite.mockResolvedValue(SAMPLE_SUITE)
    listTestCases.mockResolvedValue({ items: [] })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  test('cancelling an edit does not leak the discarded draft into the next edit session', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Original Name' })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Discarded Name' } })
    fireEvent.change(screen.getByLabelText('Feature'), { target: { value: 'Discarded Feature' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    // Reopen the form — it must show the suite's real values, not the
    // cancelled draft from a moment ago.
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Name').value).toBe('Original Name')
    expect(screen.getByLabelText('Feature').value).toBe('Original Feature')
  })

  test('an in-progress draft is also reset the moment Cancel is clicked, before reopening', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Original Name' })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Discarded Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    // Back in the read-only header view: the suite's displayed name must
    // be untouched by the discarded draft.
    expect(screen.getByRole('heading', { name: 'Original Name' })).toBeTruthy()
  })
})
