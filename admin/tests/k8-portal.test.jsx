import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import K8Portal from '../src/components/k8/K8Portal'

const snapshot = {
  success: true,
  scope: { exchange: 'coinbase', pair: 'BTC-USDC' },
  status: { isRunning: true, isDryRun: false },
  appliedLevel: 2,
  savedLevel: 2,
  fingerprint: 'a'.repeat(64),
  config: { maxUsdcDeployed: 100, maxDrawdownPercent: 20 },
  presets: {},
  metrics: {
    asset: 'BTC',
    heldAsset: 0.005,
    positionValueQuote: 480,
    realizedPnlQuote: 15.35,
    accountBalanceQuote: null,
    cyclesCompleted: 3,
    valuationNote: 'Tracked position only.',
  },
}

const reply = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
})

function setup(role) {
  window.history.replaceState({}, '', '/k8')
  const requests = vi.fn(async (url, opts) => {
    if (url === '/api/k8/session') {
      return reply(200, { success: true, authenticated: true, role,
        readonly: role === 'admin', scope: snapshot.scope })
    }
    if (url === '/api/k8/fund') return reply(200, snapshot)
    if (url === '/api/k8/fund/risk' && opts?.method === 'PUT') {
      return reply(200, { success: true, applied: true, level: 7 })
    }
    return reply(404, { success: false })
  })
  vi.stubGlobal('fetch', requests)
  render(<K8Portal />)
  return requests
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('K8 immersive animal portfolio', () => {
  it('starts on the saved animal and shows an accurately scoped position value', async () => {
    setup('superkate')
    await screen.findByRole('heading', { name: 'K8 THE SLOTH' })
    expect(await screen.findByText('$480.00')).toBeTruthy()
    expect(screen.getByText('0.005000 BTC')).toBeTruthy()
    expect(screen.getByText('$15.35')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Critical Mass/i }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('slider').value).toBe('2')
  })

  it('previews another animal without trading and requires a separate confirmation', async () => {
    const requests = setup('superkate')
    await screen.findByRole('heading', { name: 'K8 THE SLOTH' })
    fireEvent.click(screen.getByRole('button', { name: '7: Cheetah' }))
    expect(screen.getByRole('heading', { name: 'K8 THE CHEETAH' })).toBeTruthy()
    expect(requests.mock.calls.filter(([url]) => url === '/api/k8/fund/risk')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Review level 7' }))
    expect(requests.mock.calls.filter(([url]) => url === '/api/k8/fund/risk')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm level 7' }))
    await waitFor(() =>
      expect(requests.mock.calls.filter(([url]) => url === '/api/k8/fund/risk')).toHaveLength(1),
    )
    const [, options] = requests.mock.calls.find(([url]) => url === '/api/k8/fund/risk')
    expect(JSON.parse(options.body)).toEqual({ level: 7, fingerprint: 'a'.repeat(64) })
  })

  it('keeps admin browsing read-only while showing the same saved level', async () => {
    const requests = setup('admin')
    await screen.findByRole('heading', { name: 'K8 THE SLOTH' })
    fireEvent.click(screen.getByRole('button', { name: '10: Dragon' }))
    expect(screen.getByRole('heading', { name: 'K8 THE DRAGON' })).toBeTruthy()
    expect(screen.getByText(/Preview mode · changes disabled/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Review level 10/i })).toBeNull()
    expect(requests.mock.calls.filter(([url]) => url === '/api/k8/fund/risk')).toHaveLength(0)
  })

  it('hides verbose settings until requested and distinguishes fund value from exchange balance', async () => {
    setup('superkate')
    await screen.findByRole('heading', { name: 'K8 THE SLOTH' })
    expect(screen.queryByText('Exchange balance')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))
    expect(screen.getByText('Exchange balance')).toBeTruthy()
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
  })
})
