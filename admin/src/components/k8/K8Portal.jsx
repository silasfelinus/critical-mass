import { useCallback, useEffect, useMemo, useState } from 'react'
import { K8_ANIMALS, riskParams } from './k8Risk.mjs'
import { apiGet, apiPost, apiPut, apiDelete, describeMutationFailure } from '../../utils/apiClient'
import './k8-theater.css'
import './k8-portal.css'
import './k8-immersive.css'

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
        <label className="k8-dedicated"><input type="checkbox" checked={dedicated} onChange={event => setDedicated(event.target.checked)} />
          I confirm this fund is dedicated to K8. Changing its strategy must not affect anyone else's money.
        </label>
        <button type="submit" disabled={pending || !dedicated}>{pending ? 'Preparing…' : 'Create a one-time invitation'}</button>
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

const money = value =>
  Number.isFinite(value)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
    : 'Unavailable'

const animalSummary = (level, percent = level * 10) => {
  if (level === 0) return 'Trading engine stopped. Existing orders and holdings may remain.'
  if (level <= 2) return `Quiet entries, up to ${percent}% of the authorized fund budget. Still exposed to losses.`
  if (level <= 4) return `Measured entries, up to ${percent}% of the authorized fund budget.`
  if (level <= 6) return `Balanced activity, up to ${percent}% of the authorized fund budget.`
  if (level <= 8) return `Faster entries, up to ${percent}% of the authorized fund budget.`
  return `Maximum entry aggressiveness, up to ${percent}% of the authorized fund budget.`
}

function K8Artwork({ animal, layer = 'incoming' }) {
  return (
    <picture className={'k8-immersive-scene k8-immersive-scene--' + layer}>
      <source
        media="(max-width: 600px) and (orientation: portrait)"
        srcSet={'/k8-animals/mobile/' + animal.file}
        type="image/webp"
      />
      <source
        media="(max-width: 1100px)"
        srcSet={'/k8-animals/tablet/' + animal.file}
        type="image/webp"
      />
      <img src={'/k8-animals/' + animal.file} alt="" draggable="false" />
    </picture>
  )
}

const PROFILE_FIELDS = [
  ['kFactor', 'Volatility trigger (ATR multiplier)'],
  ['minIntervalMs', 'Minimum between entries (milliseconds)'],
  ['maxIntervalMs', 'Maximum interval (milliseconds)'],
  ['entryOffsetBps', 'Entry price offset (basis points)'],
  ['entryOffsetUpBps', 'Rising-market entry offset (bps)'],
  ['entryOffsetDownBps', 'Falling-market entry offset (bps)'],
  ['orderStaleMs', 'Order stale timeout (milliseconds)'],
  ['cautionScale', 'Caution position-sizing multiplier'],
  ['trendScale', 'Trend position-sizing multiplier'],
  ['maxCycleBuys', 'Maximum buys in one cycle'],
  ['mergeProximityScale', 'Merge proximity multiplier'],
]

