// Colors follow a consistent worst-to-least-severe scale, and stay readable
// in both light and dark mode since they only set a border + text color.
// Uses the app's shared status tokens (index.css); Major uses --color-major,
// a fifth "one step down from Critical" shade the shared
// info/success/warning/danger set doesn't have a slot for.
const SEVERITY_COLORS = {
  Critical: 'var(--color-danger)',
  Major: 'var(--color-major)',
  Minor: 'var(--color-warning)',
  Trivial: 'var(--text-muted)',
}

function SeverityBadge({ severity }) {
  if (severity === 'Critical') {
    return <span className="badge badge-solid">{severity}</span>
  }
  const color = SEVERITY_COLORS[severity] ?? 'var(--text-muted)'
  return (
    <span className="badge" style={{ color }}>
      {severity}
    </span>
  )
}

export default SeverityBadge
