import type { TD9Config } from './types'

export const DEFAULT_TD9_CONFIG: Readonly<TD9Config> = Object.freeze({
  setupStartPolicy: 'CONTINUOUS_SCAN',
  afterCompleted: 'WAIT_BREAK',
  enablePerfection: true,
  calculationMode: 'CLOSED_BAR_ONLY'
})

export function resolveTD9Config(input: Partial<TD9Config> = {}): TD9Config {
  const config: TD9Config = {
    setupStartPolicy: input.setupStartPolicy ?? DEFAULT_TD9_CONFIG.setupStartPolicy,
    afterCompleted: input.afterCompleted ?? DEFAULT_TD9_CONFIG.afterCompleted,
    enablePerfection: input.enablePerfection ?? DEFAULT_TD9_CONFIG.enablePerfection,
    calculationMode: input.calculationMode ?? DEFAULT_TD9_CONFIG.calculationMode
  }
  validateTD9Config(config)
  return config
}

export function validateTD9Config(config: Readonly<TD9Config>): void {
  if (!['CONTINUOUS_SCAN', 'REQUIRE_PRICE_FLIP'].includes(config.setupStartPolicy)) {
    throw new Error(`TD9 setupStartPolicy has an unsupported value: ${String(config.setupStartPolicy)}.`)
  }
  if (!['WAIT_BREAK', 'RESTART'].includes(config.afterCompleted)) {
    throw new Error(`TD9 afterCompleted has an unsupported value: ${String(config.afterCompleted)}.`)
  }
  if (typeof config.enablePerfection !== 'boolean') {
    throw new Error('TD9 enablePerfection must be boolean.')
  }
  if (!['CLOSED_BAR_ONLY', 'REALTIME_PROVISIONAL'].includes(config.calculationMode)) {
    throw new Error(`TD9 calculationMode has an unsupported value: ${String(config.calculationMode)}.`)
  }
}
