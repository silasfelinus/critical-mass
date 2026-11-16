import { useCallback, useEffect, useMemo, useState } from 'react'
import { K8_ANIMALS, riskParams } from './k8Risk.mjs'
import { apiGet, apiPost, apiPut, apiDelete, describeMutationFailure } from '../../utils/apiClient'
import './k8-theater.css'
import './k8-portal.css'

const currency = value => Number.isFinite(value) ? '$' + value.toLocaleString('en-US') : 'Not set'
const readable = value => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 3 }) : 'N/A'

function K8Login({ preview = false, invited = false, token = '', onAuthenticated }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async event => {
    event.preventDefault()
    if (preview) return
    if (invited && password !== confirm) return setError('Passwords do not match.')
    if (invited && password.length < 12) return setError('Use at least 12 characters.')
    setPending(true)
    setError('')
    const result = invited
      ? await apiPost('/api/k8/invite/accept', { token, password })
      : await apiPost('/api/k8/session', { password })
    setPending(false)
    if (!result.ok) return setError(result.error || 'Sign-in was not accepted.')
    setPassword('')
    setConfirm('')
    onAuthenticated()
  }

  return (
    <main className="k8-login">
      <div className="k8-login-art" aria-hidden="true" />
      <form onSubmit={submit} className="k8-login-panel">
        <span className="k8-login-eyebrow">PRIVATE ACCESS · CRITICAL MASS</span>
        <div className="k8-login-symbol" aria-hidden="true">🦥</div>
        <h1>WELCOME TO THE WILD SIDE, K8.</h1>
        <p>Eleven animals. One very real risk dial. An unreasonable quantity of rainbow.</p>
        {preview && <p role="status" className="k8-notice">Admin preview of K8's sign-in. This form cannot create a session.</p>}
        <label htmlFor="k8-password">{invited ? 'Choose your password' : 'Your password'}</label>
        <input
          id="k8-password"
          type="password"
          autoComplete={invited ? 'new-password' : 'current-password'}
          minLength={invited ? 12 : undefined}
          value={password}
          onChange={event => setPassword(event.target.value)}
          disabled={preview}
          required
        />
        {invited && (
          <>
            <label htmlFor="k8-confirm">Confirm password</label>
            <input
              id="k8-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={event => setConfirm(event.target.value)}
              disabled={preview}
              required
            />
          </>
        )}
        {error && <p role="alert" className="k8-notice k8-notice--error">{error}</p>}
        <button className="k8-action" type="submit" disabled={preview || pending}>
          {pending ? 'Checking…' : invited ? 'Activate my wildlife portfolio' : 'Enter the wildlife portfolio'}
        </button>
        <p className="k8-login-foot">Your personal login follows you across devices. No device tracking or shared admin passwords.</p>
        {preview && <a href="/k8" className="k8-back">← Back to your portfolio preview</a>}
      </form>
    </main>
  )
}

function AdminInvitation({ scope, onClose }) {
  const query = new URLSearchParams(window.location.search)
  const [exchange, setExchange] = useState(scope?.exchange || query.get('exchange') || 'coinbase')
  const [pair, setPair] = useState(scope?.pair || query.get('pair') || 'BTC-USDC')
  const [recipient, setRecipient] = useState('')
  const [dedicated, setDedicated] = useState(false)
  const [link, setLink] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const createInvite = async event => {
    event.preventDefault()
    setPending(true)
    setLink('')
    setError('')
    const result = await apiPost('/api/k8/admin/invite', {
      exchange: exchange.trim().toLowerCase(),
      pair: pair.trim().toUpperCase(),
      dedicatedFundConfirmed: dedicated,
    })
    setPending(false)
    if (!result.ok) return setError(result.error || 'Could not create an invitation')
    setLink(new URL(result.data.url, window.location.origin).toString())
    setExpiresAt(result.data.expiresAt)
  }
  const mailto = link && recipient.trim()
    ? 'mailto:' + encodeURIComponent(recipient.trim()) +
      '?subject=' + encodeURIComponent('Your K8 Wildlife Portfolio invitation') +
      '&body=' + encodeURIComponent(
        'Your private Critical Mass wildlife portfolio is ready.\n\n' +
        'Set your own password with this one-time link:\n' + link +
        '\n\nThis link expires in seven days. The 0–10 dial sets real trading aggressiveness.'
      )
    : ''
  return (
    <section className="k8-invite" aria-label="Invite Superkate">
      <h2>Invite K8</h2>
      <p>The operator chooses one existing regime fund. K8's session never inherits operator access.</p>
      <form onSubmit={createInvite}>
        <label htmlFor="k8-exchange">Exchange</label>
        <input id="k8-exchange" value={exchange} onChange={event => setExchange(event.target.value)} required />
        <label htmlFor="k8-pair">Fund pair</label>
        <input id="k8-pair" value={pair} onChange={event => setPair(event.target.value)} required />
        <button type="submit" disabled={pending}>{pending ? 'Preparing…' : 'Create a one-time invitation'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {link && (
        <div className="k8-invite-link">
          <p>One-time invitation, expires {new Date(expiresAt).toLocaleString()}.</p>
          <label htmlFor="k8-recipient">Recipient's email (only used to open your mail app)</label>
          <input id="k8-recipient" inputMode="email" type="email" placeholder="K8's email address"
            value={recipient} onChange={event => setRecipient(event.target.value)} />
          <a href={mailto || undefined} aria-disabled={!mailto} onClick={event => { if (!mailto) event.preventDefault() }}>Compose invitation email</a>
          <button type="button" onClick={() => navigator.clipboard?.writeText(link)}>Copy invite link</button>
          <p>The email will not send automatically. Only the recipient of the invite link can activate it. Reissuing invalidates the previous invitation.</p>
        </div>
      )}
      <button type="button" onClick={onClose}>Close</button>
    </section>
  )
}

function K8Experience({ session, onSignOut }) {
  const [snapshot, setSnapshot] = useState(null)
  const [level, setLevel] = useState(2)
  const [mode, setMode] = useState('simple')
  const [inviting, setInviting] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [artReady, setArtReady] = useState(false)
  const admin = session.role === 'admin'
  const animal = K8_ANIMALS[level]
  const previewParams = useMemo(() => riskParams(level, snapshot?.presets), [level, snapshot?.presets])
  const applied = snapshot?.appliedLevel
  const actual = snapshot?.savedLevel

  const load = useCallback(async ({ keepPreview = false } = {}) => {
    setLoading(true)
    const result = await apiGet('/api/k8/fund')
    setLoading(false)
    if (!result.ok) {
      setError(result.error || 'Unable to read this fund')
      return
    }
    setSnapshot(result.data)
    setError('')
    if (!keepPreview) setLevel(result.data.appliedLevel ?? 2)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { setArtReady(false); setConfirmation(false) }, [level])

  const apply = async () => {
    if (admin || saving || !snapshot || !confirmation || loading) return
    setSaving(true)
    setNotice('')
    const result = await apiPut('/api/k8/fund/risk', {
      level, fingerprint: snapshot.fingerprint,
    })
    setSaving(false)
    setConfirmation(false)
    if (!result.ok) {
      setNotice(describeMutationFailure(result, 'Could not apply setting'))
      await load({ keepPreview: true })
      return
    }
    setNotice(level === 0
      ? 'Stop acknowledged. Existing positions and orders may remain.'
      : 'Level ' + level + ' settings confirmed. ' + (snapshot.status.isRunning ? 'Engine running.' : 'Engine remains stopped until an operator starts it.'))
    await load({ keepPreview: true })
  }

  return (
    <section className={'k8-theater k8-theater--' + animal.place} aria-label="K8 Wildlife risk selector">
      <div className="k8-backdrop" aria-hidden="true" />
      <div className="k8-art" aria-hidden="true">
        <span className="k8-art-fallback">{animal.emoji}</span>
        <picture>
          <source media="(max-width: 600px) and (orientation: portrait)" srcSet={'/k8-animals/mobile/' + animal.file} />
          <source media="(max-width: 1100px)" srcSet={'/k8-animals/tablet/' + animal.file} />
          <img
            key={animal.file}
            src={'/k8-animals/' + animal.file}
            alt=""
            className={'k8-art-image' + (artReady ? ' k8-art-image--loaded' : '')}
            draggable="false"
            onLoad={() => setArtReady(true)}
            onError={() => setArtReady(false)}
          />
        </picture>
      </div>

      <header className="k8-top">
        {admin ? <a className="k8-back" href="/">← Admin dashboard</a>
          : <button type="button" className="k8-back" onClick={onSignOut}>Sign out</button>}
        <span className="k8-brand">K8 / THE WILDLIFE PORTFOLIO</span>
        <span className={'k8-status ' + (snapshot?.status?.isDryRun === false ? 'k8-status--live' : '')}>
          {loading ? 'CHECKING ENGINE' : snapshot?.status?.isDryRun === false ? 'LIVE MONEY' : 'DRY RUN / UNKNOWN'}
        </span>
      </header>
      <div className="k8-content">
        <div className="k8-story" aria-live="polite">
          <span className="k8-eyebrow">CHOOSE YOUR FINANCIAL SPIRIT ANIMAL</span>
          <div className="k8-number">{String(level).padStart(2, '0')}<span>/10</span></div>
          <h1>K8 THE {animal.name.toUpperCase()}</h1>
          <p className="k8-tagline">“{animal.mood}”</p>
          <div className="k8-story-divider" />
          <div className="k8-descriptor">{level === 0 ? 'Engine stop' : 'Trading aggressiveness'}</div>
          <p className="k8-explanation">This dial changes trade-entry behavior, not the dollar cap or deposits. All crypto can lose its full value.</p>
        </div>

        <div className="k8-console">
          {admin && (
            <p className="k8-admin-preview">
              <strong>ADMIN PREVIEW</strong> · You are viewing K8's real saved setting. Exploring animals here cannot submit changes.
            </p>
          )}
          <div className="k8-console-heading">
            <span>THE K8-O-METER</span>
            <span>{snapshot?.scope ? snapshot.scope.exchange + ' / ' + snapshot.scope.pair : 'No fund assigned'}</span>
          </div>
          <input className="k8-range" type="range" min="0" max="10" step="1"
            aria-label="Preview risk level" value={level} onChange={event => setLevel(Number(event.target.value))} />
          <div className="k8-ticks">
            {K8_ANIMALS.map((item, index) => (
              <button type="button" key={index}
                aria-label={index + ': ' + item.name} aria-pressed={level === index}
                className={'k8-tick' + (level === index ? ' k8-tick--active' : '')}
                onClick={() => setLevel(index)}>{index}</button>
            ))}
          </div>
          <div className="k8-readout">
            <div><span>Actual setting</span><strong>{loading ? 'Loading' : applied === null ? 'Custom' : applied ?? 'Unknown'}</strong></div>
            <div><span>Capital cap (unchanged)</span><strong>{currency(snapshot?.config?.maxUsdcDeployed)}</strong></div>
            <div><span>Drawdown guard (unchanged)</span><strong>{readable(snapshot?.config?.maxDrawdownPercent)}%</strong></div>
          </div>
          <div className="k8-mode">
            <button type="button" aria-pressed={mode === 'simple'} onClick={() => setMode('simple')}>Simple</button>
            <button type="button" aria-pressed={mode === 'deep'} onClick={() => setMode('deep')}>Deep settings</button>
          </div>
          {mode === 'simple' ? (
            <p className="k8-explain-mini">Level {level === 0 ? '0 stops the engine but does not liquidate existing positions.' : level + ' changes how eagerly the bot places buys. Limits stay fixed.'}</p>
          ) : (
            <div className="k8-deep" aria-label="Read-only detailed risk parameters">
              <p>Inspect the strategy values behind the dial. Advanced values are read-only; a change to the risk level uses the same confirmation as Simple mode.</p>
              <dl>
                <div><dt>Minimum entry interval</dt><dd>{readable(previewParams?.minIntervalMs)} ms</dd></div>
                <div><dt>Maximum buys per cycle</dt><dd>{readable(previewParams?.maxCycleBuys)}</dd></div>
                <div><dt>Entry offset</dt><dd>{readable(previewParams?.entryOffsetBps)} bps</dd></div>
                <div><dt>Trend scale</dt><dd>{readable(previewParams?.trendScale)}</dd></div>
                <div><dt>Actual configured level</dt><dd>{actual === null ? 'Custom settings' : actual ?? 'Not loaded'}</dd></div>
              </dl>
            </div>
          )}
          {error && <p role="alert" className="k8-notice k8-notice--error">{error}</p>}
          {notice && <p role="status" className="k8-notice">{notice}</p>}
          {!admin && !confirmation && (
            <button className="k8-action" type="button"
              disabled={loading || saving || !snapshot || level === applied}
              onClick={() => setConfirmation(true)}>
              {level === applied ? 'This is your current setting' : level === 0 ? 'Review engine stop' : 'Review level ' + level + ' change'}
            </button>
          )}
          {confirmation && !admin && (
            <div className="k8-confirm" role="group" aria-label="Confirm risk setting">
              <p>You are requesting <strong>level {level} ({animal.name})</strong> for real trading parameters on {snapshot?.scope?.exchange} / {snapshot?.scope?.pair}.</p>
              <p>{snapshot?.status?.isDryRun === false ? 'LIVE-MONEY MODE. ' : 'Dry-run mode. '}No guarantee of returns. This does not raise the capital limit, add funds, or liquidate positions.</p>
              <div className="k8-confirm-actions">
                <button type="button" onClick={() => setConfirmation(false)} disabled={saving}>Cancel</button>
                <button type="button" disabled={saving} onClick={apply}>{saving ? 'Applying…' : 'Confirm level ' + level}</button>
              </div>
            </div>
          )}
          {admin && (
            <div className="k8-admin-tools">
              <a href="/k8/login-preview" className="k8-back">Preview K8 sign-in</a>
              <button type="button" className="k8-back" onClick={() => setInviting(v => !v)}>
                {inviting ? 'Close invitation' : 'Create K8 invitation'}
              </button>
            </div>
          )}
          {admin && inviting && <AdminInvitation scope={snapshot?.scope || session.scope} onClose={() => setInviting(false)} />}
          <p className="k8-footnote">Art changes are previews. Only K8's own account can confirm the wildlife dial. Admin retains full control through the operator dashboard.</p>
        </div>
      </div>
    </section>
  )
}

export default function K8Portal() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteToken] = useState(() => {
    if (window.location.pathname !== '/k8/invite') return ''
    return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || ''
  })
  const showLoginPreview = window.location.pathname === '/k8/login-preview'

  const check = useCallback(async () => {
    setLoading(true)
    const response = await apiGet('/api/k8/session')
    setLoading(false)
    if (!response.ok) return setError('Unable to contact the authentication gateway')
    setSession(response.data.authenticated ? response.data : null)
    setError('')
  }, [])
  useEffect(() => { check() }, [check])
  useEffect(() => {
    if (inviteToken) window.history.replaceState({}, '', '/k8/invite')
  }, [inviteToken])

  const logout = async () => {
    await apiDelete('/api/k8/session')
    setSession(null)
  }
  if (loading) return <main className="k8-login"><p role="status">Opening the K8 Wildlife Portfolio…</p></main>
  if (error) return <main className="k8-login"><p role="alert">{error}</p><button type="button" onClick={check}>Retry</button></main>
  if (showLoginPreview && session?.role === 'admin') return <K8Login preview onAuthenticated={check} />
  if (!session) return <K8Login invited={Boolean(inviteToken)} token={inviteToken} onAuthenticated={() => window.location.replace('/k8')} />
  return <K8Experience session={session} onSignOut={logout} />
}
