import { resolveTD9Config } from './config'
import type {
  TD9BarOutput,
  TD9Config,
  TD9Direction,
  TD9InputBar,
  TD9Result,
  TD9SetupMark
} from './types'

export const TD9_SETUP_LENGTH = 9
const TD9_SETUP_LOOKBACK = 4

type SetupRun =
  | { phase: 'IDLE' }
  | {
    phase: 'COUNTING'
    direction: TD9Direction
    id: string
    count: number
  }
  | {
    phase: 'COMPLETED'
    direction: TD9Direction
  }

interface TD9State {
  run: SetupRun
}

function resolveInputRange(
  dataList: readonly TD9InputBar[],
  config: Readonly<TD9Config>
): { committedCount: number, provisionalIndex?: number } {
  const provisionalIndex = dataList.findIndex(bar => bar.isClosed === false)
  if (provisionalIndex === -1) return { committedCount: dataList.length }
  if (config.calculationMode === 'CLOSED_BAR_ONLY') {
    throw new Error('TD9 CLOSED_BAR_ONLY mode does not accept an unclosed bar.')
  }
  if (provisionalIndex !== dataList.length - 1) {
    throw new Error('TD9 only permits one unclosed bar at the end of the input.')
  }

  return {
    committedCount: provisionalIndex,
    provisionalIndex
  }
}

function createProvisionalState(state: Readonly<TD9State>): TD9State {
  return {
    run: { ...state.run }
  }
}

function hasPriceFlip(
  bars: readonly TD9InputBar[],
  index: number,
  setupDelta: number
): boolean {
  if (index < TD9_SETUP_LOOKBACK + 1) return false
  const previousDelta = bars[index - 1].close -
    bars[index - 1 - TD9_SETUP_LOOKBACK].close
  return setupDelta < 0 ? previousDelta >= 0 : previousDelta <= 0
}

function isPerfected(
  bars: readonly TD9InputBar[],
  direction: TD9Direction,
  completionIndex: number,
  enabled: boolean
): boolean {
  if (!enabled) return false

  const bar6 = bars[completionIndex - 3]
  const bar7 = bars[completionIndex - 2]
  const bar8 = bars[completionIndex - 1]
  const bar9 = bars[completionIndex]
  return direction === 'BUY'
    ? Math.min(bar8.low, bar9.low) < Math.min(bar6.low, bar7.low)
    : Math.max(bar8.high, bar9.high) > Math.max(bar6.high, bar7.high)
}

function recordSetupRun(
  state: TD9State,
  bars: readonly TD9InputBar[],
  index: number,
  run: Extract<SetupRun, { phase: 'COUNTING' }>,
  output: TD9BarOutput,
  enablePerfection: boolean
): void {
  const setupMark: TD9SetupMark = {
    setupId: run.id,
    direction: run.direction,
    value: run.count
  }
  output.setupMark = setupMark
  if (run.count !== TD9_SETUP_LENGTH) return

  if (isPerfected(bars, run.direction, index, enablePerfection)) {
    setupMark.perfected = true
  }
  state.run = { phase: 'COMPLETED', direction: run.direction }
}

function processSetup(
  state: TD9State,
  bars: readonly TD9InputBar[],
  index: number,
  output: TD9BarOutput,
  config: Readonly<TD9Config>
): void {
  if (index < TD9_SETUP_LOOKBACK) return
  const setupDelta = bars[index].close - bars[index - TD9_SETUP_LOOKBACK].close

  if (setupDelta === 0) {
    state.run = { phase: 'IDLE' }
    return
  }

  const direction: TD9Direction = setupDelta < 0 ? 'BUY' : 'SELL'
  const restartCompletedRun = state.run.phase === 'COMPLETED' &&
    state.run.direction === direction &&
    config.afterCompleted === 'RESTART'
  if (state.run.phase !== 'IDLE' && state.run.direction === direction) {
    if (state.run.phase === 'COUNTING') {
      state.run.count += 1
      recordSetupRun(state, bars, index, state.run, output, config.enablePerfection)
      return
    }
    if (!restartCompletedRun) return
  }

  state.run = { phase: 'IDLE' }
  const canStart = restartCompletedRun ||
    config.setupStartPolicy === 'CONTINUOUS_SCAN' ||
    hasPriceFlip(bars, index, setupDelta)
  if (!canStart) return

  const run: Extract<SetupRun, { phase: 'COUNTING' }> = {
    phase: 'COUNTING',
    direction,
    id: `setup:${direction}:${bars[index].timestamp}`,
    count: 1
  }
  state.run = run
  recordSetupRun(state, bars, index, run, output, config.enablePerfection)
}

function processBar(
  state: TD9State,
  bars: readonly TD9InputBar[],
  index: number,
  config: Readonly<TD9Config>,
  provisional: boolean
): TD9BarOutput {
  const output: TD9BarOutput = {
    barIndex: index,
    timestamp: bars[index].timestamp,
    provisional
  }
  processSetup(state, bars, index, output, config)
  return output
}

export function calculateTD9(
  dataList: readonly TD9InputBar[],
  inputConfig: Partial<TD9Config> = {}
): TD9Result {
  const config = resolveTD9Config(inputConfig)
  const { committedCount, provisionalIndex } = resolveInputRange(dataList, config)
  const committedState: TD9State = {
    run: { phase: 'IDLE' }
  }
  const bars: TD9BarOutput[] = []

  for (let index = 0; index < committedCount; index++) {
    bars.push(processBar(committedState, dataList, index, config, false))
  }

  const provisional = provisionalIndex === undefined
    ? undefined
    : processBar(createProvisionalState(committedState), dataList, provisionalIndex, config, true)

  return {
    config: Object.freeze(config),
    bars,
    provisional
  }
}
