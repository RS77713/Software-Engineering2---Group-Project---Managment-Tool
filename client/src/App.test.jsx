import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App.jsx'

describe('App baseline navigation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: { status: 'ok' }, error: null }),
      })
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('renders the home page and the five baseline navigation links', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: 'QA Management Tool' })
    for (const name of ['Home', 'Dashboard', 'Test Cases', 'Test Suites', 'Test Runs']) {
      expect(screen.getByRole('link', { name })).toBeTruthy()
    }
  })

  test('does not advertise functionality outside the agreed baseline', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    for (const name of ['Settings', 'Bugs', 'Reports', 'Flaky Tests']) {
      expect(screen.queryByRole('link', { name })).toBeNull()
    }
  })
})
