import type KLineData from '../../../common/KLineData'

export type TDSequentialDirection = 'BUY' | 'SELL'

export type TDSequentialProfile =
  | 'PUBLIC_BASELINE_V0_2'
  | 'TRADINGVIEW_STYLE_PUBLIC_V0_2'
  | 'CUSTOM'

export interface TDSequentialConfig {
  profile: TDSequentialProfile
  rulesetVersion: '0.2'

  setupLength: number
  setupLookback: number
  setupEqualityPolicy: 'BREAK' | 'CONTINUE_ACTIVE'
  setupStartPolicy: 'CONTINUOUS_SCAN' | 'REQUIRE_PRICE_FLIP'

  enablePerfection: boolean
  latePerfectionPolicy: 'DISABLED' | 'UNTIL_NEXT_SETUP_COMPLETES'

  countdownLength: number
  countdownLookback: number
  countdownAllowEqual: boolean
  countdownStartPolicy: 'ON_SETUP_COMPLETION_BAR' | 'AFTER_SETUP_COMPLETION_BAR'
  finalCountComparisonSource: 'CLOSE' | 'OPEN_OR_CLOSE'

  enable8Vs5Deferral: boolean
  enableFinalVs8Deferral: boolean

  enableOppositeSetupCancellation: boolean
  enableTDSTCancellation: boolean

  enableRecycle: boolean
  recycleSetupCount: number
  enableRangeRecycle: boolean
  recycleRangeMinRatio: number
  recycleRangeMaxRatio: number

  tdstBreakPolicy: 'SIMPLE_CLOSE'
  calculationMode: 'CLOSED_BAR_ONLY' | 'REALTIME_PROVISIONAL'
  tickSize?: number
}

export interface TDSequentialSetupMark {
  setupId: string
  direction: TDSequentialDirection
  value: number
  completed: boolean
  provisional: boolean
}

export interface TDSequentialCountdownMark {
  countdownId: string
  direction: TDSequentialDirection
  value: number | '+' | 'R'
  kind: 'COUNT' | 'DEFERRED' | 'COMPLETED' | 'RECYCLED'
  provisional: boolean
}

export type TDSequentialEventType =
  | 'SETUP_STARTED'
  | 'SETUP_PROGRESS'
  | 'SETUP_INTERRUPTED'
  | 'SETUP_COMPLETED'
  | 'SETUP_PERFECTED'
  | 'SETUP_IMPERFECTED_FINAL'
  | 'SETUP_RECYCLE_TRIGGERED'
  | 'TDST_CREATED'
  | 'TDST_REPLACED'
  | 'TDST_BROKEN'
  | 'COUNTDOWN_CREATED'
  | 'COUNTDOWN_PROGRESS'
  | 'COUNTDOWN_DEFERRED'
  | 'COUNTDOWN_COMPLETED'
  | 'COUNTDOWN_CANCELLED'
  | 'COUNTDOWN_RECYCLED'
  | 'COMPLETION_WINDOW_ELAPSED'
  | 'DIAGNOSTIC'

export interface TDSequentialEvent<Payload = Record<string, unknown>> {
  id: string
  type: TDSequentialEventType
  sequence: number
  barIndex: number
  timestamp: number
  direction?: TDSequentialDirection
  entityId: string
  configHash: string
  provisional: boolean
  payload: Payload
}

export interface TDSequentialSetup {
  id: string
  direction: TDSequentialDirection
  runId: string

  startIndex: number
  completionIndex: number
  countBarIndices: number[]

  highestTrueHigh: number
  lowestTrueLow: number
  range: number

  perfectionState: 'DISABLED' | 'PENDING' | 'PERFECTED' | 'IMPERFECTED_FINAL'
  perfectionIndex?: number
  perfectionDetectionIndex?: number

  extendedRunLength: number
  extendedRunEndIndex?: number
  recycleTriggerIndex?: number
  supersededIndex?: number
}

export interface TDSequentialTDSTLevel {
  id: string
  setupId: string
  direction: TDSequentialDirection
  type: 'RESISTANCE' | 'SUPPORT'
  price: number
  startIndex: number
  endIndex?: number
  state: 'ACTIVE' | 'BROKEN' | 'REPLACED'
  breakPolicy: 'SIMPLE_CLOSE'
  breakoutQualification: 'NOT_IMPLEMENTED'
}

export interface TDSequentialCountdownCountRecord {
  ordinal: number
  barIndex: number
  timestamp: number
  comparisonSource: 'CLOSE' | 'OPEN_OR_CLOSE'
  comparisonValue: number
  close: number
  high: number
  low: number
}

export interface TDSequentialCountdownDeferredRecord {
  attemptedOrdinal: 8 | 'FINAL'
  barIndex: number
  timestamp: number
  reason: 'EIGHT_VS_FIVE' | 'FINAL_VS_EIGHT'
}

