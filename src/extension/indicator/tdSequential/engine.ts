import {
  getTDSequentialConfigHash,
  PUBLIC_BASELINE_V0_2,
  resolveTDSequentialConfig
} from './config'
import type {
  TDSequentialBarOutput,
  TDSequentialCompletionLifecycle,
  TDSequentialConfig,
  TDSequentialCountdown,
  TDSequentialCountdownCountRecord,
  TDSequentialCountdownDeferredRecord,
  TDSequentialCountdownMark,
  TDSequentialDelta,
  TDSequentialDirection,
  TDSequentialEvent,
  TDSequentialEventType,
  TDSequentialInputBar,
  TDSequentialResult,
  TDSequentialSetup,
  TDSequentialSetupMark,
  TDSequentialSetupScannerState,
  TDSequentialStateSnapshot,
  TDSequentialTDSTLevel
} from './types'

type PriceRelation = -1 | 0 | 1

interface PriceComparator {
  compare: (a: number, b: number) => PriceRelation
}

interface ProcessSetupResult {
  completedSetup?: TDSequentialSetup
  extendedRecycleTrigger?: TDSequentialSetup
}

interface CurrentBarMarks {
  setupMark?: TDSequentialSetupMark
  countdownMarks: TDSequentialCountdownMark[]
  perfectedSetupIds: string[]
}

interface CalculationState {
  outputs: TDSequentialBarOutput[]
  setups: TDSequentialSetup[]
  countdowns: TDSequentialCountdown[]
  tdstLevels: TDSequentialTDSTLevel[]
  completionLifecycles: TDSequentialCompletionLifecycle[]
  events: TDSequentialEvent[]
  snapshots: TDSequentialStateSnapshot[]
}

function createPriceComparator(tickSize?: number): PriceComparator {
  return {
    compare: (a, b) => {
      const epsilon = tickSize !== undefined
        ? tickSize * 0.1
        : Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 8
      if (a < b - epsilon) return -1
      if (a > b + epsilon) return 1
      return 0
    }
  }
}

function scalarCompare(a: number, b: number): PriceRelation {
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 8
  if (a < b - epsilon) return -1
  if (a > b + epsilon) return 1
  return 0
}

function oppositeDirection(direction: TDSequentialDirection): TDSequentialDirection {
  return direction === 'BUY' ? 'SELL' : 'BUY'
}

function sortedById<T extends { id: string }>(items: Iterable<T>): T[] {
  return Array.from(items).sort((a, b) => a.id.localeCompare(b.id))
}

function cloneSetup(setup: TDSequentialSetup): TDSequentialSetup {
  return { ...setup, countBarIndices: [...setup.countBarIndices] }
}

function cloneCountdown(countdown: TDSequentialCountdown): TDSequentialCountdown {
  return {
    ...countdown,
    predecessorCountdownIds: [...countdown.predecessorCountdownIds],
    records: countdown.records.map(record => ({ ...record })),
    deferredCandidates: countdown.deferredCandidates.map(candidate => ({ ...candidate }))
  }
}

function cloneTDSTLevel(level: TDSequentialTDSTLevel): TDSequentialTDSTLevel {
  return { ...level }
}

function cloneCompletionLifecycle(
  lifecycle: TDSequentialCompletionLifecycle
): TDSequentialCompletionLifecycle {
  return { ...lifecycle }
}

function cloneSetupScanner(
  scanner: TDSequentialSetupScannerState
): TDSequentialSetupScannerState {
  return { ...scanner, barIndices: [...scanner.barIndices] }
}

function cloneStateSnapshot(snapshot: TDSequentialStateSnapshot): TDSequentialStateSnapshot {
  return {
    ...snapshot,
    setupScanner: cloneSetupScanner(snapshot.setupScanner),
    setups: snapshot.setups.map(cloneSetup),
    countdowns: snapshot.countdowns.map(cloneCountdown),
    tdstLevels: snapshot.tdstLevels.map(cloneTDSTLevel),
    completionLifecycles: snapshot.completionLifecycles.map(cloneCompletionLifecycle)
  }
}

interface RestoreContext {
  snapshot: TDSequentialStateSnapshot
  outputs: TDSequentialBarOutput[]
  events: TDSequentialEvent[]
}

function validateInputBars(
  bars: readonly TDSequentialInputBar[],
  config: Readonly<TDSequentialConfig>,
  comparator: PriceComparator
): void {
  let previousTimestamp = Number.MIN_SAFE_INTEGER
  let hasUnclosedBar = false

  bars.forEach((bar, index) => {
    if (!Number.isSafeInteger(bar.timestamp)) {
      throw new Error(`TD Sequential bar ${index} timestamp must be a safe integer.`)
    }
    if (bar.timestamp <= previousTimestamp) {
      throw new Error(`TD Sequential bars must use unique, strictly increasing timestamps (index ${index}).`)
    }
    previousTimestamp = bar.timestamp

    const values = [bar.open, bar.high, bar.low, bar.close]
    if (values.some(value => !Number.isFinite(value))) {
      throw new Error(`TD Sequential bar ${index} contains a non-finite OHLC value.`)
    }
    if (comparator.compare(bar.high, Math.max(bar.open, bar.close)) < 0) {
      throw new Error(`TD Sequential bar ${index} high is below open or close.`)
    }
    if (comparator.compare(bar.low, Math.min(bar.open, bar.close)) > 0) {
      throw new Error(`TD Sequential bar ${index} low is above open or close.`)
    }

    const isClosed = bar.isClosed !== false
    if (!isClosed) {
      if (config.calculationMode === 'CLOSED_BAR_ONLY') {
        throw new Error('TD Sequential CLOSED_BAR_ONLY mode does not accept an unclosed bar.')
      }
      if (index !== bars.length - 1 || hasUnclosedBar) {
        throw new Error('TD Sequential only permits one unclosed bar at the end of the input.')
      }
      hasUnclosedBar = true
    }
  })
}

class TDSequentialCalculation {
  private readonly _bars: readonly TDSequentialInputBar[]
  private readonly _config: Readonly<TDSequentialConfig>
  private readonly _configHash: string
  private readonly _comparator: PriceComparator
  private readonly _provisionalLast: boolean
  private readonly _captureSnapshots: boolean

