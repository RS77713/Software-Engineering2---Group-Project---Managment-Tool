import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import TestCaseImportPage from './TestCaseImportPage.jsx'

vi.mock('../api/test-cases.js', () => ({
  importTestCases: vi.fn(),
}))

import { importTestCases } from '../api/test-cases.js'

const PREVIEW_MIXED = {
  totalRows: 3,
  committed: false,
  rows: [
    { rowNumber: 2, title: 'Login with valid credentials [Auth]', valid: true, errors: [], duplicate: null, imported: false },
    { rowNumber: 3, title: 'No brackets here', valid: false, errors: ['title must end with the feature area in square brackets'], duplicate: null, imported: false },
    {
      rowNumber: 4,
      title: 'Login with valid credentials [Auth]',
      valid: true,
      errors: [],
      duplicate: { reason: 'duplicate-in-file', firstRowNumber: 2 },
      imported: false,
    },
  ],
  summary: { imported: 0, invalid: 1, duplicate: 1 },
}

const COMMIT_RESULT = {
  totalRows: 3,
  committed: true,
  rows: [
    { rowNumber: 2, title: 'Login with valid credentials [Auth]', valid: true, errors: [], duplicate: null, imported: true },
    { rowNumber: 3, title: 'No brackets here', valid: false, errors: ['title must end with the feature area in square brackets'], duplicate: null, imported: false },
    {
      rowNumber: 4,
      title: 'Login with valid credentials [Auth]',
      valid: true,
      errors: [],
      duplicate: { reason: 'duplicate-in-file', firstRowNumber: 2 },
      imported: false,
    },
  ],
  summary: { imported: 1, invalid: 1, duplicate: 1 },
}

function csvFile(content = 'title,severity,steps,expected_result\n"A [X]",Critical,"Step.",Works.\n') {
  return new File([content], 'test-cases.csv', { type: 'text/csv' })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/test-cases/import']}>
      <Routes>
        <Route path="/test-cases/import" element={<TestCaseImportPage />} />
      </Routes>
    </MemoryRouter>
  )
}

function fileInput() {
  return document.querySelector('input[type="file"]')
}

describe('TestCaseImportPage', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  test('selecting a file previews it automatically, showing each row\'s status', async () => {
    importTestCases.mockResolvedValue(PREVIEW_MIXED)
    renderPage()

    fireEvent.change(fileInput(), { target: { files: [csvFile()] } })

    await screen.findByText('Ready')
    expect(screen.getByText('Invalid')).toBeTruthy()
    expect(screen.getByText('Duplicate')).toBeTruthy()
    expect(screen.getByText('title must end with the feature area in square brackets')).toBeTruthy()
    expect(screen.getByText('Duplicate of row 2 in this file.')).toBeTruthy()

    expect(importTestCases).toHaveBeenCalledWith(expect.stringContaining('title,severity,steps,expected_result'), {
      commit: false,
    })
  })

  test('the confirm button counts only rows that are both valid and non-duplicate, and disables at zero', async () => {
    importTestCases.mockResolvedValue(PREVIEW_MIXED)
    renderPage()

    fireEvent.change(fileInput(), { target: { files: [csvFile()] } })

    const confirmButton = await screen.findByRole('button', { name: 'Confirm import (1)' })
    expect(confirmButton.disabled).toBe(false)
  })

  test('confirming import calls the API with commit: true and shows the resulting summary', async () => {
    importTestCases.mockResolvedValueOnce(PREVIEW_MIXED)
    renderPage()

    fireEvent.change(fileInput(), { target: { files: [csvFile()] } })
    const confirmButton = await screen.findByRole('button', { name: 'Confirm import (1)' })

    importTestCases.mockResolvedValueOnce(COMMIT_RESULT)
    fireEvent.click(confirmButton)

    await screen.findByText('Imported')
    expect(importTestCases.mock.calls[1][1]).toEqual({ commit: true })
    expect(screen.getByText('1 imported, 1 invalid, 1 duplicate skipped')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Done — back to test cases' })).toBeTruthy()
    // Once committed, there is no more "confirm" action to take.
    expect(screen.queryByRole('button', { name: /Confirm import/ })).toBeNull()
  })

  test('a preview request that fails shows the error banner, not a crash, and no table', async () => {
    importTestCases.mockRejectedValue(new Error('csv is required'))
    renderPage()

    fireEvent.change(fileInput(), { target: { files: [csvFile()] } })

    await screen.findByText('csv is required')
    expect(screen.queryByRole('table')).toBeNull()
  })

  test('a commit request that fails shows the error banner and keeps the preview table on screen', async () => {
    importTestCases.mockResolvedValueOnce(PREVIEW_MIXED)
    renderPage()

    fireEvent.change(fileInput(), { target: { files: [csvFile()] } })
    const confirmButton = await screen.findByRole('button', { name: 'Confirm import (1)' })

    importTestCases.mockRejectedValueOnce(new Error('network unreachable'))
    fireEvent.click(confirmButton)

    await screen.findByText('network unreachable')
    // The preview table from before the failed commit must still be visible.
    expect(screen.getByText('Ready')).toBeTruthy()
  })

  test('the format-help block explains the required headers and the steps-cell format', () => {
    importTestCases.mockResolvedValue(PREVIEW_MIXED)
    renderPage()

    expect(screen.getAllByText('expected_result').length).toBeGreaterThan(0)
    expect(screen.getByText(/one step per line/i)).toBeTruthy()
  })
})
