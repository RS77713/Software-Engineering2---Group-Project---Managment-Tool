// Suite status is a separate value set from test case severity/status
// (draft, ready, in-progress, passed, failed) — colored the same
// border+text way so it stays readable in both light and dark mode.
const STATUS_COLORS = {
  draft: 'var(--text-muted)',
  ready: 'var(--color-info)',
  'in-progress': 'var(--color-warning)',
  passed: 'var(--color-success)',
  failed: 'var(--color-danger)',
}

function SuiteStatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? 'var(--text-muted)'
  return (
    <span className="badge" style={{ color }}>
      {status}
    </span>
  )
}

export default SuiteStatusBadge