  private readonly _trueHigh: number[] = []
  private readonly _trueLow: number[] = []
  private readonly _outputs: TDSequentialBarOutput[] = []
  private readonly _setups: TDSequentialSetup[] = []
  private readonly _setupById = new Map<string, TDSequentialSetup>()
  private readonly _countdowns: TDSequentialCountdown[] = []
  private readonly _countdownById = new Map<string, TDSequentialCountdown>()
  private readonly _tdstLevels: TDSequentialTDSTLevel[] = []
  private readonly _tdstById = new Map<string, TDSequentialTDSTLevel>()
  private readonly _completionLifecycles: TDSequentialCompletionLifecycle[] = []
  private readonly _completionLifecycleByCountdownId = new Map<string, TDSequentialCompletionLifecycle>()
  private readonly _events: TDSequentialEvent[] = []
  private readonly _eventsByIndex: TDSequentialEvent[][] = []
  private readonly _eventLocalOrdinals = new Map<string, number>()
  private readonly _snapshots: TDSequentialStateSnapshot[] = []

  private _nextEventSequence = 0
  private _currentResistanceId?: string
  private _currentSupportId?: string
  private _currentMarks: CurrentBarMarks = { countdownMarks: [], perfectedSetupIds: [] }
  private _setupScanner: TDSequentialSetupScannerState = {
    direction: null,
    runLength: 0,
    barIndices: []
  }

  constructor(
    bars: readonly TDSequentialInputBar[],
    config: Readonly<TDSequentialConfig>,
    configHash: string,
    provisionalLast: boolean,
    captureSnapshots = false,
    restoreContext?: RestoreContext
  ) {
    this._bars = bars
    this._config = config
    this._configHash = configHash
    this._comparator = createPriceComparator(config.tickSize)
    this._provisionalLast = provisionalLast
    this._captureSnapshots = captureSnapshots
    if (restoreContext !== undefined) this.restore(restoreContext)
  }

  run(): CalculationState {
    for (let i = this._outputs.length; i < this._bars.length; i++) {
      this.processBar(i)
    }
    return {
      outputs: this._outputs,
      setups: this._setups,
      countdowns: this._countdowns,
      tdstLevels: this._tdstLevels,
      completionLifecycles: this._completionLifecycles,
      events: this._events,
      snapshots: this._snapshots
    }
  }

  private restore(context: RestoreContext): void {
    const snapshot = cloneStateSnapshot(context.snapshot)
    if (snapshot.configHash !== this._configHash) {
      throw new Error('TD Sequential snapshot configHash does not match the engine configuration.')
    }
    if (snapshot.afterBarIndex + 1 !== context.outputs.length) {
      throw new Error('TD Sequential snapshot output history is inconsistent with afterBarIndex.')
    }
    if (snapshot.afterBarIndex >= this._bars.length) {
      throw new Error('TD Sequential snapshot is beyond the provided bar history.')
    }
    if (this._bars[snapshot.afterBarIndex].timestamp !== snapshot.afterTimestamp) {
      throw new Error('TD Sequential snapshot timestamp does not match the bar history.')
    }

    this._outputs.push(...context.outputs)
    this._events.push(...context.events)
    context.outputs.forEach(output => {
      this._eventsByIndex[output.barIndex] = output.events
    })
    this._setups.push(...snapshot.setups)
    this._countdowns.push(...snapshot.countdowns)
    this._tdstLevels.push(...snapshot.tdstLevels)
    this._completionLifecycles.push(...snapshot.completionLifecycles)
    this._setupScanner = snapshot.setupScanner
    this._nextEventSequence = snapshot.nextEventSequence

    this._setupScanner.barIndices.forEach(index => {
      const bar = this._bars[index]
      this._trueHigh[index] = index === 0 ? bar.high : Math.max(bar.high, this._bars[index - 1].close)
      this._trueLow[index] = index === 0 ? bar.low : Math.min(bar.low, this._bars[index - 1].close)
    })

    this._setups.forEach(setup => this._setupById.set(setup.id, setup))
    this._countdowns.forEach(countdown => this._countdownById.set(countdown.id, countdown))
    this._tdstLevels.forEach(level => this._tdstById.set(level.id, level))
    this._completionLifecycles.forEach(lifecycle => {
      this._completionLifecycleByCountdownId.set(lifecycle.countdownId, lifecycle)
    })

    const lastOutput = context.outputs[context.outputs.length - 1]
    this._currentResistanceId = lastOutput?.currentTDSTResistanceId
    this._currentSupportId = lastOutput?.currentTDSTSupportId
    context.events.forEach(event => {
      const key = `${event.entityId}:${event.type}:${event.timestamp}`
      this._eventLocalOrdinals.set(key, (this._eventLocalOrdinals.get(key) ?? 0) + 1)
    })
  }

  private isProvisional(i: number): boolean {
    return this._provisionalLast && i === this._bars.length - 1
  }

  private processBar(i: number): void {
    this._currentMarks = { countdownMarks: [], perfectedSetupIds: [] }
    this._eventsByIndex[i] = []
    this.updateDerivedPrices(i)
    this.evaluatePendingLatePerfection(i)

    const setupResult = this.processSetup(i)
    let normalCountdown: TDSequentialCountdown | undefined

    if (setupResult.completedSetup !== undefined) {
      this.createTDST(setupResult.completedSetup, i)
      normalCountdown = this.createNormalCountdown(setupResult.completedSetup, i)
      this.cancelByOppositeSetup(setupResult.completedSetup, i)
    }

    this.cancelByTDST(i)

    if (setupResult.completedSetup !== undefined && normalCountdown !== undefined) {
      this.recycleBySetupRange(setupResult.completedSetup, normalCountdown, i)
    }

    if (setupResult.extendedRecycleTrigger !== undefined) {
      this.recycleByExtendedSetup(setupResult.extendedRecycleTrigger, i)
    }

    this.processCountdowns(i)
    this.updateTDSTDisplayLifecycle(i)
    this.updateCompletionLifecycles(i)
    this.emitBarOutput(i)
    if (this._captureSnapshots) this._snapshots.push(this.createStateSnapshot(i))
  }

  private createStateSnapshot(i: number): TDSequentialStateSnapshot {
    return {
      afterBarIndex: i,
      afterTimestamp: this._bars[i].timestamp,
      configHash: this._configHash,
      nextEventSequence: this._nextEventSequence,
      setupScanner: cloneSetupScanner(this._setupScanner),
      setups: this._setups.map(cloneSetup),
      countdowns: this._countdowns.map(cloneCountdown),
      tdstLevels: this._tdstLevels.map(cloneTDSTLevel),
      completionLifecycles: this._completionLifecycles.map(cloneCompletionLifecycle)
    }
  }

