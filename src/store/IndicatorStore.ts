import type ChartStore from './ChartStore'
import { type IndicatorCreate, type IndicatorOverride, Indicator, type IndicatorFilter, IndicatorSeries } from '../component/Indicator'
import { isValid, isString } from '../common/utils/typeChecks'
import { getIndicatorTemplate } from '../extension/indicator/index'

export default class IndicatorStore {
  private readonly _chartStore: ChartStore
  private readonly _instances = new Map<string, Indicator[]>()
  private readonly _pendingCalculations = new Map<Indicator, { result: Promise<boolean>, finish: (committed: boolean) => void }>()
  private readonly _overrides = new WeakMap<Indicator, object>()

  constructor(chartStore: ChartStore) {
    this._chartStore = chartStore
  }

  private _sort(paneId?: string): void {
    if (isString(paneId)) {
      this._instances.get(paneId)?.sort((i1, i2) => i1.zLevel - i2.zLevel)
    } else {
      this._instances.forEach((paneInstances) => {
        paneInstances.sort((i1, i2) => i1.zLevel - i2.zLevel)
      })
    }
  }

  addInstance(indicator: IndicatorCreate, paneId: string, isStack: boolean): Promise<boolean> {
    return this._chartStore.batchEffects(() => this._addInstance(indicator, paneId, isStack))
  }

  private _addInstance(indicator: IndicatorCreate, paneId: string, isStack: boolean): Promise<boolean> {
    const { name, id } = indicator
    let paneInstances = this._instances.get(paneId)
    if (isValid(paneInstances) && isValid(id)) {
      // Check for duplicate id, not name (allow multiple indicators with same name but different ids)
      const instance = paneInstances.find((ins) => ins.id === id)
      if (isValid(instance)) {
        return Promise.reject(new Error('Duplicate indicator id.'))
      }
    }
    if (!isValid(paneInstances)) {
      paneInstances = []
    }
    const indicatorTemplate = getIndicatorTemplate(name)
    if (!indicatorTemplate) {
      return Promise.reject(new Error(`Indicator template '${name}' not found.`))
    }
    const indicatorInstance = new Indicator(indicatorTemplate, {
      id: indicator.id,
      paneId
    })

    this.synchronizeSeriesPrecision(indicatorInstance)
    indicatorInstance.override(indicator)
    const replaced = isStack ? [] : paneInstances
    if (!isStack) {
      paneInstances = []
    }
    paneInstances.push(indicatorInstance)
    this._instances.set(paneId, paneInstances)
    this._sort(paneId)
    const creation = this._calcIndicator(indicatorInstance, true)
    if (replaced.length > 0) {
      replaced.forEach(instance => this._finishCalculation(instance, false))
      this._chartStore.getTaskScheduler().remove(replaced.map(instance => this._taskKey(instance)))
    }
    return creation
  }

  getInstances(paneId: string): Indicator[] {
    return this._instances.get(paneId) ?? []
  }

  removeInstance(paneId: string, name?: string): boolean {
    let removed: Indicator[] = []
    const paneInstances = this._instances.get(paneId)
    if (isValid(paneInstances)) {
      if (isString(name)) {
        const index = paneInstances.findIndex((ins) => ins.name === name)
        if (index > -1) {
          removed = paneInstances.splice(index, 1)
        }
      } else {
        this._instances.set(paneId, [])
        removed = paneInstances
      }
      if (this._instances.get(paneId)?.length === 0) {
        this._instances.delete(paneId)
      }
    }
    removed.forEach(instance => this._finishCalculation(instance, false))
    this._chartStore.getTaskScheduler().remove(removed.map(instance => this._taskKey(instance)))
    return removed.length > 0
  }

  removeInstances(filter: IndicatorFilter): Indicator[] {
    const removed: Indicator[] = []
    const paneIds = isString(filter.paneId) ? [filter.paneId] : Array.from(this._instances.keys())
    paneIds.forEach(paneId => {
      const instances = this._instances.get(paneId)
      if (!instances) return
      for (let index = instances.length - 1; index >= 0; index--) {
        const indicator = instances[index]
        const matchesId = !isString(filter.id) || indicator.id === filter.id
        const matchesName = !isString(filter.name) || indicator.name === filter.name
        if (matchesId && matchesName) {
          removed.unshift(...instances.splice(index, 1))
        }
      }
      if (instances.length === 0) this._instances.delete(paneId)
    })
    removed.forEach(instance => this._finishCalculation(instance, false))
    this._chartStore.getTaskScheduler().remove(removed.map(instance => this._taskKey(instance)))
    return removed
  }

  hasInstances(paneId: string): boolean {
    return this._instances.has(paneId)
  }

  private _finishCalculation(indicator: Indicator, committed: boolean): void {
    const completion = this._pendingCalculations.get(indicator)
    this._pendingCalculations.delete(indicator)
    completion?.finish(committed)
  }

  cancelPendingCalculations(): void {
    this._pendingCalculations.forEach(completion => completion.finish(false))
    this._pendingCalculations.clear()
  }

