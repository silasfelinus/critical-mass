// The K8 API is deliberately separate from operator APIs. A K8 session
// never authorizes generic /api/* endpoints, other funds, exchange keys,
// direct trading commands, or the entire admin ConfigEditor.
const crypto = require('crypto');
const { getConfiguredFunds, getFundConfig, getAggressivenessPresets } = require('../config-utils');
const { buildClientConfig, prepareConfigUpdate, persistConfigUpdate } = require('./config-update');
const { IPC_CHANNELS } = require('../ipc/ipc-protocol');
const { computeFundEquity } = require('../risk-manager');

const PARAM_KEYS = Object.freeze([
  'kFactor', 'minIntervalMs', 'maxIntervalMs', 'entryOffsetBps',
  'entryOffsetUpBps', 'entryOffsetDownBps', 'orderStaleMs',
  'cautionScale', 'trendScale', 'maxCycleBuys', 'mergeProximityScale',
]);
const ANCHORS = [{ level: 1, preset: 'conservative' },
  { level: 4, preset: 'moderate' }, { level: 7, preset: 'aggressive' },
  { level: 10, preset: 'maximum' }];
const INTEGERS = new Set(['minIntervalMs', 'maxIntervalMs', 'orderStaleMs',
  'maxCycleBuys', 'entryOffsetBps', 'entryOffsetUpBps', 'entryOffsetDownBps']);
const SAFE_FIELDS = [...PARAM_KEYS, 'aggressiveness', 'maxUsdcDeployed',
  'maxDrawdownPercent', 'dryRun'];

function paramsForLevel(level, presets) {
  if (!Number.isInteger(level) || level < 1 || level > 10) return null;
  const lower = [...ANCHORS].reverse().find(anchor => anchor.level <= level);
  const upper = ANCHORS.find(anchor => anchor.level >= level);
  const from = presets?.[lower.preset];
  const to = presets?.[upper.preset];
  if (!from || !to) return null;
  const fraction = lower.level === upper.level ? 0 :
    (level - lower.level) / (upper.level - lower.level);
  const params = {};
  for (const key of PARAM_KEYS) {
    if (!Number.isFinite(from[key]) || !Number.isFinite(to[key])) return null;
    const value = from[key] + (to[key] - from[key]) * fraction;
    params[key] = INTEGERS.has(key) ? Math.round(value) : Number(value.toFixed(3));
  }
  return { aggressiveness: lower.preset, ...params };
}

const ordered = presets => ANCHORS.every(a => paramsForLevel(a.level, presets)) &&
  ANCHORS.slice(1).every((anchor, idx) => {
    const previous = presets[ANCHORS[idx].preset];
    const next = presets[anchor.preset];
    return ['kFactor', 'minIntervalMs', 'entryOffsetBps']
      .every(key => previous[key] >= next[key]) &&
      ['maxCycleBuys', 'cautionScale', 'trendScale']
        .every(key => previous[key] <= next[key]);
  });

function detectLevel(config, presets) {
  for (let level = 1; level <= 10; level++) {
    const params = paramsForLevel(level, presets);
    if (params && PARAM_KEYS.every(key =>
      Number.isFinite(config?.[key]) && Math.abs(config[key] - params[key]) < 0.005)) return level;
  }
  return null;
}

const hash = input => crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
const visibleConfig = config => Object.fromEntries(SAFE_FIELDS.map(key => [key, config[key]]));
const snapshotFingerprint = (config, status, presets) => hash({
  config: visibleConfig(config), isRunning: status?.isRunning,
  isDryRun: status?.isDryRun, presets,
});
const failure = (res, status, error) => res.status(status).json({ success: false, error });

// An engine position is NOT the entire exchange account. Only expose
// fund-scoped values known to this specific regime engine.
function readFundMetrics(status, pair, config = {}) {
  const position = status?.position || {};
  const price = status?.market?.lastPrice;
  const held = position.totalAsset;
  const availablePrice = Number.isFinite(price) && price > 0 &&
    status?.market?.stale !== true;
  const asset = typeof pair === 'string' ? pair.split('-')[0] : '';
  return {
    asset,
    heldAsset: Number.isFinite(held) && held >= 0 ? held : null,
    marketPriceQuote: availablePrice ? price : null,
    positionValueQuote: availablePrice && Number.isFinite(held) && held >= 0
      ? Number((held * price).toFixed(2)) : null,
    fundEquityQuote: availablePrice && status?.position &&
      Number.isFinite(config.maxUsdcDeployed) && config.maxUsdcDeployed > 0
      ? Number(computeFundEquity(position, config, price).equity.toFixed(2)) : null,
    realizedPnlQuote: Number.isFinite(position.realizedPnL)
      ? position.realizedPnL : null,
    cyclesCompleted: Number.isSafeInteger(position.cyclesCompleted)
      ? position.cyclesCompleted : null,
    accountBalanceQuote: null,
    valuationNote: availablePrice
      ? 'Estimated fund equity includes configured capital and tracked fund positions. It is not the exchange account balance.'
      : 'Live fund valuation unavailable. No exchange account balance is provided.',
  };
}

