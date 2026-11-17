// The K8 identity is separate from the full operator account.
// No device fingerprint, operator password sharing, or auth state in source control.
const crypto = require('crypto');
const fs = require('fs');
const { signJwt, verifyHs256Jwt } = require('./jwt');

const COOKIE = 'critical_mass_k8';
const TTL_SECONDS = 30 * 24 * 3600;
const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;
const ATTEMPT_WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const MAX_PEERS = 1024;

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const cookieValue = (header = '') => header.split(';')
  .map(part => part.trim()).find(part => part.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
const requestOriginMatches = req => {
  const origin = req.get?.('origin') || req.headers?.origin;
  if (!origin) return true;
  const host = (req.get?.('x-forwarded-host') || req.get?.('host') || req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  return Boolean(host) && URL.canParse(origin) && new URL(origin).host === host;
};
const credentialsError = message => Object.assign(new Error(message), { status: 401 });
const validatePassword = password => typeof password === 'string' &&
  Buffer.byteLength(password) >= 12 && Buffer.byteLength(password) <= 256;

function createK8Auth({ authFile, readJSON, writeJSON, operatorAuth, now = Date.now }) {
  const attempts = new Map();
  // A missing record means no invite has been issued. A damaged record never
  // silently becomes an unprotected new account.
  const existing = fs.existsSync(authFile);
  let record;
  try {
    record = existing ? readJSON(authFile) : { version: 1 };
    if (!record || record.version !== 1) throw new Error('Invalid K8 auth record');
  } catch {
    throw new Error('K8 authentication record is unreadable; refusing K8 account access');
  }

  const save = next => { writeJSON(authFile, next); record = next; };
  const validatePeer = req => {
    const key = req.socket?.remoteAddress || 'unknown';
    const t = now();
    for (const [peer, attempt] of attempts) {
      if (attempt.expires <= t) attempts.delete(peer);
    }
    let item = attempts.get(key);
    if (!item) {
      if (attempts.size >= MAX_PEERS) throw Object.assign(new Error('Too many sign-in requests'), { status: 429 });
      item = { count: 0, expires: t + ATTEMPT_WINDOW_MS };
      attempts.set(key, item);
    }
    if (++item.count > MAX_ATTEMPTS) throw Object.assign(new Error('Too many attempts; try later'), { status: 429 });
    return item;
  };
  const setCookie = (req, res) => {
    const token = signJwt(
      { sub: 'superkate', role: 'superkate', ep: record.sessionEpoch },
      record.sessionKey,
      { algorithm: 'HS256', audience: 'critical-mass-k8', issuer: 'critical-mass', expiresIn: TTL_SECONDS }
    );
    res.cookie(COOKIE, token, {
      httpOnly: true, secure: req.secure || req.get('x-forwarded-proto') === 'https',
      sameSite: 'strict', path: '/', maxAge: TTL_SECONDS * 1000,
    });
  };
  const checkKateSession = req => {
    if (!record.account?.passwordHash || !record.sessionKey) return false;
    const token = cookieValue(req.headers?.cookie);
    if (!token) return false;
    const claims = verifyHs256Jwt(token, record.sessionKey, {
      issuer: 'critical-mass', audience: 'critical-mass-k8',
    });
    return claims?.sub === 'superkate' && claims?.role === 'superkate' &&
      claims?.ep === record.sessionEpoch;
  };
  const authenticate = async req => {
    // An operator can preview K8's *exact* interface, but cannot submit the
    // K8-specific trade control. Existing full admin APIs remain unchanged.
    const admin = await operatorAuth.authenticate(req.headers || {}, req.socket?.remoteAddress);
    if (admin) return { role: 'admin', scope: record.scope ?? null, readonly: true };
    if (checkKateSession(req)) return { role: 'superkate', scope: record.scope, readonly: false };
    return null;
  };
  const requireK8 = async (req, res, next) => {
    const identity = await authenticate(req);
    if (!identity) return res.status(401).json({ success: false, error: 'Sign in to the K8 portal' });
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !requestOriginMatches(req)) {
      return res.status(403).json({ success: false, error: 'Request origin not authorized' });
    }
    req.k8 = identity;
    next();
  };
  const adminOnly = (req, res, next) => req.k8?.role === 'admin'
    ? next()
    : res.status(403).json({ success: false, error: 'Operator account required' });

  const registerPublicRoutes = routes => {
    routes.get('/api/k8/session', async (req, res) => {
      const identity = await authenticate(req);
      res.json({
        success: true,
        authenticated: Boolean(identity),
        role: identity?.role || null,
        scope: identity?.scope || null,
        readonly: Boolean(identity?.readonly),
        hasInvitation: Boolean(record.inviteHash && record.inviteExpires > now()),
      });
    });
    routes.post('/api/k8/session', async (req, res) => {
      try {
        const attempt = validatePeer(req);
        if (!requestOriginMatches(req)) return res.status(403).json({ success: false, error: 'Request origin not authorized' });
        if (!record.account?.passwordHash) throw credentialsError('Invalid password');
        const password = req.body?.password;
        if (typeof password !== 'string' || Buffer.byteLength(password) > 256) {
          throw credentialsError('Invalid password');
        }
        const derived = await new Promise((resolve, reject) =>
          crypto.scrypt(password, Buffer.from(record.account.salt, 'hex'), 32, (err, key) =>
            err ? reject(err) : resolve(key.toString('hex'))));
        if (!safeEqual(derived, record.account.passwordHash)) throw credentialsError('Invalid password');
        attempt.count -= 1;
        setCookie(req, res);
        res.json({ success: true, authenticated: true, role: 'superkate' });
      } catch (error) {
        res.status(error.status || 401).json({ success: false, error: error.status === 429 ? error.message : 'Invalid password' });
      }
    });
    routes.post('/api/k8/invite/accept', async (req, res) => {
      try {
        const attempt = validatePeer(req);
        if (!requestOriginMatches(req)) return res.status(403).json({ success: false, error: 'Request origin not authorized' });
        const { token, password } = req.body || {};
        if (!validatePassword(password)) return res.status(400).json({ success: false, error: 'Choose a password of 12–256 bytes' });
        if (typeof token !== 'string' || token.length > 256 || !record.inviteHash ||
          record.inviteExpires <= now() || !safeEqual(hash(token), record.inviteHash)) {
          throw credentialsError('This invitation has expired or was already used');
        }
        const initialHash = record.inviteHash;
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = await new Promise((resolve, reject) =>
          crypto.scrypt(password, Buffer.from(salt, 'hex'), 32, (err, key) =>
            err ? reject(err) : resolve(key.toString('hex'))));
        if (record.inviteHash !== initialHash) throw credentialsError('Invitation already used');
        save({
          ...record,
          inviteHash: null,
          inviteExpires: null,
          account: { salt, passwordHash },
          sessionKey: crypto.randomBytes(32).toString('hex'),
          sessionEpoch: (record.sessionEpoch || 0) + 1,
        });
        attempt.count -= 1;
        setCookie(req, res);
        res.json({ success: true, authenticated: true, role: 'superkate' });
      } catch (error) {
        res.status(error.status || 401).json({ success: false, error: error.message });
      }
    });
    routes.delete('/api/k8/session', requireK8, (req, res) => {
      if (req.k8.role === 'superkate') {
        // Clear this browser's cookie; never revoke the full operator session.
        res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', path: '/' });
      }
      res.status(204).send();
    });
  };

  const createInvitation = ({ exchange, pair }) => {
    // No identity, password, or invitation secret is ever committed to Git.
    const token = crypto.randomBytes(32).toString('base64url');
    save({
      ...record,
      version: 1,
      scope: { exchange, pair },
      inviteHash: hash(token),
      inviteExpires: now() + INVITE_TTL_MS,
    });
    return { token, expiresAt: new Date(record.inviteExpires).toISOString() };
  };

  return { registerPublicRoutes, requireK8, adminOnly, createInvitation,
    getScope: () => record.scope || null, hasAccount: () => Boolean(record.account),
    currentVersion: () => record.sessionEpoch ?? 0,
  };
}

module.exports = { createK8Auth, COOKIE, requestOriginMatches };