  private updateDerivedPrices(i: number): void {
    const bar = this._bars[i]
    if (i === 0) {
      this._trueHigh[i] = bar.high
      this._trueLow[i] = bar.low
      return
    }
    this._trueHigh[i] = Math.max(bar.high, this._bars[i - 1].close)
    this._trueLow[i] = Math.min(bar.low, this._bars[i - 1].close)
  }

  private setupRelation(i: number): PriceRelation | null {
    if (i < this._config.setupLookback) return null
    return this._comparator.compare(
      this._bars[i].close,
      this._bars[i - this._config.setupLookback].close
    )
  }

  private hasPriceFlip(i: number, direction: TDSequentialDirection): boolean {
    const lookback = this._config.setupLookback
    if (i < lookback + 1) return false
    const current = this._comparator.compare(this._bars[i].close, this._bars[i - lookback].close)
    const previous = this._comparator.compare(
      this._bars[i - 1].close,
      this._bars[i - 1 - lookback].close
    )
    return direction === 'BUY'
      ? current < 0 && previous >= 0
      : current > 0 && previous <= 0
  }

  private processSetup(i: number): ProcessSetupResult {
    const relation = this.setupRelation(i)
    if (relation === null) return {}

    if (relation === 0) {
      if (
        this._config.setupEqualityPolicy === 'CONTINUE_ACTIVE' &&
        this._setupScanner.direction !== null
      ) {
        return this.advanceSetupRun(i, this._setupScanner.direction, false)
      }
      this.interruptSetupRun(i)
      return {}
    }

    const direction: TDSequentialDirection = relation < 0 ? 'BUY' : 'SELL'
    if (this._setupScanner.direction === direction) {
      return this.advanceSetupRun(i, direction, false)
    }

    if (this._setupScanner.direction !== null) {
      this.interruptSetupRun(i)
    }

    const canStart = this._config.setupStartPolicy === 'CONTINUOUS_SCAN' || this.hasPriceFlip(i, direction)
    return canStart ? this.advanceSetupRun(i, direction, true) : {}
  }

  private advanceSetupRun(
    i: number,
    direction: TDSequentialDirection,
    isNew: boolean
  ): ProcessSetupResult {
    if (isNew) {
      const runId = `setup:${direction}:${this._bars[i].timestamp}`
      this._setupScanner = {
        direction,
        runId,
        startIndex: i,
        runLength: 1,
        barIndices: [i]
      }
      this._currentMarks.setupMark = this.createSetupMark(runId, direction, 1, false, i)
      this.emit('SETUP_STARTED', i, runId, direction, { count: 1 })
    } else {
      this._setupScanner.runLength += 1
      this._setupScanner.barIndices.push(i)
      const count = this._setupScanner.runLength
      const runId = this._setupScanner.runId as string
      if (count <= this._config.setupLength) {
        this._currentMarks.setupMark = this.createSetupMark(
          runId,
          direction,
          count,
          count === this._config.setupLength,
          i
        )
      }
      this.emit('SETUP_PROGRESS', i, runId, direction, { count })
    }

    const runLength = this._setupScanner.runLength
    if (runLength === this._config.setupLength) {
      const setup = this.completeSetup(i)
      return { completedSetup: setup }
    }

    if (runLength > this._config.setupLength && this._setupScanner.completedSetupId !== undefined) {
      const setup = this._setupById.get(this._setupScanner.completedSetupId) as TDSequentialSetup
      setup.extendedRunLength = runLength
      if (
        this._config.enableRecycle &&
        runLength === this._config.recycleSetupCount &&
        setup.recycleTriggerIndex === undefined
      ) {
        setup.recycleTriggerIndex = i
        this.emit('SETUP_RECYCLE_TRIGGERED', i, setup.id, setup.direction, {
          extendedRunLength: runLength
        })
        return { extendedRecycleTrigger: setup }
      }
    }

    return {}
  }

  private createSetupMark(
    setupId: string,
    direction: TDSequentialDirection,
    value: number,
    completed: boolean,
    i: number
  ): TDSequentialSetupMark {
    return { setupId, direction, value, completed, provisional: this.isProvisional(i) }
  }

  private interruptSetupRun(i: number): void {
    if (this._setupScanner.direction === null) return
    const { direction, runId, runLength, completedSetupId } = this._setupScanner
    this.emit('SETUP_INTERRUPTED', i, runId as string, direction, {
      runLength,
      endIndex: i - 1
    })
    if (completedSetupId !== undefined) {
      const setup = this._setupById.get(completedSetupId)
      if (setup !== undefined) setup.extendedRunEndIndex = i - 1
    }
    this._setupScanner = { direction: null, runLength: 0, barIndices: [] }
  }

  private completeSetup(i: number): TDSequentialSetup {
    const direction = this._setupScanner.direction as TDSequentialDirection
    const id = this._setupScanner.runId as string
    const countBarIndices = this._setupScanner.barIndices.slice(0, this._config.setupLength)
    const highestTrueHigh = Math.max(...countBarIndices.map(index => this._trueHigh[index]))
    const lowestTrueLow = Math.min(...countBarIndices.map(index => this._trueLow[index]))
    const perfection = this.getInitialPerfection(direction, countBarIndices)
    const setup: TDSequentialSetup = {
      id,
      direction,
      runId: id,
      startIndex: this._setupScanner.startIndex as number,
      completionIndex: i,
      countBarIndices,
      highestTrueHigh,
      lowestTrueLow,
      range: highestTrueHigh - lowestTrueLow,
      perfectionState: perfection.state,
      perfectionIndex: perfection.index,
      perfectionDetectionIndex: perfection.index !== undefined ? i : undefined,
      extendedRunLength: this._config.setupLength
    }
    this._setups.push(setup)
    this._setupById.set(id, setup)
    this._setupScanner.completedSetupId = id
    this.emit('SETUP_COMPLETED', i, id, direction, { setupId: id })

    if (setup.perfectionState === 'PERFECTED') {
      this.recordSetupPerfected(setup, i)
    }
    this.finalizeSupersededPendingSetups(setup.id, i)
    return setup
  }

