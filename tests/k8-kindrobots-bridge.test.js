const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createK8Auth } = require('../src/k8-auth');

describe('Kind Robots K8 bridge', () => {
  it('limits the bridge token to the three fund endpoints', async () => {
    const before = process.env.K8_BRIDGE_TOKEN;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k8-bridge-'));
    const token = 'test-only-bridge-token-with-at-least-32-bytes';
    process.env.K8_BRIDGE_TOKEN = token;
    try {
      const auth = createK8Auth({
        authFile: path.join(directory, 'k8.json'),
        readJSON: file => JSON.parse(fs.readFileSync(file, 'utf8')),
        writeJSON: (file, data) => fs.writeFileSync(file, JSON.stringify(data)),
        operatorAuth: { authenticate: async () => null },
      });
      const check = async (method, route, credential = token) => {
        let identity;
        let status;
        const req = {
          method, path: route, headers: { 'x-k8-bridge-token': credential },
          get(name) { return this.headers[name]; },
        };
        const res = {
          status(code) { status = code; return this; },
          json() { return this; },
        };
        await auth.requireK8(req, res, () => { identity = req.k8; });
        return { identity, status };
      };
      for (const [method, route] of [
        ['GET', '/api/k8/fund'],
        ['PUT', '/api/k8/fund/risk'],
        ['PUT', '/api/k8/fund/levels'],
      ]) {
        const { identity } = await check(method, route);
        assert.equal(identity.role, 'superkate');
        assert.equal(identity.readonly, false);
      }
      for (const [method, route] of [
        ['GET', '/api/k8/session'],
        ['POST', '/api/k8/admin/invite'],
        ['GET', '/api/k8/admin/status'],
        ['PUT', '/api/k8/fund'],
        ['POST', '/api/k8/fund/risk'],
        ['GET', '/api/keys'],
      ]) {
        const result = await check(method, route);
        assert.equal(result.status, 401, method + ' ' + route);
      }
      assert.equal((await check('GET', '/api/k8/fund', 'bad')).status, 401);
      process.env.K8_BRIDGE_TOKEN = 'too-short';
      assert.equal((await check('GET', '/api/k8/fund', 'too-short')).status, 401);
    } finally {
      if (before === undefined) delete process.env.K8_BRIDGE_TOKEN;
      else process.env.K8_BRIDGE_TOKEN = before;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
