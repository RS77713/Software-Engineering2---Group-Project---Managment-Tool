/* eslint-disable react/set-state-in-effect -- Reset read state when the route or explicit refresh changes. */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listBugs, severities, transitions } from '../api/bugs.js'
import '../styles/test-cases.css'
export default function BugsListPage() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    setData(null); setError('')
    listBugs(Object.fromEntries(params)).then((d) => { if (active) setData(d) }).catch((e) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [params, refresh])
  function filter(name, value) { const next = new URLSearchParams(params); if (value) next.set(name, value); else next.delete(name); next.delete('page'); setParams(next) }
  return <section className="test-cases-page"><h1 className="page-title">Bugs</h1>
    <div className="test-cases-toolbar">
      <label>Search title<input type="search" value={params.get('search') || ''} onChange={(e) => filter('search', e.target.value)} /></label>
      {[['status', Object.keys(transitions)], ['severity', severities], ['sort', ['id', 'severity', 'updatedAt']], ['order', ['asc', 'desc']]].map(([name, values]) => <label key={name}>{name}<select value={params.get(name) || ''} onChange={(e) => filter(name, e.target.value)}><option value="">{name === 'status' || name === 'severity' ? 'All' : 'Default'}</option>{values.map((v) => <option key={v}>{v}</option>)}</select></label>)}
    </div>
    {params.get('sourceResultId') && <p>Source result #{params.get('sourceResultId')}</p>}
    <button onClick={() => setRefresh((n) => n + 1)}>Refresh bugs</button>
    {error ? <p role="alert" className="error">Read failed: {error}</p> : !data ? <p role="status">Loading bugs…</p> : <>
      {!data.items.length ? <p>No bugs found.</p> : <ul>{data.items.map((b) => <li key={b.id}><Link to={`/bugs/${b.id}`}>#{b.id} {b.title}</Link> — {b.severity}, {b.status}</li>)}</ul>}
      <p>Page {data.page} of {data.totalPages} ({data.total} bugs)</p>
      <button disabled={data.page <= 1} onClick={() => setParams({ ...Object.fromEntries(params), page: data.page - 1 })}>Previous</button>
      <button disabled={data.page >= data.totalPages} onClick={() => setParams({ ...Object.fromEntries(params), page: data.page + 1 })}>Next</button>
    </>}
  </section>
}
