const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getEffectiveDeploymentCap } = require('../src/deployment-budget');
const { createRiskManager } = require('../src/risk-manager');
const { validateAndSanitizeRegimeConfig } = require('../src/config-validator');
const { REGIME_DEFAULTS } = require('../src/config-utils');

describe('K8 additional deployment ceiling', () => {
  it('preserves the historical 100% cap on every fund without an animal policy', () => {
    assert.equal(getEffectiveDeploymentCap({ maxUsdcDeployed: 100.15 }), 100.15);
    assert.equal(getEffectiveDeploymentCap({ maxUsdcDeployed: 100.15, maxDeploymentPercent: 100 }), 100.15);
  });

  it('enforces the default Snail, Sloth, Otter and Dragon allocation percentages', () => {
    assert.equal(getEffectiveDeploymentCap({ maxUsdcDeployed: 100.15, maxDeploymentPercent: 10 }), 10.01);
    assert.equal(getEffectiveDeploymentCap({ maxUsdcDeployed: 100.15, maxDeploymentPercent: 20 }), 20.03);
    assert.equal(getEffectiveDeploymentCap({ maxUsdcDeployed: 100.15, maxDeploymentPercent: 50 }), 50.07);
    assert.equal(getEffectiveDeploymentCap({ maxUsdcDeployed: 100.15, maxDeploymentPercent: 100 }), 100.15);
  });

  it('fails closed if malformed or zero settings reach the engine', () => {
    assert.equal(getEffectiveDeploymentCap({ maxUsdcDeployed: 100, maxDeploymentPercent: 0 }), 0);
    assert.equal(getEffectiveDeploymentCap({ maxUsdcDeployed: 100, maxDeploymentPercent: 101 }), 0);
    assert.equal(getEffectiveDeploymentCap({ maxUsdcDeployed: 100, maxDeploymentPercent: 3.4 }), 0);
    assert.equal(getEffectiveDeploymentCap({ maxUsdcDeployed: NaN }), 0);
    assert.equal(getEffectiveDeploymentCap({ maxUsdcDeployed: -1 }), 0);
  });

  it('blocks new buys above the animal cap without rewriting the parent limit', () => {
    const config = {
      maxUsdcDeployed: 100,
      maxDeploymentPercent: 20,
      maxAssetExposure: 0,
      maxCycleBuys: 15,
      cycleResetHours: 0,
      maxDrawdownPercent: 20,
      drawdownResetHours: 0,
    };
    const risk = createRiskManager('coinbase', config, 'BTC-USDC');
    assert.equal(risk.checkUSDCCap(15, 5).allowed, true);
    assert.equal(risk.checkUSDCCap(15, 5.01).allowed, false);
    assert.match(risk.checkUSDCCap(15, 5.01).reason, />20$/);
    const capacity = risk.getRemainingCapacity({ totalCostBasis: 15, totalAsset: 0, cycleBuys: 0 }, 100000);
    assert.equal(capacity.remainingUsdc, 5);
    assert.equal(config.maxUsdcDeployed, 100);
    config.maxDeploymentPercent = 10;
    assert.equal(risk.getRemainingCapacity({ totalCostBasis: 15, totalAsset: 0, cycleBuys: 0 }, 100000).remainingUsdc, 0);
    assert.equal(risk.checkUSDCCap(15, 0).allowed, false);
  });

  it('validates integer deployment shares in the existing regime contract', () => {
    for (const value of [0, 10, 20, 100]) {
      const result = validateAndSanitizeRegimeConfig({ maxDeploymentPercent: value }, REGIME_DEFAULTS);
      assert.equal(result.valid, true, 'expected valid: ' + value);
      assert.equal(result.value.maxDeploymentPercent, value);
    }
    for (const value of [-1, 12.5, 101, Infinity]) {
      const result = validateAndSanitizeRegimeConfig({ maxDeploymentPercent: value }, REGIME_DEFAULTS);
      assert.equal(result.valid, false, 'expected rejection: ' + value);
    }
  });
});
