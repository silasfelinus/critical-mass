export const K8_ANIMALS = [
  { name: 'Anemone', emoji: '🪸', mood: 'The market may continue without me.', place: 'right', file: '00-anemone.webp' },
  { name: 'Snail', emoji: '🐌', mood: 'Please respect my personal liquidity.', place: 'left', file: '01-snail.webp' },
  { name: 'Sloth', emoji: '🦥', mood: 'I have reviewed the charts. Eventually.', place: 'right', file: '02-sloth.webp' },
  { name: 'Tortoise', emoji: '🐢', mood: 'An empire built one tiny step at a time.', place: 'left', file: '03-tortoise.webp' },
  { name: 'Capybara', emoji: '🦫', mood: 'Unbothered, moisturized, moderately invested.', place: 'right', file: '04-capybara.webp' },
  { name: 'Otter', emoji: '🦦', mood: 'One paw on the wheel. One on a shiny rock.', place: 'left', file: '05-otter.webp' },
  { name: 'Fox', emoji: '🦊', mood: 'I have a plan. I refuse to share it.', place: 'right', file: '06-fox.webp' },
  { name: 'Cheetah', emoji: '🐆', mood: 'Faster decisions. Same limited treasury.', place: 'left', file: '07-cheetah.webp' },
  { name: 'Honey Badger', emoji: '🦡', mood: 'The spreadsheets have started to fear me.', place: 'right', file: '08-honey-badger.webp' },
  { name: 'Phoenix', emoji: '🔥', mood: 'My risk tolerance has developed a soundtrack.', place: 'left', file: '09-phoenix.webp' },
  { name: 'Dragon', emoji: '🐉', mood: 'I AM THE FANCY BUTTONS.', place: 'right', file: '10-dragon.webp' },
]

const ANCHORS = [
  { level: 1, preset: 'conservative' },
  { level: 4, preset: 'moderate' },
  { level: 7, preset: 'aggressive' },
  { level: 10, preset: 'maximum' },
]

const FIELD_KEYS = [
  'kFactor',
  'minIntervalMs',
  'maxIntervalMs',
  'entryOffsetBps',
  'entryOffsetUpBps',
  'entryOffsetDownBps',
  'orderStaleMs',
  'cautionScale',
  'trendScale',
  'maxCycleBuys',
  'mergeProximityScale',
]

const INT_FIELDS = new Set([
  'minIntervalMs',
  'maxIntervalMs',
  'orderStaleMs',
  'maxCycleBuys',
  'entryOffsetBps',
  'entryOffsetUpBps',
  'entryOffsetDownBps',
])

export const RISK_FIELDS = [...FIELD_KEYS, 'maxDeploymentPercent']

// The animal number is also the default share of the independent fund cap:
// 0 = stop, 1 = 10%, ... 10 = 100%. Custom settings can override each level.

export function riskParams(level, presets, levelOverrides = {}) {
  if (!Number.isInteger(level) || level < 1 || level > 10) return null
  const lower = [...ANCHORS].reverse().find(anchor => anchor.level <= level)
  const upper = ANCHORS.find(anchor => anchor.level >= level)
  const from = presets?.[lower.preset]
  const to = presets?.[upper.preset]
  if (!from || !to) return null
  const fraction = lower.level === upper.level
    ? 0
    : (level - lower.level) / (upper.level - lower.level)
  const params = {}
  for (const key of FIELD_KEYS) {
    if (!Number.isFinite(from[key]) || !Number.isFinite(to[key])) return null
    const value = from[key] + (to[key] - from[key]) * fraction
    params[key] = INT_FIELDS.has(key)
      ? Math.round(value)
      : Number(value.toFixed(3))
  }
  const override = levelOverrides?.[level] || {}
  return {
    aggressiveness: lower.preset,
    ...params,
    maxDeploymentPercent: level * 10,
    ...override,
  }
}

export function detectRiskLevel(config, presets, levelOverrides = {}) {
  if (!config || !presets) return null
  for (let level = 1; level <= 10; level += 1) {
    const params = riskParams(level, presets, levelOverrides)
    if (!params) continue
    const matches = RISK_FIELDS.every(key =>
      Number.isFinite(config[key]) && Math.abs(config[key] - params[key]) < 0.005)
    if (matches) return level
  }
  return null
}

export function riskPresetIsOrdered(presets) {
  if (!ANCHORS.every(anchor => riskParams(anchor.level, presets))) return false
  const keysDecreasing = [
    'kFactor',
    'minIntervalMs',
    'entryOffsetBps',
  ]
  const keysIncreasing = ['maxCycleBuys', 'cautionScale', 'trendScale']
  return ANCHORS.slice(1).every((anchor, index) => {
    const before = presets[ANCHORS[index].preset]
    const after = presets[anchor.preset]
    return keysDecreasing.every(key => before[key] >= after[key]) &&
      keysIncreasing.every(key => before[key] <= after[key])
  })
}
