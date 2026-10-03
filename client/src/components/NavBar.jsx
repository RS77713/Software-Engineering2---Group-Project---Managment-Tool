import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import '../styles/nav.css'

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/test-cases', label: 'Test Cases' },
  { to: '/test-suites', label: 'Test Suites' },
  { to: '/test-runs', label: 'Test Runs' },
]

function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <NavLink to="/" className="app-brand" onClick={() => setMenuOpen(false)} aria-label="QA Management Tool home">
          <img src="/favicon.svg" alt="" aria-hidden="true" className="app-brand-logo" />
        </NavLink>

        <button
          type="button"
          className="app-nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="app-nav-links"
          aria-label="Toggle navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="app-nav-toggle-bar" aria-hidden="true" />
          <span className="app-nav-toggle-bar" aria-hidden="true" />
          <span className="app-nav-toggle-bar" aria-hidden="true" />
        </button>

        <nav className="app-nav" aria-label="Main">
          <ul id="app-nav-links" className={menuOpen ? 'app-nav-links open' : 'app-nav-links'}>
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

export default NavBar
