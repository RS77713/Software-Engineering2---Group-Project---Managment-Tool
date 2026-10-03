import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test } from 'vitest'
import NavBar from './NavBar.jsx'

function renderNav(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NavBar />
    </MemoryRouter>
  )
}

function isActive(name) {
  return screen.getByRole('link', { name }).getAttribute('aria-current') === 'page'
}

describe('NavBar', () => {
  afterEach(cleanup)

  test('renders only baseline sections', () => {
    renderNav()
    for (const name of ['Home', 'Dashboard', 'Test Cases', 'Test Suites', 'Test Runs']) {
      expect(screen.getByRole('link', { name })).toBeTruthy()
    }
    for (const name of ['Settings', 'Bugs', 'Reports', 'Flaky Tests']) {
      expect(screen.queryByRole('link', { name })).toBeNull()
    }
  })

  test.each([
    ['/dashboard', 'Dashboard'],
    ['/test-cases/42', 'Test Cases'],
    ['/test-suites/7', 'Test Suites'],
    ['/test-runs/3', 'Test Runs'],
  ])('%s highlights %s', (path, expectedActive) => {
    renderNav(path)
    expect(isActive(expectedActive)).toBe(true)
    expect(isActive('Home')).toBe(false)
  })

  test('mobile menu exposes and updates its open state', () => {
    renderNav()
    const button = screen.getByRole('button', { name: 'Toggle navigation' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('link', { name: 'Test Cases' }))
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
})