  private getInitialPerfection(
    direction: TDSequentialDirection,
    indices: number[]
  ): { state: TDSequentialSetup['perfectionState'], index?: number } {
    if (!this._config.enablePerfection) return { state: 'DISABLED' }

    const candidateA = indices[this._config.setupLength - 2]
    const candidateB = indices[this._config.setupLength - 1]
    const referenceA = indices[this._config.setupLength - 4]
    const referenceB = indices[this._config.setupLength - 3]
    const passes = (candidate: number): boolean => direction === 'BUY'
      ? this._comparator.compare(this._bars[candidate].low, this._bars[referenceA].low) < 0 &&
        this._comparator.compare(this._bars[candidate].low, this._bars[referenceB].low) < 0
      : this._comparator.compare(this._bars[candidate].high, this._bars[referenceA].high) > 0 &&
        this._comparator.compare(this._bars[candidate].high, this._bars[referenceB].high) > 0

    if (passes(candidateA)) return { state: 'PERFECTED', index: candidateA }
    if (passes(candidateB)) return { state: 'PERFECTED', index: candidateB }
    return {
      state: this._config.latePerfectionPolicy === 'DISABLED'
        ? 'IMPERFECTED_FINAL'
        : 'PENDING'
    }
  }

  private evaluatePendingLatePerfection(i: number): void {
    if (this._config.latePerfectionPolicy === 'DISABLED') return
    for (const setup of sortedById(this._setups)) {
      if (setup.perfectionState !== 'PENDING') continue
      const referenceA = setup.countBarIndices[this._config.setupLength - 4]
      const referenceB = setup.countBarIndices[this._config.setupLength - 3]
      const passes = setup.direction === 'BUY'
        ? this._comparator.compare(this._bars[i].low, this._bars[referenceA].low) < 0 &&
          this._comparator.compare(this._bars[i].low, this._bars[referenceB].low) < 0
        : this._comparator.compare(this._bars[i].high, this._bars[referenceA].high) > 0 &&
          this._comparator.compare(this._bars[i].high, this._bars[referenceB].high) > 0
      if (passes) {
        setup.perfectionState = 'PERFECTED'
        setup.perfectionIndex = i
        setup.perfectionDetectionIndex = i
        this.recordSetupPerfected(setup, i)
      }
    }
  }

  private recordSetupPerfected(setup: TDSequentialSetup, i: number): void {
    this._currentMarks.perfectedSetupIds.push(setup.id)
    this.emit('SETUP_PERFECTED', i, setup.id, setup.direction, {
      perfectionIndex: setup.perfectionIndex,
      detectionIndex: i
    })
  }

  private finalizeSupersededPendingSetups(newSetupId: string, i: number): void {
    for (const setup of sortedById(this._setups)) {
      if (setup.id === newSetupId || setup.perfectionState !== 'PENDING') continue
      setup.perfectionState = 'IMPERFECTED_FINAL'
      setup.supersededIndex = i
      this.emit('SETUP_IMPERFECTED_FINAL', i, setup.id, setup.direction, {
        supersededBySetupId: newSetupId
      })
    }
  }

  private createTDST(setup: TDSequentialSetup, i: number): TDSequentialTDSTLevel {
    const type = setup.direction === 'BUY' ? 'RESISTANCE' : 'SUPPORT'
    const currentId = type === 'RESISTANCE' ? this._currentResistanceId : this._currentSupportId
    if (currentId !== undefined) {
      const current = this._tdstById.get(currentId)
      if (current?.state === 'ACTIVE') {
        current.state = 'REPLACED'
        current.endIndex = i
        this.emit('TDST_REPLACED', i, current.id, current.direction, {
          levelId: current.id,
          price: current.price,
          replacementLevelId: `tdst:${setup.id}`
        })
      }
    }

    const level: TDSequentialTDSTLevel = {
      id: `tdst:${setup.id}`,
      setupId: setup.id,
      direction: setup.direction,
      type,
      price: type === 'RESISTANCE' ? setup.highestTrueHigh : setup.lowestTrueLow,
      startIndex: i,
      state: 'ACTIVE',
      breakPolicy: 'SIMPLE_CLOSE',
      breakoutQualification: 'NOT_IMPLEMENTED'
    }
    this._tdstLevels.push(level)
    this._tdstById.set(level.id, level)
    if (type === 'RESISTANCE') this._currentResistanceId = level.id
    else this._currentSupportId = level.id
    this.emit('TDST_CREATED', i, level.id, level.direction, {
      levelId: level.id,
      setupId: setup.id,
      type,
      price: level.price
    })
    return level
  }

  private createNormalCountdown(setup: TDSequentialSetup, i: number): TDSequentialCountdown {
    return this.createCountdown(
      `countdown:${setup.id}:0`,
      setup,
      i,
      this._config.countdownStartPolicy === 'ON_SETUP_COMPLETION_BAR' ? i : i + 1,
      []
    )
  }

  private createCountdown(
    id: string,
    setup: TDSequentialSetup,
    creationIndex: number,
    startEligibilityIndex: number,
    predecessorCountdownIds: string[]
  ): TDSequentialCountdown {
    if (this._countdownById.has(id)) {
      throw new Error(`Duplicate TD Sequential countdown id: ${id}`)
    }
    const countdown: TDSequentialCountdown = {
      id,
      direction: setup.direction,
      originSetupId: setup.id,
      predecessorCountdownIds: [...predecessorCountdownIds].sort(),
      creationIndex,
      startEligibilityIndex,
      count: 0,
      records: [],
      deferredCandidates: [],
      phase: creationIndex >= startEligibilityIndex ? 'COUNTING' : 'WAITING',
      disposition: 'ACTIVE'
    }
    this._countdowns.push(countdown)
    this._countdownById.set(id, countdown)
    this.emit('COUNTDOWN_CREATED', creationIndex, id, countdown.direction, {
      originSetupId: setup.id,
      startEligibilityIndex,
      predecessorCountdownIds: [...countdown.predecessorCountdownIds]
    })
    return countdown
  }

  private cancelByOppositeSetup(setup: TDSequentialSetup, i: number): void {
    if (!this._config.enableOppositeSetupCancellation) return
    const targetDirection = oppositeDirection(setup.direction)
    for (const countdown of sortedById(this._countdowns)) {
      if (
        countdown.direction === targetDirection &&
        countdown.phase !== 'COMPLETED' &&
        countdown.disposition === 'ACTIVE'
      ) {
        this.cancelCountdown(countdown, 'OPPOSITE_SETUP', i, { setupId: setup.id })
      }
    }
  }

