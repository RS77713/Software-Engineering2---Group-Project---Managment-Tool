// Hand-rolled inline SVG donut, built from stroke-dasharray/-dashoffset
// segments on a single circle — see the "why no chart library" note in
// DashboardPage.jsx. Colors mirror the same statuses' colors everywhere
// else in the app (SuiteStatusBadge, TestResultBadge), so a status means
// the same color on every page.
const STATUS_COLORS = {
  draft: '#64748b',
  ready: '#2563eb',
  passed: '#16a34a',
  failed: '#dc2626',
  skipped: '#ca8a04',
}
const STATUS_LABELS = {
  draft: 'Draft',
  ready: 'Ready',
  passed: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
}

const SIZE = 200
const RADIUS = 74
const STROKE_WIDTH = 30
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const CENTER = SIZE / 2

function TestCaseStatusDonutChart({ statuses }) {
  const total = statuses.reduce((sum, entry) => sum + entry.count, 0)

  if (total === 0) {
    return <p className="chart-empty">No test cases yet.</p>
  }

  const segments = statuses
    .filter((entry) => entry.count > 0)
    .reduce((accumulated, entry) => {
      const previous = accumulated[accumulated.length - 1]
      const offset = previous ? previous.offset + previous.length : 0
      const fraction = entry.count / total
      const length = fraction * CIRCUMFERENCE
      return [...accumulated, { status: entry.status, count: entry.count, fraction, length, offset }]
    }, [])

  return (
    <div className="chart chart-donut">
      <div className="chart-donut-figure">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Test cases by status" className="chart-svg chart-svg-donut">
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--border, #e2e8f0)" strokeWidth={STROKE_WIDTH} />
          {segments.map((segment) => (
            <circle
              key={segment.status}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={STATUS_COLORS[segment.status]}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${segment.length} ${CIRCUMFERENCE - segment.length}`}
              strokeDashoffset={-segment.offset}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            >
              <title>
                {STATUS_LABELS[segment.status]}: {segment.count} ({Math.round(segment.fraction * 100)}%)
              </title>
            </circle>
          ))}
          <text x={CENTER} y={CENTER - 6} textAnchor="middle" className="chart-donut-total-value">
            {total}
          </text>
          <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="chart-axis-label">
            test case{total === 1 ? '' : 's'}
          </text>
        </svg>
      </div>

      <ul className="chart-legend chart-legend-donut">
        {statuses.map((entry) => (
          <li key={entry.status}>
            <span className="chart-legend-swatch" style={{ background: STATUS_COLORS[entry.status] }} />
            {STATUS_LABELS[entry.status]}: {entry.count} ({total > 0 ? Math.round((entry.count / total) * 100) : 0}%)
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TestCaseStatusDonutChart
