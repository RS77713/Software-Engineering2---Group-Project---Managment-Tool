import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import TestCaseStatusDonutChart from './TestCaseStatusDonutChart.jsx'

const STATUSES = [
  { status: 'draft', count: 3 },
  { status: 'ready', count: 2 },
  { status: 'passed', count: 1 },
  { status: 'failed', count: 1 },
  { status: 'skipped', count: 0 },
]

describe('TestCaseStatusDonutChart', () => {
  afterEach(() => cleanup())

  test('shows an empty state when every status has a zero count', () => {
    render(<TestCaseStatusDonutChart statuses={STATUSES.map((entry) => ({ ...entry, count: 0 }))} />)
    expect(screen.getByText('No test cases yet.')).toBeTruthy()
  })

  test('the legend lists every status, including one with a zero count, with its share of the total', () => {
    const { container } = render(<TestCaseStatusDonutChart statuses={STATUSES} />)
    // Read each <li> directly rather than a document-wide text search — a
    // regex substring match would otherwise also match the parent <ul>,
    // whose combined text contains every line concatenated together.
    const legendItems = [...container.querySelectorAll('.chart-legend li')].map((li) => li.textContent)
    expect(legendItems).toContain('Skipped: 0 (0%)')
    expect(legendItems).toContain('Draft: 3 (43%)')
    expect(legendItems).toContain('Ready: 2 (29%)')
  })

  test('shows the grand total in the center of the donut', () => {
    render(<TestCaseStatusDonutChart statuses={STATUSES} />)
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('test cases')).toBeTruthy()
  })

  test('uses the singular "test case" label when the total is exactly 1', () => {
    render(
      <TestCaseStatusDonutChart
        statuses={[
          { status: 'draft', count: 1 },
          { status: 'ready', count: 0 },
          { status: 'passed', count: 0 },
          { status: 'failed', count: 0 },
          { status: 'skipped', count: 0 },
        ]}
      />
    )
    expect(screen.getByText('test case')).toBeTruthy()
  })
})
