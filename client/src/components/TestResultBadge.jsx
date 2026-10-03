const RESULT_COLORS = {
  pending: 'var(--text-muted)',
  passed: 'var(--color-success)',
  failed: 'var(--color-danger)',
  skipped: 'var(--color-warning)',
}

function TestResultBadge({ result }) {
  const color = RESULT_COLORS[result] ?? 'var(--text-muted)'
  return (
    <span className="badge" style={{ color }}>
      {result}
    </span>
  )
}

export default TestResultBadge