  private cancelByTDST(i: number): void {
    if (!this._config.enableTDSTCancellation) return
    for (const countdown of sortedById(this._countdowns)) {
      if (countdown.phase === 'COMPLETED' || countdown.disposition !== 'ACTIVE') continue
      const level = this._tdstById.get(`tdst:${countdown.originSetupId}`)
      if (level === undefined) continue
      const violates = countdown.direction === 'BUY'
        ? this._comparator.compare(this._trueLow[i], level.price) > 0
        : this._comparator.compare(this._trueHigh[i], level.price) < 0
      if (violates) {
        this.cancelCountdown(countdown, 'TDST_VIOLATION', i, { tdstLevelId: level.id })
      }
    }
  }

  private cancelCountdown(
    countdown: TDSequentialCountdown,
    reason: NonNullable<TDSequentialCountdown['cancellationReason']>,
    i: number,
    extraPayload: Record<string, unknown>
  ): void {
    countdown.disposition = 'CANCELLED'
    countdown.cancellationIndex = i
    countdown.cancellationReason = reason
    this.emit('COUNTDOWN_CANCELLED', i, countdown.id, countdown.direction, {
      reason,
      ...extraPayload
    })
  }

  private recycleBySetupRange(
    setup: TDSequentialSetup,
    normalCountdown: TDSequentialCountdown,
    i: number
  ): void {
    if (!this._config.enableRecycle || !this._config.enableRangeRecycle) return
    const targets = sortedById(this._countdowns).filter(countdown => {
      if (
        countdown.id === normalCountdown.id ||
        countdown.direction !== setup.direction ||
        countdown.disposition !== 'ACTIVE'
      ) return false
      const origin = this._setupById.get(countdown.originSetupId)
      return origin !== undefined && origin.completionIndex < setup.completionIndex
    })

    for (const countdown of targets) {
      const origin = this._setupById.get(countdown.originSetupId) as TDSequentialSetup
      if (this._comparator.compare(origin.range, 0) <= 0) {
        this.emit('DIAGNOSTIC', i, countdown.id, countdown.direction, {
          code: 'ZERO_OR_NEAR_ZERO_SETUP_RANGE',
          setupId: origin.id
        })
        continue
      }
      const ratio = setup.range / origin.range
      if (
        scalarCompare(ratio, this._config.recycleRangeMinRatio) >= 0 &&
        scalarCompare(ratio, this._config.recycleRangeMaxRatio) <= 0
      ) {
        this.recycleCountdown(
          countdown,
          'SETUP_RANGE_RATIO',
          setup,
          normalCountdown.id,
          i,
          { ratio }
        )
        normalCountdown.predecessorCountdownIds.push(countdown.id)
      }
    }
    normalCountdown.predecessorCountdownIds.sort()
  }

  private recycleByExtendedSetup(setup: TDSequentialSetup, i: number): void {
    if (!this._config.enableRecycle) return
    const targets = sortedById(this._countdowns).filter(countdown => (
      countdown.originSetupId === setup.id && countdown.disposition === 'ACTIVE'
    ))
    if (targets.length === 0) return

    const replacementId = `countdown:${setup.id}:recycle:${this._bars[i].timestamp}`
    targets.forEach(countdown => {
      this.recycleCountdown(
        countdown,
        'SETUP_EXTENDED_COUNT',
        setup,
        replacementId,
        i,
        { extendedRunLength: setup.extendedRunLength }
      )
    })
    this.createCountdown(replacementId, setup, i, i, targets.map(target => target.id))
  }

  private recycleCountdown(
    countdown: TDSequentialCountdown,
    reason: NonNullable<TDSequentialCountdown['recycleReason']>,
    triggerSetup: TDSequentialSetup,
    replacementCountdownId: string,
    i: number,
    extraPayload: Record<string, unknown>
  ): void {
    countdown.disposition = 'RECYCLED'
    countdown.recycleIndex = i
    countdown.recycleReason = reason
    countdown.recycleTriggerSetupId = triggerSetup.id
    this.invalidateCompletionLifecycle(countdown, i)
    this._currentMarks.countdownMarks.push({
      countdownId: countdown.id,
      direction: countdown.direction,
      value: 'R',
      kind: 'RECYCLED',
      provisional: this.isProvisional(i)
    })
    this.emit('COUNTDOWN_RECYCLED', i, countdown.id, countdown.direction, {
      reason,
      triggerSetupId: triggerSetup.id,
      recycledCountdownId: countdown.id,
      replacementCountdownId,
      ...extraPayload
    })
  }

  private processCountdowns(i: number): void {
    for (const countdown of sortedById(this._countdowns)) {
      if (
        countdown.disposition !== 'ACTIVE' ||
        countdown.phase === 'COMPLETED' ||
        i < countdown.startEligibilityIndex
      ) continue

      countdown.phase = 'COUNTING'
      const nextOrdinal = countdown.count + 1
      const qualification = this.getCountdownQualification(countdown, nextOrdinal, i)
      if (!qualification.passes) continue

      if (
        nextOrdinal === 8 &&
        this._config.enable8Vs5Deferral &&
        !this.passes8Vs5(countdown, i)
      ) {
        this.deferCountdown(countdown, 8, 'EIGHT_VS_FIVE', i)
        continue
      }

      if (
        nextOrdinal === this._config.countdownLength &&
        this._config.enableFinalVs8Deferral &&
        !this.passesFinalVs8(countdown, i)
      ) {
        this.deferCountdown(countdown, 'FINAL', 'FINAL_VS_EIGHT', i)
        continue
      }

      const bar = this._bars[i]
      const record: TDSequentialCountdownCountRecord = {
        ordinal: nextOrdinal,
        barIndex: i,
        timestamp: bar.timestamp,
        comparisonSource: qualification.source,
        comparisonValue: qualification.value,
        close: bar.close,
        high: bar.high,
        low: bar.low
      }
      countdown.records.push(record)
      countdown.count = nextOrdinal
      const completed = nextOrdinal === this._config.countdownLength
      this._currentMarks.countdownMarks.push({
        countdownId: countdown.id,
        direction: countdown.direction,
        value: nextOrdinal,
        kind: completed ? 'COMPLETED' : 'COUNT',
        provisional: this.isProvisional(i)
      })
      this.emit('COUNTDOWN_PROGRESS', i, countdown.id, countdown.direction, { record })

      if (completed) {
        countdown.phase = 'COMPLETED'
        countdown.completionIndex = i
        const lifecycle: TDSequentialCompletionLifecycle = {
          countdownId: countdown.id,
          completionIndex: i,
          barsSinceCompletion: 0,
          state: 'WITHIN_12_BARS'
        }
        this._completionLifecycles.push(lifecycle)
        this._completionLifecycleByCountdownId.set(countdown.id, lifecycle)
        this.emit('COUNTDOWN_COMPLETED', i, countdown.id, countdown.direction, {
          completionIndex: i
        })
      }
    }
  }