export interface TDSequentialCountdown {
  id: string
  direction: TDSequentialDirection
  originSetupId: string
  predecessorCountdownIds: string[]

  creationIndex: number
  startEligibilityIndex: number
  count: number
  records: TDSequentialCountdownCountRecord[]
  deferredCandidates: TDSequentialCountdownDeferredRecord[]

  phase: 'WAITING' | 'COUNTING' | 'COMPLETED'
  disposition: 'ACTIVE' | 'CANCELLED' | 'RECYCLED'

  completionIndex?: number
  cancellationIndex?: number
  cancellationReason?: 'OPPOSITE_SETUP' | 'TDST_VIOLATION'
  recycleIndex?: number
  recycleReason?: 'SETUP_EXTENDED_COUNT' | 'SETUP_RANGE_RATIO'
  recycleTriggerSetupId?: string
}

export interface TDSequentialCompletionLifecycle {
  countdownId: string
  completionIndex: number
  barsSinceCompletion: number
  state: 'WITHIN_12_BARS' | 'AFTER_12_BARS' | 'INVALIDATED_BY_RECYCLE'
  stateChangedIndex?: number
}

export interface TDSequentialSetupScannerState {
  direction: TDSequentialDirection | null
  runId?: string
  startIndex?: number
  runLength: number
  barIndices: number[]
  completedSetupId?: string
}

export interface TDSequentialStateSnapshot {
  afterBarIndex: number
  afterTimestamp: number
  configHash: string
  nextEventSequence: number
  setupScanner: TDSequentialSetupScannerState
  setups: TDSequentialSetup[]
  countdowns: TDSequentialCountdown[]
  tdstLevels: TDSequentialTDSTLevel[]
  completionLifecycles: TDSequentialCompletionLifecycle[]
}

export interface TDSequentialBarOutput {
  barIndex: number
  timestamp: number
  provisional: boolean
  setupMark?: TDSequentialSetupMark
  countdownMarks: TDSequentialCountdownMark[]
  perfectedSetupIds: string[]
  currentTDSTResistanceId?: string
  currentTDSTSupportId?: string
  tdstResistance?: number
  tdstSupport?: number
  events: TDSequentialEvent[]
}

export interface TDSequentialCapabilities {
  riskLevel: 'NOT_IMPLEMENTED' | 'CUSTOM_PROVIDER' | 'VERIFIED_RULESET'
  intersection: 'DISABLED' | 'CUSTOM_PROVIDER' | 'VERIFIED_RULESET'
  breakoutQualification: 'NOT_IMPLEMENTED' | 'CUSTOM_PROVIDER' | 'VERIFIED_RULESET'
}

export interface TDSequentialResult {
  rulesetVersion: '0.2'
  profile: TDSequentialProfile
  compatibility: 'PUBLIC_RULES_BASELINE' | 'DOCUMENTED_PUBLIC_SETTINGS_PARTIAL' | 'CUSTOM_RULESET'
  config: Readonly<TDSequentialConfig>
  configHash: string
  capabilities: TDSequentialCapabilities
  committedBarCount: number
  bars: TDSequentialBarOutput[]
  setups: TDSequentialSetup[]
  countdowns: TDSequentialCountdown[]
  tdstLevels: TDSequentialTDSTLevel[]
  completionLifecycles: TDSequentialCompletionLifecycle[]
  events: TDSequentialEvent[]
  provisional?: TDSequentialBarOutput
}

export interface TDSequentialDelta {
  operation: 'APPEND' | 'REPLACE_LAST' | 'REMOVE_LAST'
  addedEventIds: string[]
  removedEventIds: string[]
  addedOrUpdatedEntityIds: string[]
  removedEntityIds: string[]
  committedBarOutput?: TDSequentialBarOutput
  provisionalBarOutput?: TDSequentialBarOutput
  removedBarTimestamp?: number
}

export interface TDSequentialIndicatorRenderOptions {
  buySetupColor?: string
  sellSetupColor?: string
  /** @deprecated Use buySetupColor and sellSetupColor for directional setup colors. */
  setupColor?: string
  buyCountdownColor?: string
  sellCountdownColor?: string
  resistanceColor?: string
  supportColor?: string
  /** Optional override for both Buy and Sell Perfected Setup marks. */
  perfectedColor?: string
  fontSize?: number
  fontWeight?: number | string
  layerGap?: number
  provisionalOpacity?: number
  showCancelled?: boolean
}

export interface TDSequentialIndicatorExtendData {
  config?: Partial<TDSequentialConfig>
  render?: TDSequentialIndicatorRenderOptions
}

export type TDSequentialInputBar = KLineData & { isClosed?: boolean }
