/* eslint-disable react/only-export-components -- Shared field validation is also exercised directly at Unicode boundaries. */
import { severities } from '../api/bugs.js'
export const descriptionFor = (d) => `Steps: ${d.steps.trim()}\nExpected: ${d.expected.trim()}\nActual: ${d.actual.trim()}`
export function validateBug(d, create = false) {
  const errors = {}
  if (!d.title.trim() || [...d.title.trim()].length > 200) errors.title = 'Enter a title of 1–200 characters.'
  if (!severities.includes(d.severity)) errors.severity = 'Select a severity.'
  if (create) {
    for (const name of ['steps', 'expected', 'actual']) if (!d[name].trim()) errors[name] = `${name === 'steps' ? 'Steps to reproduce' : name === 'expected' ? 'Expected result' : 'Actual result'} is required.`
  }
  const description = create ? descriptionFor(d) : d.description.trim()
  if (!description || [...description].length > 5000) errors[create ? 'steps' : 'description'] = 'Reproduction details must fit within 5,000 characters.'
  return errors
}
export function focusError(errors) { document.getElementById(`bug-${Object.keys(errors)[0]}`)?.focus() }
export default function BugFields({ value, onChange, errors = {}, create = false, disabled = false }) {
  const fields = [['title', 'Title', false], ...(create ? [['steps', 'Steps to reproduce', true], ['expected', 'Expected result', true], ['actual', 'Actual result', true]] : [['description', 'Description', true]]), ['severity', 'Severity', false]]
  return <fieldset disabled={disabled}><legend>Bug details (all fields required)</legend>{fields.map(([name, label, multiline]) => <div key={name}><label htmlFor={`bug-${name}`}>
    {label} (required)
    {name === 'severity' ? <select id={`bug-${name}`} required value={value[name]} onChange={(e) => onChange(name, e.target.value)} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : undefined}>
      <option value="">Select severity</option>{severities.map((s) => <option key={s}>{s}</option>)}
    </select> : multiline ? <textarea id={`bug-${name}`} required rows={3} value={value[name]} onChange={(e) => onChange(name, e.target.value)} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : undefined} /> :
      <input id={`bug-${name}`} required value={value[name]} onChange={(e) => onChange(name, e.target.value)} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : undefined} />}
    </label>{errors[name] && <span className="error" id={`error-${name}`}>{errors[name]}</span>}
  </div>)}</fieldset>
}