  private getCountdownQualification(
    countdown: TDSequentialCountdown,
    nextOrdinal: number,
    i: number
  ): { passes: boolean, source: 'CLOSE' | 'OPEN_OR_CLOSE', value: number } {
    const referenceIndex = i - this._config.countdownLookback
    const bar = this._bars[i]
    const isFinal = nextOrdinal === this._config.countdownLength
    const source = isFinal ? this._config.finalCountComparisonSource : 'CLOSE'
    let value = bar.close
    if (source === 'OPEN_OR_CLOSE') {
      value = countdown.direction === 'BUY'
        ? Math.min(bar.open, bar.close)
        : Math.max(bar.open, bar.close)
    }
    if (referenceIndex < 0) return { passes: false, source, value }

    const reference = countdown.direction === 'BUY'
      ? this._bars[referenceIndex].low
      : this._bars[referenceIndex].high
    const relation = this._comparator.compare(value, reference)
    const passes = countdown.direction === 'BUY'
      ? (this._config.countdownAllowEqual ? relation <= 0 : relation < 0)
      : (this._config.countdownAllowEqual ? relation >= 0 : relation > 0)
    return { passes, source, value }
  }

  private passes8Vs5(countdown: TDSequentialCountdown, i: number): boolean {
    const count5 = countdown.records.find(record => record.ordinal === 5)
    if (count5 === undefined) return false
    return countdown.direction === 'BUY'
      ? this._comparator.compare(this._bars[i].low, count5.close) < 0
      : this._comparator.compare(this._bars[i].high, count5.close) > 0
  }

  private passesFinalVs8(countdown: TDSequentialCountdown, i: number): boolean {
    const count8 = countdown.records.find(record => record.ordinal === 8)
    if (count8 === undefined) return false
    return countdown.direction === 'BUY'
      ? this._comparator.compare(this._bars[i].low, count8.close) <= 0
      : this._comparator.compare(this._bars[i].high, count8.close) >= 0
  }

  private deferCountdown(
    countdown: TDSequentialCountdown,
    attemptedOrdinal: 8 | 'FINAL',
    reason: TDSequentialCountdownDeferredRecord['reason'],
    i: number
  ): void {
    const deferred: TDSequentialCountdownDeferredRecord = {
      attemptedOrdinal,
      barIndex: i,
      timestamp: this._bars[i].timestamp,
      reason
    }
    countdown.deferredCandidates.push(deferred)
    this._currentMarks.countdownMarks.push({
      countdownId: countdown.id,
      direction: countdown.direction,
      value: '+',
      kind: 'DEFERRED',
      provisional: this.isProvisional(i)
    })
    this.emit('COUNTDOWN_DEFERRED', i, countdown.id, countdown.direction, { deferred })
  }

  private invalidateCompletionLifecycle(countdown: TDSequentialCountdown, i: number): void {
    const lifecycle = this._completionLifecycleByCountdownId.get(countdown.id)
    if (lifecycle?.state === undefined || lifecycle.state === 'INVALIDATED_BY_RECYCLE') return
    lifecycle.barsSinceCompletion = i - lifecycle.completionIndex
    lifecycle.state = 'INVALIDATED_BY_RECYCLE'
    lifecycle.stateChangedIndex = i
  }

  private updateTDSTDisplayLifecycle(i: number): void {
    const bar = this._bars[i]
    const activeIds = [this._currentResistanceId, this._currentSupportId]
    activeIds.forEach(id => {
      if (id === undefined) return
      const level = this._tdstById.get(id)
      if (level?.state !== 'ACTIVE' || i <= level.startIndex) return
      const broken = level.type === 'RESISTANCE'
        ? this._comparator.compare(bar.close, level.price) > 0
        : this._comparator.compare(bar.close, level.price) < 0
      if (!broken) return
      level.state = 'BROKEN'
      level.endIndex = i
      if (level.type === 'RESISTANCE') this._currentResistanceId = undefined
      else this._currentSupportId = undefined
      this.emit('TDST_BROKEN', i, level.id, level.direction, {
        levelId: level.id,
        price: level.price,
        close: bar.close,
        breakoutQualification: level.breakoutQualification
      })
    })
  }

  private updateCompletionLifecycles(i: number): void {
    const sorted = [...this._completionLifecycles].sort((a, b) => a.countdownId.localeCompare(b.countdownId))
    sorted.forEach(lifecycle => {
      if (lifecycle.state === 'INVALIDATED_BY_RECYCLE') return
      lifecycle.barsSinceCompletion = i - lifecycle.completionIndex
      if (lifecycle.state === 'WITHIN_12_BARS' && lifecycle.barsSinceCompletion >= 13) {
        lifecycle.state = 'AFTER_12_BARS'
        lifecycle.stateChangedIndex = i
        const countdown = this._countdownById.get(lifecycle.countdownId)
        this.emit('COMPLETION_WINDOW_ELAPSED', i, lifecycle.countdownId, countdown?.direction, {
          completionIndex: lifecycle.completionIndex,
          barsSinceCompletion: lifecycle.barsSinceCompletion
        })
      }
    })
  }

  private emitBarOutput(i: number): void {
    const resistance = this._currentResistanceId !== undefined
      ? this._tdstById.get(this._currentResistanceId)
      : undefined
    const support = this._currentSupportId !== undefined
      ? this._tdstById.get(this._currentSupportId)
      : undefined
    this._currentMarks.countdownMarks.sort((a, b) => (
      a.countdownId.localeCompare(b.countdownId) || String(a.value).localeCompare(String(b.value))
    ))
    this._currentMarks.perfectedSetupIds.sort()
    this._outputs.push({
      barIndex: i,
      timestamp: this._bars[i].timestamp,
      provisional: this.isProvisional(i),
      setupMark: this._currentMarks.setupMark,
      countdownMarks: this._currentMarks.countdownMarks,
      perfectedSetupIds: this._currentMarks.perfectedSetupIds,
      currentTDSTResistanceId: resistance?.id,
      currentTDSTSupportId: support?.id,
      tdstResistance: resistance?.price,
      tdstSupport: support?.price,
      events: this._eventsByIndex[i]
    })
  }