function registerK8FundRoutes(routes, { k8Auth, exchangeIPCMap }) {
  const getScope = () => k8Auth.getScope();
  const getFund = () => {
    const scope = getScope();
    if (!scope || !getConfiguredFunds().some(f => f.exchange === scope.exchange && f.pair === scope.pair)) return null;
    const fund = getFundConfig(scope.exchange, scope.pair);
    if (fund?.strategy !== 'regime') return null;
    return scope;
  };
  const readSnapshot = async () => {
    const scope = getFund();
    if (!scope) return { error: 'K8 must be assigned an existing regime fund', code: 409 };
    const config = buildClientConfig(scope.exchange, scope.pair);
    const presets = getAggressivenessPresets();
    const ipc = exchangeIPCMap[scope.exchange];
    if (!ipc) return { error: 'Exchange engine not configured', code: 503 };
    let result;
    try {
      result = await ipc.request(IPC_CHANNELS.REGIME_STATUS, {}, scope.exchange, scope.pair);
    } catch {
      return { error: 'Trading engine is unreachable; controls disabled', code: 503 };
    }
    if (!result?.success || !result.status ||
      typeof result.status.isRunning !== 'boolean' ||
      typeof result.status.isDryRun !== 'boolean') {
      return { error: 'Trading engine status is unverified; controls disabled', code: 503 };
    }
    const status = {
      isRunning: result.status.isRunning,
      isDryRun: result.status.isDryRun,
    };
    return {
      scope, config: visibleConfig(config), presets, status,
      metrics: readFundMetrics(result.status, scope.pair, config),
      fingerprint: snapshotFingerprint(config, status, presets),
      savedLevel: detectLevel(config, presets),
      appliedLevel: status.isRunning ? detectLevel(config, presets) : 0,
    };
  };

  routes.get('/api/k8/fund', k8Auth.requireK8, async (req, res) => {
    const data = await readSnapshot();
    if (data.error) return failure(res, data.code, data.error);
    res.json({ success: true, ...data, readonly: req.k8.readonly });
  });

  let mutationInFlight = false;
  routes.put('/api/k8/fund/risk', k8Auth.requireK8, async (req, res) => {
    if (req.k8.role !== 'superkate') return failure(res, 403, 'Admin K8 preview is read-only');
    if (mutationInFlight) return failure(res, 409, 'Another K8 risk change is still processing');
    mutationInFlight = true;
    try {
    const { level, fingerprint } = req.body || {};
    if (!Number.isInteger(level) || level < 0 || level > 10 ||
      typeof fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(fingerprint)) {
      return failure(res, 400, 'Provide a 0–10 level and current snapshot fingerprint');
    }
    const current = await readSnapshot();
    if (current.error) return failure(res, current.code, current.error);
    if (current.fingerprint !== fingerprint) {
      return failure(res, 409, 'The fund changed after you viewed it. Refresh before applying.');
    }
    const { exchange, pair } = current.scope;
    const ipc = exchangeIPCMap[exchange];
    if (level === 0) {
      try {
        const result = await ipc.request(IPC_CHANNELS.REGIME_STOP, {}, exchange, pair, 100_000);
        if (!result?.success) return failure(res, 503, 'Engine did not acknowledge stop');
        return res.json({ success: true, applied: true, level: 0,
          warning: 'Stop acknowledged. Existing positions and exchange orders may remain.' });
      } catch {
        return failure(res, 503, 'Engine stop could not be confirmed');
      }
    }

    if (!ordered(current.presets)) return failure(res, 409, 'Risk presets are missing or misordered');
    if (!(current.config.maxUsdcDeployed > 0) ||
      !(current.config.maxDrawdownPercent > 0)) {
      return failure(res, 409, 'The operator must set a capital cap and drawdown guard first');
    }
    const params = paramsForLevel(level, current.presets);
    if (!params) return failure(res, 409, 'Risk level is not supported by current presets');
    const prepared = prepareConfigUpdate({ exchange, pair, updates: params });
    if (!prepared.valid || Object.keys(prepared.fundUpdates).length ||
      Object.keys(prepared.regimeUpdates).some(key => !PARAM_KEYS.includes(key) && key !== 'aggressiveness')) {
      return failure(res, 400, 'Risk update was rejected by the fund validator');
    }
    try {
      // A per-fund preset update changes execution parameters, never starts
      // the engine or touches the deposit schedule and capital/drawdown caps.
      const result = await persistConfigUpdate(exchange, pair, prepared, ipc);
      if (!result.applied) {
        return res.status(503).json({ success: false, persisted: result.persisted,
          applied: false, error: 'Risk settings saved but not confirmed by engine. Check status.' });
      }
      res.json({ success: true, applied: true, level,
        engineRunning: current.status.isRunning });
    } catch {
      return failure(res, 503, 'Fund settings could not be saved');
    }
    } finally {
      mutationInFlight = false;
    }
  });

  routes.get('/api/k8/admin/status', k8Auth.requireK8, k8Auth.adminOnly, (req, res) => {
    res.json({ success: true, scope: getScope(), hasAccount: k8Auth.hasAccount() });
  });

  routes.post('/api/k8/admin/invite', k8Auth.requireK8, k8Auth.adminOnly, (req, res) => {
    const { exchange, pair, dedicatedFundConfirmed } = req.body || {};
    if (dedicatedFundConfirmed !== true) {
      return failure(res, 400, 'Confirm that this is a dedicated K8 fund before inviting her');
    }
    if (typeof exchange !== 'string' || typeof pair !== 'string' ||
      !getConfiguredFunds().some(f => f.exchange === exchange && f.pair === pair) ||
      getFundConfig(exchange, pair)?.strategy !== 'regime') {
      return failure(res, 400, 'Select a valid existing regime fund');
    }
    const invitation = k8Auth.createInvitation({ exchange, pair });
    // Fragment tokens do not enter HTTP request logs or Referer headers.
    res.json({ success: true, url: '/k8/invite#token=' + invitation.token,
      expiresAt: invitation.expiresAt, scope: { exchange, pair } });
  });
}

module.exports = { registerK8FundRoutes, paramsForLevel, detectLevel,
  ordered, snapshotFingerprint, visibleConfig, readFundMetrics };
