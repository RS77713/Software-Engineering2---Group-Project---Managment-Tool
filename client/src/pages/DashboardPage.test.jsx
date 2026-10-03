import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import DashboardPage from './DashboardPage.jsx'

vi.mock('../api/dashboard.js', () => ({
  getDashboardMetrics: vi.fn(),
  getDashboardTrends: vi.fn(),
}))

import { getDashboardMetrics, getDashboardTrends } from '../api/dashboard.js'

const metrics = {
  totalTestCases: 5,
  totalSuites: 2,
  totalRuns: 3,
  passRate: 75,
  averageRunDurationSeconds: 125,
  recentRuns: [
    { id: 9, suiteName: 'Authentication', status: 'failed', passCount: 3, failCount: 1, skipCount: 0 },
  ],
}

const trends = {
  passRateTrend: [
    { runId: 9, suiteName: 'Authentication', startTime: '2026-09-17T06:23:23.219Z', passRate: 75 },
  ],
  testCasesByStatus: [
    { status: 'draft', count: 1 },
    { status: 'ready', count: 2 },
    { status: 'passed', count: 1 },
    { status: 'failed', count: 1 },
    { status: 'skipped', count: 0 },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    getDashboardMetrics.mockResolvedValue(metrics)
    getDashboardTrends.mockResolvedValue(trends)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  test('shows the core metrics and a recent run', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Recent Test Runs' })
    expect(screen.getByText('Total Test Cases').nextElementSibling.textContent).toBe('5')
    expect(screen.getByText('Test Suites').nextElementSibling.textContent).toBe('2')
    expect(screen.getByText('Test Runs').nextElementSibling.textContent).toBe('3')
    expect(screen.getByText('Pass Rate').nextElementSibling.textContent).toBe('75%')
    expect(screen.getByText('Avg. Run Duration').nextElementSibling.textContent).toBe('2m 5s')
    expect(screen.getByRole('link', { name: 'Authentication' }).getAttribute('href')).toBe('/test-runs/9')
  })

  test('shows empty-state actions when no data exists yet', async () => {
    getDashboardMetrics.mockResolvedValue({
      totalTestCases: 0,
      totalSuites: 0,
      totalRuns: 0,
      passRate: null,
      averageRunDurationSeconds: null,
      recentRuns: [],
    })
    getDashboardTrends.mockResolvedValue({
      passRateTrend: [],
      testCasesByStatus: trends.testCasesByStatus.map((entry) => ({ ...entry, count: 0 })),
    })

    renderPage()

    expect(await screen.findAllByText('No test runs yet.')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Create your first test case' }).getAttribute('href')).toBe('/test-cases/new')
    expect(screen.getAllByRole('link', { name: 'Start a test run' })).toHaveLength(2)
    expect(screen.getByText('No test cases yet.')).toBeTruthy()
  })

  test('surfaces API failures', async () => {
    getDashboardMetrics.mockRejectedValue(new Error('metrics unavailable'))
    getDashboardTrends.mockRejectedValue(new Error('trends unavailable'))
    renderPage()

    expect(await screen.findByText('metrics unavailable')).toBeTruthy()
    expect(await screen.findByText('trends unavailable')).toBeTruthy()
  })
})