function K8Experience({ session, onSignOut }) {
  const [snapshot, setSnapshot] = useState(null)
  const [level, setLevel] = useState(2)
  const [previousLevel, setPreviousLevel] = useState(null)
  const [panel, setPanel] = useState('')
  const [details, setDetails] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileDraft, setProfileDraft] = useState({})
  const [profileError, setProfileError] = useState('')
  const admin = session.role === 'admin'
  const animal = K8_ANIMALS[level]
  const applied = snapshot?.appliedLevel
  const previewParams = useMemo(
    () => riskParams(level, snapshot?.presets, snapshot?.levelOverrides),
    [level, snapshot?.presets, snapshot?.levelOverrides],
  )

  const baseParams = useMemo(
    () => riskParams(level, snapshot?.presets), [level, snapshot?.presets],
  )
  const lowerLevelShare = level <= 1 ? 1
    : riskParams(level - 1, snapshot?.presets, snapshot?.levelOverrides)?.maxDeploymentPercent ?? 1
  const upperLevelShare = level >= 10 ? 100
    : riskParams(level + 1, snapshot?.presets, snapshot?.levelOverrides)?.maxDeploymentPercent ?? 100
  useEffect(() => {
    if (previewParams) setProfileDraft(Object.fromEntries(
      Object.entries(previewParams).filter(([key]) => key !== 'aggressiveness'),
    ))
    else setProfileDraft({})
    setProfileError('')
  }, [level, previewParams])

  const load = useCallback(async ({ keepPreview = false } = {}) => {
    setLoading(true)
    const result = await apiGet('/api/k8/fund')
    setLoading(false)
    if (!result.ok) {
      setError(result.error || 'Fund status is unavailable')
      setSnapshot(null)
      return
    }
    setSnapshot(result.data)
    setError('')
    if (!keepPreview) setLevel(result.data.appliedLevel ?? 2)
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (previousLevel === null) return undefined
    const timer = window.setTimeout(() => setPreviousLevel(null), 650)
    return () => window.clearTimeout(timer)
  }, [level, previousLevel])
  useEffect(() => {
    const candidateLevels = [level - 1, level + 1].filter(n => n >= 0 && n <= 10)
    const phone = window.matchMedia?.('(max-width: 600px) and (orientation: portrait)').matches ?? false
    const tablet = window.matchMedia?.('(max-width: 1100px)').matches ?? false
    const nextVariant = phone ? 'mobile/' : tablet ? 'tablet/' : ''
    candidateLevels.forEach(n => {
      const next = new Image()
      next.src = '/k8-animals/' + nextVariant + K8_ANIMALS[n].file
    })
  }, [level])

  const selectLevel = raw => {
    const next = Number(raw)
    if (!Number.isInteger(next) || next < 0 || next > 10 || next === level) return
    setPreviousLevel(level)
    setLevel(next)
    setPanel('')
    setNotice('')
  }

  const apply = async () => {
    if (admin || saving || !snapshot || panel !== 'confirm' || loading) return
    setSaving(true)
    setNotice('')
    const result = await apiPut('/api/k8/fund/risk', {
      level, fingerprint: snapshot.fingerprint,
    })
    setSaving(false)
    setPanel('')
    if (!result.ok) {
      setNotice(describeMutationFailure(result, 'Could not apply setting'))
      await load({ keepPreview: true })
      return
    }
    setNotice(level === 0
      ? 'Engine stop confirmed; holdings and existing orders may remain.'
      : 'Level ' + level + ' confirmed. ' +
        (snapshot.status.isRunning ? 'Engine running.' : 'Engine remains stopped.'))
    await load({ keepPreview: true })
  }

  const saveProfile = async (reset = false) => {
    if (admin || level === 0 || !snapshot || profileSaving || !previewParams || !baseParams) return
    setProfileSaving(true)
    setProfileError('')
    const overrides = reset ? null : Object.fromEntries(
      Object.entries(profileDraft).filter(([key, value]) =>
        key !== 'aggressiveness' && value !== baseParams[key]),
    )
    const response = await apiPut('/api/k8/fund/levels', {
      level, overrides, fingerprint: snapshot.fingerprint,
    })
    setProfileSaving(false)
    if (!response.ok) {
      setProfileError(describeMutationFailure(response, 'Could not save animal profile'))
      await load({ keepPreview: true })
      return
    }
    setNotice('Animal profile saved. Confirm Apply separately to change live strategy settings.')
    await load({ keepPreview: true })
  }

  const metrics = snapshot?.metrics
  const holding = Number.isFinite(metrics?.heldAsset)
    ? metrics.heldAsset.toFixed(6) + ' ' + (metrics.asset || 'BTC')
    : 'Unavailable'
  const currentName = applied === null
    ? 'Custom'
    : Number.isInteger(applied)
      ? K8_ANIMALS[applied].name
      : 'Unavailable'

  return (
    <main className={'k8-theater k8-immersive k8-immersive--' + animal.place}>
      <div className="k8-immersive-visual" aria-hidden="true">
        {previousLevel !== null &&
          <K8Artwork key={'out-' + previousLevel} animal={K8_ANIMALS[previousLevel]} layer="outgoing" />}
        <K8Artwork key={'in-' + level} animal={animal} />
      </div>
      <div className="k8-immersive-vignette" aria-hidden="true" />

      <header className="k8-immersive-top">
        <span className="k8-immersive-mark">K8 <span>WILDLIFE</span></span>
        <div className="k8-immersive-toplinks">
          {admin && <span className="k8-immersive-preview">Admin preview · read-only</span>}
          <span className={snapshot?.status?.isDryRun === false
            ? 'k8-status k8-status--live' : 'k8-status'}>
            {loading ? 'Checking' : snapshot?.status?.isDryRun === false ? 'Live' : 'Dry run / unknown'}
          </span>
          <a href="/" className="k8-immersive-link" aria-label="Open full Critical Mass dashboard">
            Critical Mass <span aria-hidden="true">↗</span>
          </a>
          {!admin && <button type="button" className="k8-immersive-link" onClick={onSignOut}>Sign out</button>}
        </div>
      </header>

      <div className={'k8-immersive-story k8-immersive-story--' + animal.place}
        key={'story-' + level} aria-live="polite">
        <span className="k8-immersive-overline">YOUR FINANCIAL SPIRIT ANIMAL</span>
        <div className="k8-immersive-numeral">{String(level).padStart(2, '0')}<small>/10</small></div>
        <h1>K8 THE {animal.name.toUpperCase()}</h1>
        <p className="k8-immersive-quote">“{animal.mood}”</p>
        <p className="k8-immersive-description">{animalSummary(level, previewParams?.maxDeploymentPercent)}</p>
      </div>

      <aside className="k8-immersive-dock" aria-label="K8 risk selector">
        <div className="k8-immersive-facts">
          <div className="k8-immersive-fact">
            <span>Saved level</span><strong>{currentName}{Number.isInteger(applied) ? ' · ' + applied : ''}</strong>
          </div>
          <div className="k8-immersive-fact">
            <span>Estimated fund value</span><strong>{money(metrics?.fundEquityQuote)}</strong>
          </div>
          <div className="k8-immersive-fact">
            <span>{metrics?.asset || 'BTC'} held</span><strong>{holding}</strong>
          </div>
          <div className="k8-immersive-fact">
            <span>Realized P&L</span><strong>{money(metrics?.realizedPnlQuote)}</strong>
          </div>
        </div>
        <div className="k8-immersive-scale-label">
          <label htmlFor="k8-risk-slider">Risk animal</label>
          <span>{level === 0 ? 'ENGINE STOP' : `${previewParams?.maxDeploymentPercent ?? level * 10}% MAX DEPLOYED`} · {level === applied ? 'CURRENT' : 'PREVIEW'}</span>
        </div>
        <input
          id="k8-risk-slider"
          className="k8-range"
          type="range"
          min="0"
          max="10"
          step="1"
          aria-valuetext={'Level ' + level + ', ' + animal.name}
          value={level}
          onChange={event => selectLevel(event.target.value)}
        />
        <div className="k8-ticks">
          {K8_ANIMALS.map((item, index) => (
            <button key={item.file} type="button"
              aria-label={index + ': ' + item.name} aria-pressed={level === index}
              className={'k8-tick' + (level === index ? ' k8-tick--active' : '')}
              onClick={() => selectLevel(index)}>{index}</button>
          ))}
        </div>
        <div className="k8-immersive-actions">
          {admin ? (
            <span className="k8-immersive-readonly">Preview mode · changes disabled</span>
          ) : (
            <button type="button" className="k8-immersive-apply"
              disabled={loading || saving || !snapshot || level === applied}
              onClick={() => setPanel('confirm')}>
              {level === applied ? 'Current setting' : 'Review level ' + level}
            </button>
          )}
          <button type="button" className="k8-immersive-settings"
            aria-expanded={panel === 'settings'}
            onClick={() => setPanel(panel === 'settings' ? '' : 'settings')}>
            Settings <span aria-hidden="true">⚙</span>
          </button>
          {admin && <button type="button" className="k8-immersive-settings"
            onClick={() => setPanel(panel === 'invite' ? '' : 'invite')}>Invite K8</button>}
        </div>
        {(error || notice) && (
          <p role={error ? 'alert' : 'status'} className={'k8-immersive-toast' + (error ? ' k8-immersive-toast--error' : '')}>
            {error || notice}
          </p>
        )}
      </aside>

      {panel && (
        <div className="k8-immersive-panel" role="dialog"
          aria-label={panel === 'confirm' ? 'Confirm new risk setting' : panel === 'invite' ? 'Invite K8' : 'Risk settings'}>
          <button type="button" className="k8-immersive-panel-close"
            aria-label="Close panel" onClick={() => setPanel('')}>×</button>
          {panel === 'confirm' && (
            <div className="k8-confirm">
              <h2>Make {animal.name} your risk animal?</h2>
              <p>
                Confirm level {level} for {snapshot?.scope?.exchange} / {snapshot?.scope?.pair}.
                {snapshot?.status?.isDryRun === false ? ' Live-money mode.' : ' Simulation mode.'}
              </p>
              <p>Level 0 stops the engine, not the holdings. Other levels set trading speed and a {previewParams?.maxDeploymentPercent ?? level * 10}% cap on NEW buy exposure (up to {money(snapshot?.config?.maxUsdcDeployed * (previewParams?.maxDeploymentPercent ?? level * 10) / 100)}). They never raise the authorized fund ceiling. Existing positions and resting buy orders are not automatically sold or cancelled. Crypto can lose its full value.</p>
              <div className="k8-confirm-actions">
                <button type="button" onClick={() => setPanel('')} disabled={saving}>Cancel</button>
                <button type="button" onClick={apply} disabled={saving}>
                  {saving ? 'Applying…' : 'Confirm level ' + level}
                </button>
              </div>
            </div>
          )}
          {panel === 'invite' && admin && (
            <AdminInvitation scope={snapshot?.scope || session.scope} onClose={() => setPanel('')} />
          )}
          {panel === 'settings' && (
            <div className="k8-immersive-details">
              <h2>Portfolio details</h2>
              <div className="k8-mode">
                <button type="button" aria-pressed={!details} onClick={() => setDetails(false)}>Simple</button>
                <button type="button" aria-pressed={details} onClick={() => setDetails(true)}>Deep</button>
              </div>
              {level === 0 ? (
                <p>Level 0 always stops the trading engine. This safety action is not editable and does not liquidate existing holdings.</p>
              ) : (
                <form onSubmit={event => { event.preventDefault(); void saveProfile() }}>
                  <label className="k8-profile-label" htmlFor="k8-deployment-share">
                    Maximum fund deployment (% of authorized budget)
                  </label>
                  <input
                    id="k8-deployment-share"
                    type="number"
                    min={lowerLevelShare}
                    max={upperLevelShare}
                    step="1"
                    disabled={admin || profileSaving}
                    value={profileDraft.maxDeploymentPercent ?? ''}
                    onChange={event => setProfileDraft(prev => ({
                      ...prev, maxDeploymentPercent: Number(event.target.value),
                    }))}
                  />
                  <p>
                    Up to {money(snapshot?.config?.maxUsdcDeployed *
                      (profileDraft.maxDeploymentPercent ?? 0) / 100)}
                    {' '}of the {money(snapshot?.config?.maxUsdcDeployed)} fund ceiling.
                    This caps NEW buys. Existing holdings and resting orders are not reduced.
                  </p>
                  <p>Keep this level between {lowerLevelShare}% and {upperLevelShare}% so higher animals remain at least as adventurous.</p>
                  {Number.isFinite(snapshot?.allocatedQuote) &&
                    snapshot.allocatedQuote > snapshot.config.maxUsdcDeployed *
                      (profileDraft.maxDeploymentPercent ?? 0) / 100 && (
                      <p role="status" className="k8-notice k8-notice--error">
                        Existing BTC exposure already exceeds this new-buy cap. No automatic sales or order cancellations will occur.
                      </p>
                    )}
                  <dl className="k8-immersive-data">
                    <div><dt>Configured fund ceiling</dt><dd>{money(snapshot?.config?.maxUsdcDeployed)}</dd></div>
                    <div><dt>Drawdown guard</dt><dd>{snapshot?.config?.maxDrawdownPercent ?? 'Unavailable'}%</dd></div>
                    <div><dt>Already deployed</dt><dd>{money(snapshot?.allocatedQuote)}</dd></div>
                    <div><dt>Resting buy orders</dt><dd>{snapshot?.pendingBuyOrders ?? 'Unavailable'}</dd></div>
                  </dl>
                  {details && (
                    <div className="k8-profile-advanced" aria-label="Detailed animal parameters">
                      <p>These change the actual regime-entry rules for this animal. Savings remain a preview until the animal is applied.</p>
                      {PROFILE_FIELDS.map(([key, label]) => (
                        <label className="k8-profile-field" key={key}>
                          <span>{label}</span>
                          <input
                            type="number"
                            step="any"
                            disabled={admin || profileSaving}
                            value={profileDraft[key] ?? ''}
                            onChange={event => setProfileDraft(prev => ({
                              ...prev, [key]: Number(event.target.value),
                            }))}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                  {profileError && <p role="alert" className="k8-notice k8-notice--error">{profileError}</p>}
                  {admin ? (
                    <p>Admin preview is read-only. K8 can customize profiles in her own session.</p>
                  ) : (
                    <div className="k8-profile-actions">
                      <button type="submit" disabled={profileSaving || loading}>
                        {profileSaving ? 'Saving…' : 'Save animal settings'}
                      </button>
                      <button type="button" disabled={profileSaving || loading}
                        onClick={() => void saveProfile(true)}>
                        Restore defaults
                      </button>
                    </div>
                  )}
                  <p>
                    Saving these numbers does not immediately alter the engine.
                    Confirm Apply to enact the new profile. Lowering the ceiling
                    cannot cancel resting buys or sell positions already held.
                  </p>
                </form>
              )}
              {!details && (
                <p className="k8-profile-summary">
                  Your animal's buy frequency, entry thresholds, and cycle limits
                  use the configured regime preset. Open Deep to inspect and override them.
                </p>
              )}
              <dl className="k8-immersive-data">
                <div><dt>Exchange balance</dt><dd>{money(metrics?.accountBalanceQuote)}</dd></div>
                <div><dt>BTC position value</dt><dd>{money(metrics?.positionValueQuote)}</dd></div>
                <div><dt>Trading status</dt><dd>{snapshot?.status?.isRunning ? 'Running' : 'Stopped / unavailable'}</dd></div>
                <div><dt>Completed cycles</dt><dd>{metrics?.cyclesCompleted ?? 'Unavailable'}</dd></div>
              </dl>
              <p>{metrics?.valuationNote || 'Fund data is temporarily unavailable.'}</p>
              <p>The dial previews changes. All investment settings remain bounded by the operator-configured limits.</p>
              {admin && <a className="k8-immersive-link" href="/k8/login-preview">Preview K8 login</a>}
            </div>
          )}
        </div>
      )}
    </main>
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
