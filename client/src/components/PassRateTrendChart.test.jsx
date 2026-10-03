import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import PassRateTrendChart from './PassRateTrendChart.jsx'

// The chart's own y-axis always renders fixed 0/25/50/75/100% gridline
// ticks, so a data value can legitimately coincide with one of them —
// these tests query by class (.chart-value-label vs .chart-axis-label,
// set in the component) rather than by bare text, to tell "a real data
// value" apart from "the axis just happens to say the same number".
function valueLabels(container) {
  return [...container.querySelectorAll('.chart-value-label')].map((el) => el.textContent)
}

function axisLabels(container) {
  return [...container.querySelectorAll('.chart-axis-label')].map((el) => el.textContent)
}

const RUNS = [
  { runId: 1, suiteName: 'Account Flows Suite', startTime: '2026-09-10T06:00:00.000Z', passRate: 100 },
  { runId: 2, suiteName: 'Account Flows Suite', startTime: '2026-09-12T06:00:00.000Z', passRate: null },
  { runId: 3, suiteName: 'Account Flows Suite', startTime: '2026-09-17T06:23:23.219Z', passRate: 60 },
]

describe('PassRateTrendChart', () => {
  afterEach(() => cleanup())

  test('shows an empty state instead of an empty chart when there are no runs', () => {
    render(<PassRateTrendChart runs={[]} />)
    expect(screen.getByText('No test runs yet.')).toBeTruthy()
  })

  test('renders a value label for every run with a real pass rate, and none for the null one', () => {
    const { container } = render(<PassRateTrendChart runs={RUNS} />)
    // 3 runs, but only 2 have a real rate — a null run gets no value label.
    expect(valueLabels(container)).toEqual(['100%', '60%'])
  })

  test('a null pass rate never produces a fabricated 0% (or any) value label', () => {
    const { container } = render(<PassRateTrendChart runs={RUNS} />)
    expect(valueLabels(container)).not.toContain('0%')
    expect(valueLabels(container).length).toBe(2)
  })

  test('a null-rate point\'s SVG title says "No data yet", not a fabricated value', () => {
    const { container } = render(<PassRateTrendChart runs={RUNS} />)
    const titles = [...container.querySelectorAll('circle title')].map((el) => el.textContent)
    expect(titles.some((text) => text.includes('No data yet'))).toBe(true)
    expect(titles.some((text) => text.includes('60%'))).toBe(true)
  })

  test('shows a "no data" legend entry only when some run actually has a null rate', () => {
    const { container, rerender } = render(<PassRateTrendChart runs={RUNS} />)
    const legendText = () => [...container.querySelectorAll('.chart-legend li')].map((li) => li.textContent).join(' | ')

    expect(legendText()).toMatch(/No data/)

    rerender(<PassRateTrendChart runs={RUNS.filter((run) => run.passRate !== null)} />)
    expect(legendText()).not.toMatch(/No data/)
  })

  test('the y-axis is always fixed at 0/25/50/75/100%, regardless of the actual data range', () => {
    const { container } = render(
      <PassRateTrendChart runs={[{ runId: 1, suiteName: 'Suite', startTime: '2026-09-10T06:00:00.000Z', passRate: 42 }]} />
    )
    // Axis ticks plus one x-axis date label share the same class, so just
    // assert every expected percentage tick is present among them.
    const labels = axisLabels(container)
    for (const tick of ['0%', '25%', '50%', '75%', '100%']) {
      expect(labels).toContain(tick)
    }
  })

  test('a single run is still rendered without dividing by zero', () => {
    const { container } = render(
      <PassRateTrendChart runs={[{ runId: 1, suiteName: 'Suite', startTime: '2026-09-10T06:00:00.000Z', passRate: 90 }]} />
    )
    expect(valueLabels(container)).toEqual(['90%'])
  })

  test('thins the x-axis date labels once there are more than 6 runs, so they never crowd or overlap', () => {
    // Midday UTC, one calendar day apart, so the exact local-timezone
    // formatting doesn't matter — only that the first/last labels below
    // are derived with the identical toLocaleDateString call the
    // component itself uses, not a hardcoded date string.
    const tenRuns = Array.from({ length: 10 }, (_, i) => ({
      runId: i + 1,
      suiteName: 'Suite',
      startTime: new Date(Date.UTC(2026, 0, i + 1, 12)).toISOString(),
      passRate: 50,
    }))
    const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })

    const { container } = render(<PassRateTrendChart runs={tenRuns} />)

    // 5 fixed percentage gridline ticks (0/25/50/75/100%) always render —
    // everything else with the axis-label class is an x-axis date label.
    const dateLabels = [...container.querySelectorAll('.chart-axis-label')]
      .map((el) => el.textContent)
      .filter((text) => !text.endsWith('%'))
    expect(dateLabels.length).toBeLessThanOrEqual(6)
    expect(dateLabels.length).toBeGreaterThan(1)

    // The first and last run's dates must always survive the thinning.
    expect(dateLabels[0]).toBe(formatDate(tenRuns[0].startTime))
    expect(dateLabels[dateLabels.length - 1]).toBe(formatDate(tenRuns[9].startTime))
  })
})
