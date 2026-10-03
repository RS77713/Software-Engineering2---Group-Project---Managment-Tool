// Colors echo SuiteStatusBadge's palette for the same-named statuses, so
// the whole app uses one consistent color language.
const STATUS_COLORS = {
  'in-progress': 'var(--color-warning)',
  passed: 'var(--color-success)',
  failed: 'var(--color-danger)',
}

function RunStatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? 'var(--text-muted)'
  return (
    <span className="badge" style={{ color }}>
      {status}
    </span>
  )
}

export default RunStatusBadge
