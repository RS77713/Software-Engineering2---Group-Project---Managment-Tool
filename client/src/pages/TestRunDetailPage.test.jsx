import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import TestRunDetailPage from './TestRunDetailPage.jsx'

vi.mock('../api/test-runs.js', () => ({
  getTestRun: vi.fn(),
  updateTestRunResult: vi.fn(),
}))

import { getTestRun, updateTestRunResult } from '../api/test-runs.js'

const sampleRun = {
  id: 7,
  suiteId: 1,
  suiteName: 'Account Flows Suite',
  status: 'in-progress',
  passCount: 0,
  failCount: 0,
  skipCount: 0,
  createdBy: 'EM',
  results: [
    {
      id: 101,
      runId: 7,
      testCaseId: 5,
      testCaseTitle: 'Login with valid credentials',
      severity: 'Critical',
      result: 'pending',
      durationMs: null,
      notes: null,
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/test-runs/7']}>
      <Routes>
        <Route path="/test-runs/:id" element={<TestRunDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TestRunDetailPage', () => {
  beforeEach(() => getTestRun.mockResolvedValue(sampleRun))

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  test('shows the snapshotted test cases and execution controls', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Account Flows Suite' })
    expect(screen.getByRole('link', { name: 'Login with valid credentials' }).getAttribute('href')).toBe('/test-cases/5')
    expect(screen.getByRole('button', { name: 'Passed' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Failed' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skipped' })).toBeTruthy()
  })

  test('saves an outcome with trimmed notes and refreshes the run', async () => {
    updateTestRunResult.mockResolvedValue({
      ...sampleRun,
      status: 'failed',
      failCount: 1,
      results: [{ ...sampleRun.results[0], result: 'failed', notes: 'Observed on Safari' }],
    })
    const { container } = renderPage()

    await screen.findByRole('heading', { name: 'Account Flows Suite' })
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '  Observed on Safari  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Failed' }))

    await waitFor(() =>
      expect(updateTestRunResult).toHaveBeenCalledWith('7', 101, {
        result: 'failed',
        notes: 'Observed on Safari',
      })
    )
    expect(container.querySelector('.run-meta-line').textContent).toContain('0 passed, 1 failed')
  })
})
