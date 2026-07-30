import type { TDSequentialConfig, TDSequentialProfile } from './types'

export const PUBLIC_BASELINE_V0_2: Readonly<TDSequentialConfig> = Object.freeze({
  profile: 'PUBLIC_BASELINE_V0_2',
  rulesetVersion: '0.2',
  setupLength: 9,
  setupLookback: 4,
  setupEqualityPolicy: 'BREAK',
  setupStartPolicy: 'CONTINUOUS_SCAN',
  enablePerfection: true,
  latePerfectionPolicy: 'DISABLED',
  countdownLength: 13,
  countdownLookback: 2,
  countdownAllowEqual: true,
  countdownStartPolicy: 'ON_SETUP_COMPLETION_BAR',
  finalCountComparisonSource: 'CLOSE',
  enable8Vs5Deferral: false,
  enableFinalVs8Deferral: true,
  enableOppositeSetupCancellation: true,
  enableTDSTCancellation: true,
  enableRecycle: true,
  recycleSetupCount: 22,
  enableRangeRecycle: false,
  recycleRangeMinRatio: 1,
  recycleRangeMaxRatio: 2,
  tdstBreakPolicy: 'SIMPLE_CLOSE',
  calculationMode: 'CLOSED_BAR_ONLY'
})

export const TRADINGVIEW_STYLE_PUBLIC_V0_2: Readonly<TDSequentialConfig> = Object.freeze({
  ...PUBLIC_BASELINE_V0_2,
  profile: 'TRADINGVIEW_STYLE_PUBLIC_V0_2',
  finalCountComparisonSource: 'OPEN_OR_CLOSE'
})

const CONFIG_KEYS: Array<keyof TDSequentialConfig> = [
  'profile',
  'rulesetVersion',
  'setupLength',
  'setupLookback',
  'setupEqualityPolicy',
  'setupStartPolicy',
  'enablePerfection',
  'latePerfectionPolicy',
  'countdownLength',
  'countdownLookback',
  'countdownAllowEqual',
  'countdownStartPolicy',
  'finalCountComparisonSource',
  'enable8Vs5Deferral',
  'enableFinalVs8Deferral',
  'enableOppositeSetupCancellation',
  'enableTDSTCancellation',
  'enableRecycle',
  'recycleSetupCount',
  'enableRangeRecycle',
  'recycleRangeMinRatio',
  'recycleRangeMaxRatio',
  'tdstBreakPolicy',
  'calculationMode',
  'tickSize'
]

function isSameConfig(a: Readonly<TDSequentialConfig>, b: Readonly<TDSequentialConfig>): boolean {
  return CONFIG_KEYS.every(key => a[key] === b[key])
}

function getProfileBase(profile: TDSequentialProfile | undefined): Readonly<TDSequentialConfig> {
  return profile === 'TRADINGVIEW_STYLE_PUBLIC_V0_2'
    ? TRADINGVIEW_STYLE_PUBLIC_V0_2
    : PUBLIC_BASELINE_V0_2
}

export function resolveTDSequentialConfig(input?: Partial<TDSequentialConfig>): TDSequentialConfig {
  const base = getProfileBase(input?.profile)
  const config: TDSequentialConfig = { ...base, ...input }

  if (
    config.profile !== 'CUSTOM' &&
    !isSameConfig(config, getProfileBase(config.profile))
  ) {
    config.profile = 'CUSTOM'
  }

  validateTDSequentialConfig(config)
  return config
}