  private emit(
    type: TDSequentialEventType,
    i: number,
    entityId: string,
    direction: TDSequentialDirection | undefined,
    payload: Record<string, unknown>
  ): TDSequentialEvent {
    const localKey = `${entityId}:${type}:${this._bars[i].timestamp}`
    const localOrdinal = this._eventLocalOrdinals.get(localKey) ?? 0
    this._eventLocalOrdinals.set(localKey, localOrdinal + 1)
    const event: TDSequentialEvent = {
      id: `event:${entityId}:${type}:${this._bars[i].timestamp}:${localOrdinal}`,
      type,
      sequence: this._nextEventSequence++,
      barIndex: i,
      timestamp: this._bars[i].timestamp,
      direction,
      entityId,
      configHash: this._configHash,
      provisional: this.isProvisional(i),
      payload
    }
    this._events.push(event)
    this._eventsByIndex[i].push(event)
    return event
  }
}

function compatibilityFor(config: Readonly<TDSequentialConfig>): TDSequentialResult['compatibility'] {
  switch (config.profile) {
    case 'PUBLIC_BASELINE_V0_2': return 'PUBLIC_RULES_BASELINE'
    case 'TRADINGVIEW_STYLE_PUBLIC_V0_2': return 'DOCUMENTED_PUBLIC_SETTINGS_PARTIAL'
    default: return 'CUSTOM_RULESET'
  }
}

function createResult(
  state: CalculationState,
  config: TDSequentialConfig,
  configHash: string,
  provisional?: TDSequentialBarOutput
): TDSequentialResult {
  return {
    rulesetVersion: '0.2',
    profile: config.profile,
    compatibility: compatibilityFor(config),
    config: Object.freeze({ ...config }),
    configHash,
    capabilities: {
      riskLevel: 'NOT_IMPLEMENTED',
      intersection: 'DISABLED',
      breakoutQualification: 'NOT_IMPLEMENTED'
    },
    committedBarCount: state.outputs.length,
    bars: state.outputs,
    setups: state.setups,
    countdowns: state.countdowns,
    tdstLevels: state.tdstLevels,
    completionLifecycles: state.completionLifecycles,
    events: state.events,
    provisional
  }
}

interface CalculationBundle {
  result: TDSequentialResult
  snapshots: TDSequentialStateSnapshot[]
}

function calculateTDSequentialBundle(
  dataList: readonly TDSequentialInputBar[],
  inputConfig: Partial<TDSequentialConfig>,
  captureSnapshots: boolean
): CalculationBundle {
  const config = resolveTDSequentialConfig(inputConfig)
  const configHash = getTDSequentialConfigHash(config)
  const comparator = createPriceComparator(config.tickSize)
  validateInputBars(dataList, config, comparator)

  const hasProvisional = dataList.length > 0 && dataList[dataList.length - 1].isClosed === false
  const committedBars = hasProvisional ? dataList.slice(0, -1) : dataList
  const committedState = new TDSequentialCalculation(
    committedBars,
    config,
    configHash,
    false,
    captureSnapshots
  ).run()
  let provisional: TDSequentialBarOutput | undefined

  if (hasProvisional) {
    const snapshot = committedState.snapshots[committedState.snapshots.length - 1]
    const restoreContext = snapshot === undefined
      ? undefined
      : {
        snapshot,
        outputs: committedState.outputs,
        events: committedState.events
      }
    const provisionalState = new TDSequentialCalculation(
      dataList,
      config,
      configHash,
      true,
      false,
      restoreContext
    ).run()
    provisional = provisionalState.outputs[provisionalState.outputs.length - 1]
  }

  return {
    result: createResult(committedState, config, configHash, provisional),
    snapshots: committedState.snapshots
  }
}

export function calculateTDSequential(
  dataList: readonly TDSequentialInputBar[],
  inputConfig: Partial<TDSequentialConfig> = PUBLIC_BASELINE_V0_2
): TDSequentialResult {
  return calculateTDSequentialBundle(dataList, inputConfig, false).result
}

function resultAtSnapshot(
  snapshot: TDSequentialStateSnapshot | undefined,
  source: TDSequentialResult | undefined,
  config: TDSequentialConfig,
  configHash: string
): TDSequentialResult {
  if (snapshot === undefined) {
    return createResult({
      outputs: [],
      setups: [],
      countdowns: [],
      tdstLevels: [],
      completionLifecycles: [],
      events: [],
      snapshots: []
    }, config, configHash)
  }
  if (source === undefined) {
    throw new Error('TD Sequential snapshot restoration requires its event and bar-output history.')
  }
  const cloned = cloneStateSnapshot(snapshot)
  return createResult({
    outputs: source.bars.slice(0, snapshot.afterBarIndex + 1),
    setups: cloned.setups,
    countdowns: cloned.countdowns,
    tdstLevels: cloned.tdstLevels,
    completionLifecycles: cloned.completionLifecycles,
    events: source.events.filter(event => event.sequence < snapshot.nextEventSequence),
    snapshots: []
  }, config, configHash)
}

function calculateAfterSnapshot(
  dataList: readonly TDSequentialInputBar[],
  config: TDSequentialConfig,
  configHash: string,
  baseResult: TDSequentialResult,
  snapshot: TDSequentialStateSnapshot | undefined,
  provisional: boolean
): CalculationBundle {
  validateInputBars(dataList, config, createPriceComparator(config.tickSize))
  const restoreContext = snapshot === undefined
    ? undefined
    : { snapshot, outputs: baseResult.bars, events: baseResult.events }
  const state = new TDSequentialCalculation(
    dataList,
    config,
    configHash,
    provisional,
    !provisional,
    restoreContext
  ).run()
  if (provisional) {
    return {
      result: {
        ...baseResult,
        provisional: state.outputs[state.outputs.length - 1]
      },
      snapshots: []
    }
  }
  return {
    result: createResult(state, config, configHash),
    snapshots: state.snapshots
  }
}

function collectEntityState(result: TDSequentialResult): Map<string, unknown> {
  const entities = new Map<string, unknown>()
  result.setups.forEach(setup => entities.set(setup.id, setup))
  result.countdowns.forEach(countdown => entities.set(countdown.id, countdown))
  result.tdstLevels.forEach(level => entities.set(level.id, level))
  result.completionLifecycles.forEach(lifecycle => {
    entities.set(`lifecycle:${lifecycle.countdownId}`, lifecycle)
  })
  return entities
}

