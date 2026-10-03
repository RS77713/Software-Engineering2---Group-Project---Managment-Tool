// Hand-rolled inline SVG line chart — see the "why no chart library" note
// in DashboardPage.jsx. Scale is fixed at 0-100%; a null passRate (a run
// with nothing executed yet) breaks the line rather than being drawn as 0.
const WIDTH = 520
const HEIGHT = 280
const MARGIN = { top: 30, right: 16, bottom: 34, left: 46 }
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom
const GRID_VALUES = [0, 25, 50, 75, 100]
// The app's shared brand accent (index.css's --accent) — falls back to its
// light-theme hex if the variable somehow isn't available.
const LINE_COLOR = 'var(--accent, #0f766e)'
const NO_DATA_COLOR = '#94a3b8'
// Caps how many x-axis date labels are drawn — beyond this, labels start
// crowding each other at any screen size (the SVG scales uniformly, so
// overlap in these viewBox units means overlap everywhere). Always
// includes the first and last point, evenly thinning the rest.
const MAX_X_LABELS = 6
// Minimum gap, in data-point indices, enforced between any two shown
// labels (see xLabelIndices) — without this, evenly distributing
// MAX_X_LABELS across a count that doesn't divide evenly can round two
// picks (often the guaranteed-last one and its neighbor) right next to
// each other, crowding those two labels together instead of spacing all
// of them out.
const MIN_X_LABEL_GAP = 2

function xForIndex(index, count) {
  if (count <= 1) return MARGIN.left + PLOT_WIDTH / 2
  return MARGIN.left + (index / (count - 1)) * PLOT_WIDTH
}

function yForValue(value) {
  return MARGIN.top + PLOT_HEIGHT - (value / 100) * PLOT_HEIGHT
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
}

// The data-point indices to draw an x-axis label at. Always includes the
// first and last point; interior points are evenly spaced between them,
// skipping any candidate that would land too close to its neighbor or to
// the guaranteed last point.
function xLabelIndices(count) {
  if (count <= MAX_X_LABELS) return Array.from({ length: count }, (_, i) => i)

  const indices = [0]
  const step = (count - 1) / (MAX_X_LABELS - 1)
  for (let i = 1; i < MAX_X_LABELS - 1; i++) {
    const candidate = Math.round(i * step)
    if (candidate - indices[indices.length - 1] < MIN_X_LABEL_GAP) continue
    if (count - 1 - candidate < MIN_X_LABEL_GAP) continue
    indices.push(candidate)
  }
  indices.push(count - 1)
  return indices
}

function shouldShowXLabel(index, count) {
  return xLabelIndices(count).includes(index)
}

function PassRateTrendChart({ runs }) {
  if (runs.length === 0) {
    return <p className="chart-empty">No test runs yet.</p>
  }

  const hasMissingData = runs.some((run) => run.passRate === null)

  // Split into contiguous segments of non-null points — a null value
  // breaks the line instead of being treated as 0 or interpolated over.
  const segments = []
  let current = []
  runs.forEach((run, index) => {
    if (run.passRate === null) {
      if (current.length > 0) segments.push(current)
      current = []
      return
    }
    current.push({ index, value: run.passRate })
  })
  if (current.length > 0) segments.push(current)

  const linePaths = segments.map(
    (segment) =>
      segment
        .map((point, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(point.index, runs.length)} ${yForValue(point.value)}`)
        .join(' ')
  )

  // Same points as linePaths, closed down to the 0% baseline and back —
  // purely a decorative fill under the line, drawn behind it. Every point,
  // label, and tooltip stays exactly as linePaths already defines them;
  // this is an additional, separate path, not a change to the line itself.
  const areaPaths = segments.map((segment) => {
    const first = xForIndex(segment[0].index, runs.length)
    const last = xForIndex(segment[segment.length - 1].index, runs.length)
    const baselineY = yForValue(0)
    const linePoints = segment.map((point) => `${xForIndex(point.index, runs.length)} ${yForValue(point.value)}`)
    return `M ${first} ${baselineY} L ${linePoints.join(' L ')} L ${last} ${baselineY} Z`
  })

  return (
    <div className="chart">
      <div className="chart-plot">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Pass rate for the latest ${runs.length} test runs, oldest to newest`}
          className="chart-svg"
        >
          <defs>
            <linearGradient id="pass-rate-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent, #0f766e)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--accent, #0f766e)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {GRID_VALUES.map((value) => (
            <g key={value}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yForValue(value)}
                y2={yForValue(value)}
                stroke="var(--border, #e2e8f0)"
                strokeWidth="1"
              />
              <text x={MARGIN.left - 8} y={yForValue(value)} textAnchor="end" dominantBaseline="middle" className="chart-axis-label">
                {value}%
              </text>
            </g>
          ))}

          {areaPaths.map((d, i) => (
            <path key={i} d={d} fill="url(#pass-rate-area-fill)" stroke="none" />
          ))}

          {linePaths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={LINE_COLOR} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {runs.map((run, index) => {
            const x = xForIndex(index, runs.length)
            const hasValue = run.passRate !== null
            return (
              <g key={run.runId}>
                <circle
                  cx={x}
                  cy={hasValue ? yForValue(run.passRate) : yForValue(0)}
                  r={hasValue ? 4.5 : 4}
                  fill={hasValue ? LINE_COLOR : 'var(--surface, #fff)'}
                  stroke={hasValue ? LINE_COLOR : NO_DATA_COLOR}
                  strokeWidth={hasValue ? 0 : 2}
                  strokeDasharray={hasValue ? undefined : '2 2'}
                >
                  <title>
                    {run.suiteName} — {formatDate(run.startTime)}: {hasValue ? `${run.passRate}%` : 'No data yet'}
                  </title>
                </circle>
                {hasValue && (
                  <text x={x} y={yForValue(run.passRate) - 12} textAnchor="middle" className="chart-value-label">
                    {run.passRate}%
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Rendered as normal HTML text, positioned by percentage, rather
            than as SVG <text> — the SVG above uses preserveAspectRatio="none"
            so it can stretch non-uniformly to fill the card, but that same
            non-uniform scale distorts/squishes SVG text horizontally,
            which was making these date labels hard to read. Plain HTML
            text isn't subject to that transform, so it stays crisp at any
            card size. Positions and dates are unchanged — same
            xForIndex/formatDate/shouldShowXLabel this chart already uses. */}
        <div className="chart-x-labels">
          {runs.map(
            (run, index) =>
              shouldShowXLabel(index, runs.length) && (
                <span
                  key={run.runId}
                  className="chart-axis-label"
                  style={{ left: `${(xForIndex(index, runs.length) / WIDTH) * 100}%` }}
                >
                  {formatDate(run.startTime)}
                </span>
              )
          )}
        </div>
      </div>

      <ul className="chart-legend">
        <li>
          <span className="chart-legend-swatch" style={{ background: LINE_COLOR }} />
          Pass rate
        </li>
        {hasMissingData && (
          <li>
            <span className="chart-legend-swatch chart-legend-swatch-hollow" style={{ borderColor: NO_DATA_COLOR }} />
            No data (nothing executed yet)
          </li>
        )}
      </ul>
    </div>
  )
}

export default PassRateTrendChart
