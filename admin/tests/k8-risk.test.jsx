import React from 'react'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter } from '../src/lib/router'
import K8RiskTheater from '../src/components/k8/K8RiskTheater'
import {
  K8_ANIMALS,
  RISK_FIELDS,
  riskParams,
  riskPresetIsOrdered,
  detectRiskLevel,
} from '../src/components/k8/k8Risk.mjs'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const presets = {
  conservative: {
    kFactor: 0.8,
    minIntervalMs: 180000,
    maxIntervalMs: 7200000,
    entryOffsetBps: 25,
    entryOffsetUpBps: 13,
    entryOffsetDownBps: 38,
    orderStaleMs: 300000,
    cautionScale: 0.15,
    trendScale: 0,
    maxCycleBuys: 10,
    mergeProximityScale: 0.5,
  },
  moderate: {
    kFactor: 0.65,
    minIntervalMs: 120000,
    maxIntervalMs: 3600000,
    entryOffsetBps: 18,
    entryOffsetUpBps: 9,
    entryOffsetDownBps: 27,
    orderStaleMs: 180000,
    cautionScale: 0.35,
    trendScale: 0.1,
    maxCycleBuys: 15,
    mergeProximityScale: 1,
  },
  aggressive: {
    kFactor: 0.5,
    minIntervalMs: 90000,
    maxIntervalMs: 2400000,
    entryOffsetBps: 12,
    entryOffsetUpBps: 6,
    entryOffsetDownBps: 18,
    orderStaleMs: 120000,
    cautionScale: 0.6,
    trendScale: 0.25,
    maxCycleBuys: 25,
    mergeProximityScale: 1.5,
  },
  maximum: {
    kFactor: 0.3,
    minIntervalMs: 60000,
    maxIntervalMs: 1200000,
    entryOffsetBps: 5,
    entryOffsetUpBps: 3,
    entryOffsetDownBps: 8,
    orderStaleMs: 60000,
    cautionScale: 1,
    trendScale: 0.5,
    maxCycleBuys: 50,
    mergeProximityScale: 2.5,
  },
}

const firstConfig = {
  ...riskParams(2, presets),
  maxUsdcDeployed: 100,
  maxDrawdownPercent: 20,
  dryRun: false,
}

const response = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

const setup = ({ statusCode = 200 } = {}) => {
  const calls = vi.fn(async (url, options = {}) => {
    const target = String(url)
    if (options.method === 'PUT') {
      return response(200, {
        success: true,
        applied: true,
        persisted: true,
        config: riskParams(3, presets),
      })
    }
    if (options.method === 'POST') {
      return response(200, { success: true })
    }
    if (target.includes('/presets/aggressiveness')) {
      return response(200, { success: true, presets })
    }
    if (target.includes('/regime/config')) {
      return response(200, { success: true, config: firstConfig })
    }
    if (target.includes('/regime/status')) {
      return response(statusCode, {
        success: statusCode === 200,
        status: { isRunning: true, isDryRun: false },
      })
    }
    return response(404, { success: false })
  })
  vi.stubGlobal('fetch', calls)
  render(
    <BrowserRouter>
      <K8RiskTheater exchange="coinbase" pair="BTC-USDC" strategy="regime" />
    </BrowserRouter>,
  )
  return calls
}

describe('K8 animal risk ladder', () => {
  it('gives each setting its own animal, including 0 anemone, 1 snail, 2 sloth', () => {
    expect(K8_ANIMALS).toHaveLength(11)
    expect(K8_ANIMALS.slice(0, 3).map(animal => animal.name)).toEqual([
      'Anemone',
      'Snail',
      'Sloth',
    ])
    expect(new Set(K8_ANIMALS.map(animal => animal.file)).size).toBe(11)
  })

  it('maps 1-10 to eleven distinct, bounded engine configurations without changing capital limits', () => {
    expect(riskPresetIsOrdered(presets)).toBe(true)
    const signatures = new Set()
    for (let level = 1; level <= 10; level += 1) {
      const params = riskParams(level, presets)
      expect(params).not.toBeNull()
      expect(detectRiskLevel(params, presets)).toBe(level)
      expect(params.maxCycleBuys).toBeGreaterThanOrEqual(3)
      expect(params.minIntervalMs).toBeLessThan(params.maxIntervalMs)
      expect(params).not.toHaveProperty('maxUsdcDeployed')
      expect(params).not.toHaveProperty('maxDrawdownPercent')
      expect(params).not.toHaveProperty('dryRun')
      expect(Object.keys(params).sort()).toEqual(
        ['aggressiveness', ...RISK_FIELDS].sort(),
      )
      signatures.add(JSON.stringify(params))
    }
    expect(signatures.size).toBe(10)
    expect(riskParams(0, presets)).toBeNull()
  })

  it('makes preview read-only until a separate confirmation, then writes only the selected fund', async () => {
    const calls = setup()
    await screen.findByText('$100')
    expect(screen.getByRole('button', { name: 'Already at this setting' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '3: Tortoise' }))
    expect(calls.mock.calls.filter(([, opts]) => opts?.method === 'PUT')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Apply level 3 to this fund' }))
    expect(calls.mock.calls.filter(([, opts]) => opts?.method === 'PUT')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm settings' }))
    await waitFor(() =>
      expect(calls.mock.calls.filter(([, opts]) => opts?.method === 'PUT')).toHaveLength(1),
    )
    const [url, options] = calls.mock.calls.find(([, opts]) => opts?.method === 'PUT')
    expect(url).toBe('/api/coinbase/regime/config?pair=BTC-USDC')
    expect(JSON.parse(options.body)).toEqual(riskParams(3, presets))
  })

  it('maps level zero to a deliberate engine stop, never a sell or liquidation', async () => {
    const calls = setup()
    await screen.findByText('$100')
    fireEvent.click(screen.getByRole('button', { name: '0: Anemone' }))
    expect(calls.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Stop this engine' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop' }))
    await waitFor(() =>
      expect(calls.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(1),
    )
    expect(calls.mock.calls.find(([, opts]) => opts?.method === 'POST')[0]).toBe(
      '/api/coinbase/regime/stop?pair=BTC-USDC',
    )
    expect(calls.mock.calls.filter(([, opts]) => opts?.method === 'PUT')).toHaveLength(0)
  })

  it('refuses to apply anything when authoritative engine status is unavailable', async () => {
    const calls = setup({ statusCode: 503 })
    await screen.findByText(/Engine status is unverified/)
    fireEvent.click(screen.getByRole('button', { name: '5: Otter' }))
    expect(screen.getByRole('button', { name: 'Apply level 5 to this fund' }).disabled).toBe(true)
    expect(calls.mock.calls.some(([, opts]) => ['PUT', 'POST'].includes(opts?.method))).toBe(false)
  })
})
