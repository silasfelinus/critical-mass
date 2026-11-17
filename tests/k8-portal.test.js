const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { createK8Auth, COOKIE } = require('../src/k8-auth');
const { paramsForLevel, detectLevel, ordered, visibleConfig, readFundMetrics } = require('../src/routes/k8-routes');

const presets = {
  conservative: { kFactor: 0.8, minIntervalMs: 180000, maxIntervalMs: 7200000, entryOffsetBps: 25,
    entryOffsetUpBps: 13, entryOffsetDownBps: 38, orderStaleMs: 300000,
    cautionScale: 0.15, trendScale: 0, maxCycleBuys: 10, mergeProximityScale: 0.5 },
  moderate: { kFactor: 0.65, minIntervalMs: 120000, maxIntervalMs: 3600000, entryOffsetBps: 18,
    entryOffsetUpBps: 9, entryOffsetDownBps: 27, orderStaleMs: 180000,
    cautionScale: 0.35, trendScale: 0.1, maxCycleBuys: 15, mergeProximityScale: 1 },
  aggressive: { kFactor: 0.5, minIntervalMs: 90000, maxIntervalMs: 2400000, entryOffsetBps: 12,
    entryOffsetUpBps: 6, entryOffsetDownBps: 18, orderStaleMs: 120000,
    cautionScale: 0.6, trendScale: 0.25, maxCycleBuys: 25, mergeProximityScale: 1.5 },
  maximum: { kFactor: 0.3, minIntervalMs: 60000, maxIntervalMs: 1200000, entryOffsetBps: 5,
    entryOffsetUpBps: 3, entryOffsetDownBps: 8, orderStaleMs: 60000,
    cautionScale: 1, trendScale: 0.5, maxCycleBuys: 50, mergeProximityScale: 2.5 },
};

