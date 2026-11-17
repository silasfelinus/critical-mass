import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import PositionCard from '../src/components/regime/PositionCard'

afterEach(() => cleanup())

function showPosition(isDryRun, depositedCapital) {
  return render(
    <PositionCard
      position={{
        totalAsset: 0.00155,
        assetOnOrder: 0.0015,
        totalCostBasis: 100.16,
        avgCostBasis: 64936,
        unrealizedPnL: 0.75,
        realizedPnL: 0,
        realizedAssetPnL: 0,
        cyclesCompleted: 0,
      }}
      apy={{
        engineStartTime: Date.now() - 43_200_000,
        depositedCapital,
        originalCapital: 10000,
        initialCapital: 10000,
        maxUsdcDeployed: 100.15,
        availableCapital: 0,
        elapsedDays: 0.5,
        cyclesPerDay: 0,
      }}
      market={{ lastPrice: 64936 }}
      config={{ maxCycleBuys: 250 }}
      asset="BTC"
      isDryRun={isDryRun}
      dryRunState={{ pnl: {} }}
      exchange="coinbase"
      pairQuery="?pair=BTC-USDC"
    />,
  )
}

describe('Regime capital provenance labels', () => {
  it('calls simulated book capital paper capital, not an actual deposit', () => {
    showPosition(true, 10000)
    const label = screen.getByText('Paper capital: $10,000')
    expect(label.title).toMatch(/Not evidence of an exchange deposit/)
    expect(screen.queryByText(/Deposited:/)).toBeNull()
  })

  it('calls live bookkeeping recorded principal, without implying exchange verification', () => {
    showPosition(false, 10000)
    expect(screen.getByText('Recorded principal: $10,000').title)
      .toMatch(/verify deposits against exchange transaction history/)
    expect(screen.queryByText(/Deposited:/)).toBeNull()
  })

  it('does not replace an explicit zero with a legacy ten-thousand-dollar placeholder', () => {
    showPosition(true, 0)
    expect(screen.getByText('Paper capital: $0')).toBeTruthy()
    expect(screen.queryByText('Paper capital: $10,000')).toBeNull()
  })
})