  private _calcIndicator(indicator: Indicator, followUpdates = false): Promise<boolean> {
    // API completion belongs to the instance; a tick replaces only the calculation task.
    let completion = this._pendingCalculations.get(indicator)
    if (followUpdates && !completion) {
      let finish!: (committed: boolean) => void
      const result = new Promise<boolean>(resolve => { finish = resolve })
      completion = { result, finish }
      this._pendingCalculations.set(indicator, completion)
    }
    const scheduler = this._chartStore.getTaskScheduler()
    const key = this._taskKey(indicator)
    const dataVersion = this._chartStore.getDataVersion()
    const epoch = this._chartStore.getDatasetEpoch()
    const data = this._chartStore.getDataList()
    const isCurrent = (): boolean => (
      scheduler.isCurrent(key, task) &&
      !this._chartStore.isDestroyed() &&
      dataVersion === this._chartStore.getDataVersion() &&
      epoch === this._chartStore.getDatasetEpoch() &&
      (this._instances.get(indicator.paneId)?.includes(indicator) ?? false)
    )
    let finish!: (committed: boolean) => void
    const task = new Promise<boolean>(resolve => { finish = resolve })
    const complete = (committed: boolean): void => {
      const ownsTask = scheduler.isCurrent(key, task)
      const ready = committed && isCurrent()
      finish(committed)
      if (ownsTask) this._finishCalculation(indicator, ready)
    }
    scheduler.add({ [key]: task })
    this._chartStore.deferCalculation(() => {
      if (!isCurrent()) { complete(false); return }
      void indicator.calcIndicator(data, isCurrent).then(complete)
    })
    return completion?.result ?? task
  }

  clearResults(): void {
    this._instances.forEach(indicators => indicators.forEach(indicator => { indicator.result = [] }))
  }

  private _taskKey(indicator: Indicator): string {
    return JSON.stringify([indicator.paneId, indicator.id])
  }

  calcInstance(indicators: Indicator[]): void {
    this._chartStore.batchEffects(() => indicators.forEach(indicator => { void this._calcIndicator(indicator) }))
  }

  /**
   * @deprecated Use `getIndicatorsByFilter` instead.
   */
  getInstanceByPaneId(paneId?: string, name?: string): Indicator | Map<string, Indicator> | Map<string, Map<string, Indicator>> | null {
    const createMapping: ((instances: Indicator[]) => Map<string, Indicator>) = (instances: Indicator[]) => {
      const mapping = new Map<string, Indicator>()
      instances.forEach((ins) => {
        mapping.set(ins.name, ins)
      })
      return mapping
    }

    if (isString(paneId)) {
      const paneInstances = this._instances.get(paneId) ?? []
      if (isString(name)) {
        return paneInstances?.find((ins) => ins.name === name) ?? null
      }
      return createMapping(paneInstances)
    }
    const mapping = new Map<string, Map<string, Indicator>>()
    this._instances.forEach((instances, paneId) => {
      mapping.set(paneId, createMapping(instances))
    })
    return mapping
  }

  getIndicatorsByPaneId(paneId: string): Indicator[] {
    return this._instances.get(paneId) ?? []
  }

  getIndicatorsByFilter(filter: IndicatorFilter): Indicator[] {
    const { paneId, name, id } = filter
    const match: ((overlay: Indicator) => boolean) = indicator => {
      if (isValid(id)) {
        return indicator.id === id
      }
      return !isValid(name) || indicator.name === name
    }
    let indicators: Indicator[] = []
    if (isValid(paneId)) {
      indicators = indicators.concat(this.getIndicatorsByPaneId(paneId).filter(match))
    } else {
      this._instances.forEach(paneIndicator => {
        indicators = indicators.concat(paneIndicator.filter(match))
      })
    }
    return indicators
  }

  synchronizeSeriesPrecision(indicator?: Indicator): void {
    const { price: pricePrecision, volume: volumePrecision } = this._chartStore.getPrecision()
    const synchronize = (indicator: Indicator): void => {
      switch (indicator.series) {
        case IndicatorSeries.Price: {
          indicator.setSeriesPrecision(pricePrecision)
          break
        }
        case IndicatorSeries.Volume: {
          indicator.setSeriesPrecision(volumePrecision)
          break
        }
        default: { break }
      }
    }

    if (isValid(indicator)) {
      synchronize(indicator)
    } else {
      this._instances.forEach((paneInstances) => {
        paneInstances.forEach((instance) => {
          synchronize(instance)
        })
      })
    }
  }

  override(indicator: IndicatorOverride, paneId?: string): Promise<[boolean, boolean, () => boolean]> {
    return this._chartStore.batchEffects(() => this._override(indicator, paneId))
  }

  private async _override(indicator: IndicatorOverride, paneId?: string): Promise<[boolean, boolean, () => boolean]> {
    const name = 'name' in indicator ? indicator.name : undefined
    const id = 'id' in indicator ? indicator.id : undefined

    // Use getIndicatorsByFilter to find matching indicators
    const matchingIndicators = this.getIndicatorsByFilter({ paneId, name, id })

    if (matchingIndicators.length === 0) {
      const identifier = isString(id) ? `id '${id}'` : isString(name) ? `name '${name}'` : 'unknown'
      throw new Error(`No indicator found with ${identifier}.`)
    }

    let onlyUpdateFlag = false
    const tasks: Array<Promise<boolean>> = []
    let sortFlag = false
    const operation = {}
    const epoch = this._chartStore.getDatasetEpoch()
    const isCurrent = (): boolean => !this._chartStore.isDestroyed() && epoch === this._chartStore.getDatasetEpoch() &&
      matchingIndicators.every(instance => this._overrides.get(instance) === operation && (this._instances.get(instance.paneId)?.includes(instance) ?? false))

    matchingIndicators.forEach((instance) => {
      this._overrides.set(instance, operation)
      instance.override(indicator)
      const { draw, calc, sort } = instance.shouldUpdate()
      sortFlag = sortFlag || sort
      if (calc) {
        tasks.push(this._calcIndicator(instance, true))
      } else if (draw) {
        onlyUpdateFlag = true
      }
    })

    if (sortFlag) {
      this._sort()
    }
    const result = await Promise.all(tasks)
    return [onlyUpdateFlag, result.includes(true), isCurrent]
  }
}
