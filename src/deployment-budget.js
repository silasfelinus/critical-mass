/**
 * An additional, strictly reducing cap on NEW quote-currency deployment.
 * The operator's maxUsdcDeployed remains the financial ceiling and accounting
 * base. Reducing exposure here does not sell held assets or cancel resting buys.
 * Older funds have no percentage field: they retain their historical 100% cap.
 */
function getEffectiveDeploymentCap(config) {
  const ceiling = config?.maxUsdcDeployed;
  const percent = config?.maxDeploymentPercent ?? 100;
  if (!Number.isFinite(ceiling) || ceiling < 0 ||
      !Number.isInteger(percent) || percent < 0 || percent > 100) {
    return 0; // Fail closed if a malformed runtime config bypasses validation.
  }
  return Math.floor((ceiling * percent / 100 + Number.EPSILON) * 100) / 100;
}

module.exports = { getEffectiveDeploymentCap };