function createDelta(
  operation: TDSequentialDelta['operation'],
  previous: TDSequentialResult,
  next: TDSequentialResult,
  changedTimestamp?: number,
  removedBarTimestamp?: number
): TDSequentialDelta {
  const previousEvents = new Set(previous.events.map(event => event.id))
  const nextEvents = new Set(next.events.map(event => event.id))
  const previousEntities = collectEntityState(previous)
  const nextEntities = collectEntityState(next)
  const addedOrUpdatedEntityIds: string[] = []
  const removedEntityIds: string[] = []

  nextEntities.forEach((entity, id) => {
    if (!previousEntities.has(id) || JSON.stringify(previousEntities.get(id)) !== JSON.stringify(entity)) {
      addedOrUpdatedEntityIds.push(id)
    }
  })
  previousEntities.forEach((_entity, id) => {
    if (!nextEntities.has(id)) removedEntityIds.push(id)
  })

  const committedBarOutput = changedTimestamp === undefined
    ? undefined
    : next.bars.find(output => output.timestamp === changedTimestamp)

  return {
    operation,
    addedEventIds: [...nextEvents].filter(id => !previousEvents.has(id)).sort(),
    removedEventIds: [...previousEvents].filter(id => !nextEvents.has(id)).sort(),
    addedOrUpdatedEntityIds: addedOrUpdatedEntityIds.sort(),
    removedEntityIds: removedEntityIds.sort(),
    committedBarOutput,
    provisionalBarOutput: next.provisional,
    removedBarTimestamp
  }
}

export class TDSequentialEngine {
  private readonly _config: TDSequentialConfig
  private readonly _configHash: string
  private _dataList: TDSequentialInputBar[] = []
  private _result: TDSequentialResult
  private _snapshots: TDSequentialStateSnapshot[] = []

  constructor(inputConfig: Partial<TDSequentialConfig> = PUBLIC_BASELINE_V0_2) {
    this._config = resolveTDSequentialConfig(inputConfig)
    this._configHash = getTDSequentialConfigHash(this._config)
    this._result = resultAtSnapshot(undefined, undefined, this._config, this._configHash)
  }

  get result(): TDSequentialResult {
    return this._result
  }

  get dataList(): readonly TDSequentialInputBar[] {
    return this._dataList
  }

  get snapshots(): readonly TDSequentialStateSnapshot[] {
    return this._snapshots.map(cloneStateSnapshot)
  }

  calculate(dataList: readonly TDSequentialInputBar[]): TDSequentialResult {
    const nextDataList = dataList.map(bar => ({ ...bar }))
    const bundle = calculateTDSequentialBundle(nextDataList, this._config, true)
    this._dataList = nextDataList
    this._result = bundle.result
    this._snapshots = bundle.snapshots
    return bundle.result
  }

  appendBar(bar: TDSequentialInputBar): TDSequentialDelta {
    const last = this._dataList[this._dataList.length - 1]
    if (last !== undefined && bar.timestamp <= last.timestamp) {
      throw new Error('TD Sequential appendBar timestamp must be greater than the current last timestamp.')
    }
    const nextDataList = [...this._dataList, { ...bar }]
    const snapshot = this._snapshots[this._snapshots.length - 1]
    const bundle = calculateAfterSnapshot(
      nextDataList,
      this._config,
      this._configHash,
      this._result,
      snapshot,
      bar.isClosed === false
    )
    const delta = createDelta('APPEND', this._result, bundle.result, bar.timestamp)
    this._dataList = nextDataList
    this._result = bundle.result
    this._snapshots.push(...bundle.snapshots)
    return delta
  }

  replaceLastBar(bar: TDSequentialInputBar): TDSequentialDelta {
    const last = this._dataList[this._dataList.length - 1]
    if (last === undefined) throw new Error('TD Sequential replaceLastBar requires an existing bar.')
    if (bar.timestamp !== last.timestamp) {
      throw new Error('TD Sequential replaceLastBar must preserve the last timestamp.')
    }
    const nextDataList = [...this._dataList.slice(0, -1), { ...bar }]
    const lastWasProvisional = last.isClosed === false
    const baseSnapshotIndex = lastWasProvisional
      ? this._snapshots.length - 1
      : this._snapshots.length - 2
    const baseSnapshot = this._snapshots[baseSnapshotIndex]
    const baseResult = lastWasProvisional
      ? { ...this._result, provisional: undefined }
      : resultAtSnapshot(baseSnapshot, this._result, this._config, this._configHash)
    const bundle = calculateAfterSnapshot(
      nextDataList,
      this._config,
      this._configHash,
      baseResult,
      baseSnapshot,
      bar.isClosed === false
    )
    const delta = createDelta('REPLACE_LAST', this._result, bundle.result, bar.timestamp)
    this._dataList = nextDataList
    this._result = bundle.result
    this._snapshots = this._snapshots.slice(0, baseSnapshotIndex + 1)
    this._snapshots.push(...bundle.snapshots)
    return delta
  }

  removeLastBar(): TDSequentialDelta {
    const last = this._dataList[this._dataList.length - 1]
    if (last === undefined) throw new Error('TD Sequential removeLastBar requires an existing bar.')
    const nextDataList = this._dataList.slice(0, -1)
    const lastWasProvisional = last.isClosed === false
    const nextSnapshots = lastWasProvisional ? this._snapshots : this._snapshots.slice(0, -1)
    const nextSnapshot = nextSnapshots[nextSnapshots.length - 1]
    const nextResult = lastWasProvisional
      ? { ...this._result, provisional: undefined }
      : resultAtSnapshot(nextSnapshot, this._result, this._config, this._configHash)
    const delta = createDelta('REMOVE_LAST', this._result, nextResult, undefined, last.timestamp)
    this._dataList = nextDataList
    this._result = nextResult
    this._snapshots = nextSnapshots
    return delta
  }

  restoreSnapshot(afterBarIndex: number): TDSequentialResult {
    if (!Number.isSafeInteger(afterBarIndex) || afterBarIndex < -1) {
      throw new Error('TD Sequential restoreSnapshot afterBarIndex must be a safe integer >= -1.')
    }
    if (afterBarIndex >= this._snapshots.length) {
      throw new Error('TD Sequential restoreSnapshot index is not available.')
    }
    const snapshot = afterBarIndex === -1 ? undefined : this._snapshots[afterBarIndex]
    this._result = resultAtSnapshot(snapshot, this._result, this._config, this._configHash)
    this._dataList = this._dataList.slice(0, afterBarIndex + 1)
    this._snapshots = this._snapshots.slice(0, afterBarIndex + 1)
    return this._result
  }
}
