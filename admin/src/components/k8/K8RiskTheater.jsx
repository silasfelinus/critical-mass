import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '../../lib/router'
import { apiGet, apiPost, apiPut, describeMutationFailure } from '../../utils/apiClient'
import { pairQuery } from '../../utils/api'
import {
  K8_ANIMALS,
  RISK_FIELDS,
  detectRiskLevel,
  riskParams,
  riskPresetIsOrdered,
} from './k8Risk.mjs'
import './k8-theater.css'

const formatMoney = value =>
  Number.isFinite(value) ? '$' + value.toLocaleString('en-US') : 'not configured'

export default function K8RiskTheater({ exchange, pair, strategy }) {
  const [level, setLevel] = useState(2)
  const [config, setConfig] = useState(null)
  const [presets, setPresets] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const pendingRef = useRef(false)

  const url = '/api/' + exchange + '/regime/'
  const query = pairQuery(pair)
  const fund = exchange + ' / ' + pair
  const animal = K8_ANIMALS[level]
  const params = useMemo(() => riskParams(level, presets), [level, presets])
  const presetOrdered = useMemo(
    () => riskPresetIsOrdered(presets),
    [presets],
  )
  const running = typeof status?.isRunning === 'boolean'
    ? status.isRunning
    : null
  const savedRiskLevel = detectRiskLevel(config, presets)
  const effectiveLevel = running === false ? 0 : savedRiskLevel
  const canConfigure = strategy === 'regime' && Boolean(config) &&
    presetOrdered && running !== null
  const hasChange = level === 0
    ? running !== false
    : savedRiskLevel !== level
  const live = status?.isDryRun === false
  const displayValue = level === 0 ? 'Engine stop' : 'Trading aggressiveness'

  const reload = useCallback(async (signal) => {
    const [configResult, presetResult, statusResult] = await Promise.all([
      apiGet(url + 'config' + query, { signal }),
      apiGet('/api/presets/aggressiveness', { signal }),
      apiGet(url + 'status' + query, { signal }),
    ])
    if (!configResult.ok || !configResult.data?.config) {
      setConfig(null)
      setError('Could not read this fund’s configuration. Nothing can be applied.')
    } else {
      setConfig(configResult.data.config)
      setError('')
    }
    setPresets(presetResult.ok ? presetResult.data?.presets ?? null : null)
    const nextStatus = statusResult.data
    setStatus(
      statusResult.ok && !nextStatus?.engineDown &&
      typeof nextStatus?.status?.isRunning === 'boolean'
        ? nextStatus.status
        : null,
    )
  }, [url, query])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setConfig(null)
    setPresets(null)
    setStatus(null)
    setMessage('')
    reload(controller.signal).catch(error => {
      if (error?.name !== 'AbortError') {
        setError('The trading gateway is unavailable. The dial is preview only.')
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [reload])

  useEffect(() => {
    setImageLoaded(false)
    setConfirm(false)
    setMessage('')
  }, [level])

  const chooseLevel = value => {
    const next = Number(value)
    if (!Number.isInteger(next) || next < 0 || next > 10) return
    setLevel(next)
  }

  const apply = async () => {
    if (pendingRef.current || !confirm || !canConfigure || !hasChange) return
    pendingRef.current = true
    setSaving(true)
    setMessage('')
    try {
      const fresh = await apiGet(url + 'config' + query)
      if (!fresh.ok || !fresh.data?.config) {
        setMessage('Configuration could not be rechecked. No change was sent.')
        return
      }
      const tracked = [...RISK_FIELDS, 'aggressiveness',
        'maxUsdcDeployed', 'maxDrawdownPercent', 'dryRun']
      const stale = tracked.some(key =>
        fresh.data.config[key] !== config[key])
      if (stale) {
        setMessage('This fund changed in another tab. Refresh and review before applying.')
        await reload()
        return
      }

      if (level === 0) {
        const result = await apiPost(url + 'stop' + query)
        if (!result.ok) {
          setMessage(describeMutationFailure(result, 'Could not stop the engine'))
          return
        }
        setMessage('Engine stop acknowledged. Existing positions and exchange orders may remain.')
      } else {
        const result = await apiPut(url + 'config' + query, params)
        if (!result.ok && result.data?.persisted === true) {
          setMessage('Saved to disk, but the running engine has NOT confirmed the new settings. Check the fund before trading.')
        } else if (!result.ok || result.data?.applied !== true) {
          setMessage(describeMutationFailure(result, 'Could not apply risk settings'))
          return
        } else {
          setMessage(
            'Level ' + level + ' applied to ' + fund + '. ' +
            (running ? 'The engine accepted the change.' : 'The engine remains stopped.'),
          )
        }
      }
      await reload()
    } catch {
      setMessage('The request could not be confirmed. Check live fund status before trying again.')
    } finally {
      pendingRef.current = false
      setSaving(false)
      setConfirm(false)
    }
  }

  const actionLabel = level === 0
    ? 'Stop this engine'
    : running === false
      ? 'Save level ' + level + ' (do not start)'
      : 'Apply level ' + level + ' to this fund'

  return (
    <section className={'k8-theater k8-theater--' + animal.place} aria-label="K8 animal-powered risk selector">
      <div className="k8-backdrop" aria-hidden="true" />
      <div className="k8-art" aria-hidden="true">
        <span className="k8-art-fallback">{animal.emoji}</span>
        <img
          key={animal.file}
          src={'/k8-animals/' + animal.file}
          alt=""
          draggable="false"
          className={'k8-art-image' + (imageLoaded ? ' k8-art-image--loaded' : '')}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(false)}
        />
      </div>

      <div className="k8-top">
        <Link to={'/' + exchange + '/' + encodeURIComponent(pair)} className="k8-back">
          ← Critical Mass
        </Link>
        <span className="k8-brand">K8 / THE WILDLIFE PORTFOLIO</span>
        <span className={'k8-status ' + (live ? 'k8-status--live' : '')}>
          {running === null ? 'STATUS UNKNOWN' : live ? 'LIVE MONEY' : 'DRY RUN'}
        </span>
      </div>

      <div className="k8-content">
        <div className="k8-story" aria-live="polite">
          <span className="k8-eyebrow">CHOOSE YOUR FINANCIAL SPIRIT ANIMAL</span>
          <div className="k8-number">{String(level).padStart(2, '0')}<span>/10</span></div>
          <h1>K8 THE {animal.name.toUpperCase()}</h1>
          <p className="k8-tagline">“{animal.mood}”</p>
          <div className="k8-story-divider" />
          <div className="k8-descriptor">{displayValue}</div>
          {level === 0 ? (
            <p className="k8-explanation">Zero means stop the trading engine. It is not a sell-all button. Existing orders or positions may still carry risk.</p>
          ) : (
            <p className="k8-explanation">
              The higher the dial, the more assertively the strategy may enter trades.
              Your dollar cap and drawdown setting do not move.
            </p>
          )}
        </div>

        <div className="k8-console">
          <div className="k8-console-heading">
            <span>THE K8-O-METER</span>
            <span>{fund}</span>
          </div>
          <input
            className="k8-range"
            aria-label="Risk animal level"
            type="range"
            min="0"
            max="10"
            step="1"
            value={level}
            onChange={event => chooseLevel(event.target.value)}
          />
          <div className="k8-ticks" aria-label="Choose a risk level">
            {K8_ANIMALS.map((item, index) => (
              <button
                key={item.name}
                type="button"
                className={'k8-tick' + (index === level ? ' k8-tick--active' : '')}
                aria-label={index + ': ' + item.name}
                aria-pressed={index === level}
                onClick={() => chooseLevel(index)}
              >
                {index}
              </button>
            ))}
          </div>

          <div className="k8-readout">
            <div>
              <span>Existing deployed cap</span>
              <strong>{formatMoney(config?.maxUsdcDeployed)}</strong>
            </div>
            <div>
              <span>Existing drawdown limit</span>
              <strong>{Number.isFinite(config?.maxDrawdownPercent)
                ? config.maxDrawdownPercent + '%' : 'not configured'}</strong>
            </div>
            <div>
              <span>Applied / preview</span>
              <strong>{running === null ? 'Unknown' : running === false
                ? 'Stopped (saved ' + (savedRiskLevel ?? 'custom') + ') / ' + level
                : effectiveLevel === null ? 'Custom / ' + level
                  : effectiveLevel + ' / ' + level}</strong>
            </div>
          </div>
          {level > 0 && params && (
            <div className="k8-impact">
              <span>Min entry interval: {Math.round(params.minIntervalMs / 1000)} sec</span>
              <span>Max cycle buys: {params.maxCycleBuys}</span>
              <span>Entry offset: {params.entryOffsetBps} bps</span>
            </div>
          )}
          {loading && <p role="status" className="k8-notice">Reading live configuration…</p>}
          {error && <p role="alert" className="k8-notice k8-notice--error">{error}</p>}
          {!presetOrdered && !loading && (
            <p role="alert" className="k8-notice k8-notice--error">
              The saved presets are incomplete or not ordered. Review them in Fund Config.
            </p>
          )}
          {running === null && !loading && (
            <p role="alert" className="k8-notice k8-notice--error">
              Engine status is unverified. Changes are disabled.
            </p>
          )}
          {strategy !== 'regime' && !loading && (
            <p className="k8-notice">This fund uses DCA. The animal dial controls regime funds only.</p>
          )}
          {message && <p role="status" className="k8-notice">{message}</p>}

          {!confirm ? (
            <button
              type="button"
              className="k8-action"
              disabled={!canConfigure || !hasChange || saving || loading}
              onClick={() => setConfirm(true)}
            >
              {!hasChange ? 'Already at this setting' : actionLabel}
            </button>
          ) : (
            <div className="k8-confirm" role="group" aria-label="Confirm risk change">
              <p>
                {level === 0 ? 'Stop the engine for ' : 'Change real trading parameters for '}
                <strong>{fund}</strong>?
                {live ? ' This fund is in live-money mode.' : ' This fund is in dry-run mode.'}
              </p>
              <p>Crypto can lose its full value. No profits are promised, and this does not change deposit schedules, positions, or spending caps.</p>
              <div className="k8-confirm-actions">
                <button type="button" onClick={() => setConfirm(false)} disabled={saving}>Cancel</button>
                <button type="button" onClick={apply} disabled={saving}>
                  {saving ? 'Checking live status…' : 'Confirm ' + (level === 0 ? 'stop' : 'settings')}
                </button>
              </div>
            </div>
          )}
          <p className="k8-footnote">Moving the dial only previews. This does not set up the $100/month contribution. Changes require confirmation and operator access. Not a guarantee against losses.</p>
        </div>
      </div>
    </section>
  )
}