const makeFixture = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'critical-mass-k8-'));
  const authFile = path.join(dir, 'k8.json');
  const operatorAuth = {
    authenticate: async headers => headers['x-operator-test'] === 'yes' ? { source: 'session' } : null,
  };
  const k8 = createK8Auth({
    authFile,
    readJSON: file => JSON.parse(fs.readFileSync(file, 'utf8')),
    writeJSON: (file, data) => fs.writeFileSync(file, JSON.stringify(data)),
    operatorAuth,
  });
  const app = express();
  app.use(express.json());
  k8.registerPublicRoutes(app);
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/k8/')) return k8.requireK8(req, res, next);
    res.status(401).json({ error: 'Operator authentication required' });
  });
  app.get('/api/k8/identity', k8.requireK8, (req, res) => res.json(req.k8));
  app.put('/api/k8/risk', k8.requireK8, (req, res) =>
    req.k8.role === 'superkate' ? res.json({ success: true }) : res.sendStatus(403));
  app.get('/api/keys', (req, res) => res.json({ secrets: 'never' }));
  return { dir, authFile, k8, app };
};
const withGateway = async run => {
  const fixture = makeFixture();
  const server = await new Promise(resolve => {
    const listener = fixture.app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  try { return await run({ ...fixture, base }); }
  finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  }
};

describe('K8 server-side trading risk ladder', () => {
  it('never calls a tracked position the whole exchange account balance', () => {
    const status = {
      market: { lastPrice: 100000, stale: false },
      position: { totalAsset: 0.005, realizedPnL: 22.2, cyclesCompleted: 4 },
    };
    const metrics = readFundMetrics(status, 'BTC-USDC', { maxUsdcDeployed: 100 });
    assert.equal(metrics.positionValueQuote, 500);
    assert.equal(metrics.fundEquityQuote, 622.2);
    assert.equal(metrics.accountBalanceQuote, null);
    assert.equal(metrics.heldAsset, 0.005);
    assert.equal(metrics.realizedPnlQuote, 22.2);
    assert.equal(metrics.cyclesCompleted, 4);
    assert.match(metrics.valuationNote, /not the exchange account balance/i);
    assert.equal(readFundMetrics({ ...status, market: { lastPrice: 100000, stale: true } }, 'BTC-USDC', { maxUsdcDeployed: 100 }).fundEquityQuote, null);
    assert.equal(readFundMetrics({ ...status, market: { lastPrice: 100000, stale: true } }, 'BTC-USDC').positionValueQuote, null);
    assert.equal(readFundMetrics({ position: {} }, 'BTC-USDC').positionValueQuote, null);
  });

  it('uses exactly the same interpolated parameters as the browser', async () => {
    const ui = await import('../admin/src/components/k8/k8Risk.mjs');
    for (let level = 1; level <= 10; level++) {
      assert.deepEqual(paramsForLevel(level, presets), ui.riskParams(level, presets));
    }
  });

  it('matches the eleven-persona contract and keeps financial caps out of writes', () => {
    assert.equal(ordered(presets), true);
    assert.equal(paramsForLevel(0, presets), null);
    const levels = new Set();
    for (let level = 1; level <= 10; level++) {
      const risk = paramsForLevel(level, presets);
      assert.equal(detectLevel(risk, presets), level);
      assert.equal('maxUsdcDeployed' in risk, false);
      assert.equal('maxDrawdownPercent' in risk, false);
      assert.equal('dryRun' in risk, false);
      levels.add(JSON.stringify(risk));
    }
    assert.equal(levels.size, 10);
    assert.equal(visibleConfig({
      ...paramsForLevel(4, presets), maxUsdcDeployed: 100, maxDrawdownPercent: 20,
      dryRun: true, apiSecret: 'should never surface',
    }).apiSecret, undefined);
  });
});

describe('K8 separate invitation and permissions', () => {
  it('uses one-time invites, independent cookies, and denies access to the operator API', async () => {
    await withGateway(async ({ k8, base, authFile }) => {
      const initial = await fetch(base + '/api/k8/session').then(r => r.json());
      assert.equal(initial.authenticated, false);
      const { token } = k8.createInvitation({ exchange: 'coinbase', pair: 'BTC-USDC' });
      const invitationOnDisk = JSON.parse(fs.readFileSync(authFile));
      assert.equal(JSON.stringify(invitationOnDisk).includes(token), false);

      const accept = await fetch(base + '/api/k8/invite/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: 'a-special-private-password' }),
      });
      assert.equal(accept.status, 200);
      const cookie = accept.headers.get('set-cookie').split(';')[0];
      assert.ok(cookie.startsWith(COOKIE + '='));
      const identity = await fetch(base + '/api/k8/identity', { headers: { cookie } }).then(r => r.json());
      assert.equal(identity.role, 'superkate');
      assert.deepEqual(identity.scope, { exchange: 'coinbase', pair: 'BTC-USDC' });
      assert.equal(identity.readonly, false);

      const forbidden = await fetch(base + '/api/keys', { headers: { cookie } });
      assert.equal(forbidden.status, 401);
      const replay = await fetch(base + '/api/k8/invite/accept', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: 'some-new-private-password' }),
      });
      assert.equal(replay.status, 401);
    });
  });

  it('operator preview is read-only while the operator account remains separate', async () => {
    await withGateway(async ({ k8, base }) => {
      k8.createInvitation({ exchange: 'coinbase', pair: 'BTC-USDC' });
      const admin = { 'x-operator-test': 'yes' };
      const session = await fetch(base + '/api/k8/session', { headers: admin }).then(r => r.json());
      assert.equal(session.role, 'admin');
      assert.equal(session.readonly, true);
      const identity = await fetch(base + '/api/k8/identity', { headers: admin }).then(r => r.json());
      assert.equal(identity.readonly, true);
      const write = await fetch(base + '/api/k8/risk', { method: 'PUT', headers: admin });
      assert.equal(write.status, 403);
    });
  });
});