export function validateTDSequentialConfig(config: Readonly<TDSequentialConfig>): void {
  if (config.rulesetVersion !== '0.2') {
    throw new Error(`Unsupported TD Sequential ruleset version: ${String(config.rulesetVersion)}`)
  }

  const enumFields: Array<[keyof TDSequentialConfig, readonly unknown[]]> = [
    ['profile', ['PUBLIC_BASELINE_V0_2', 'TRADINGVIEW_STYLE_PUBLIC_V0_2', 'CUSTOM']],
    ['setupEqualityPolicy', ['BREAK', 'CONTINUE_ACTIVE']],
    ['setupStartPolicy', ['CONTINUOUS_SCAN', 'REQUIRE_PRICE_FLIP']],
    ['latePerfectionPolicy', ['DISABLED', 'UNTIL_NEXT_SETUP_COMPLETES']],
    ['countdownStartPolicy', ['ON_SETUP_COMPLETION_BAR', 'AFTER_SETUP_COMPLETION_BAR']],
    ['finalCountComparisonSource', ['CLOSE', 'OPEN_OR_CLOSE']],
    ['tdstBreakPolicy', ['SIMPLE_CLOSE']],
    ['calculationMode', ['CLOSED_BAR_ONLY', 'REALTIME_PROVISIONAL']]
  ]
  enumFields.forEach(([key, allowed]) => {
    if (!allowed.includes(config[key])) {
      throw new Error(`TD Sequential ${key} has an unsupported value: ${String(config[key])}.`)
    }
  })

  const booleanFields: Array<keyof TDSequentialConfig> = [
    'enablePerfection',
    'countdownAllowEqual',
    'enable8Vs5Deferral',
    'enableFinalVs8Deferral',
    'enableOppositeSetupCancellation',
    'enableTDSTCancellation',
    'enableRecycle',
    'enableRangeRecycle'
  ]
  booleanFields.forEach(key => {
    if (typeof config[key] !== 'boolean') {
      throw new Error(`TD Sequential ${key} must be boolean.`)
    }
  })

  const integerFields: Array<keyof Pick<TDSequentialConfig,
  'setupLength' | 'setupLookback' | 'countdownLength' | 'countdownLookback' | 'recycleSetupCount'>> = [
    'setupLength',
    'setupLookback',
    'countdownLength',
    'countdownLookback',
    'recycleSetupCount'
  ]

  integerFields.forEach(key => {
    const value = config[key]
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`TD Sequential ${key} must be a positive safe integer.`)
    }
  })

  if (config.setupLength < 4) {
    throw new Error('TD Sequential setupLength must be at least 4 when perfection is supported.')
  }
  if (config.recycleSetupCount <= config.setupLength) {
    throw new Error('TD Sequential recycleSetupCount must be greater than setupLength.')
  }
  if (config.enable8Vs5Deferral && config.countdownLength < 8) {
    throw new Error('TD Sequential 8 vs. 5 deferral requires countdownLength >= 8.')
  }
  if (config.enableFinalVs8Deferral && config.countdownLength < 9) {
    throw new Error('TD Sequential final vs. 8 deferral requires countdownLength >= 9.')
  }
  if (!Number.isFinite(config.recycleRangeMinRatio) || config.recycleRangeMinRatio <= 0) {
    throw new Error('TD Sequential recycleRangeMinRatio must be a finite positive number.')
  }
  if (
    !Number.isFinite(config.recycleRangeMaxRatio) ||
    config.recycleRangeMaxRatio < config.recycleRangeMinRatio
  ) {
    throw new Error('TD Sequential recycleRangeMaxRatio must be finite and >= recycleRangeMinRatio.')
  }
  if (config.tickSize !== undefined && (!Number.isFinite(config.tickSize) || config.tickSize <= 0)) {
    throw new Error('TD Sequential tickSize must be a finite positive number when provided.')
  }

  if (
    config.profile === 'PUBLIC_BASELINE_V0_2' &&
    !isSameConfig(config, PUBLIC_BASELINE_V0_2)
  ) {
    throw new Error('PUBLIC_BASELINE_V0_2 must match its canonical configuration.')
  }
  if (
    config.profile === 'TRADINGVIEW_STYLE_PUBLIC_V0_2' &&
    !isSameConfig(config, TRADINGVIEW_STYLE_PUBLIC_V0_2)
  ) {
    throw new Error('TRADINGVIEW_STYLE_PUBLIC_V0_2 must match its canonical configuration.')
  }
}

export function getTDSequentialConfigHash(config: Readonly<TDSequentialConfig>): string {
  const canonical = CONFIG_KEYS.map(key => [key, config[key]])
  const source = JSON.stringify(canonical)
  let hash = 0x811c9dc5
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `tdseq-0.2-${(hash >>> 0).toString(16).padStart(8, '0')}`
}
