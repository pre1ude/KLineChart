import type ChartStore from './ChartStore'
import { type IndicatorCreate, type IndicatorOverride, Indicator, type IndicatorFilter, IndicatorSeries } from '../component/Indicator'
import { isValid, isString } from '../common/utils/typeChecks'
import { getIndicatorTemplate } from '../extension/indicator/index'

export default class IndicatorStore {
  private readonly _chartStore: ChartStore
  private readonly _instances = new Map<string, Indicator[]>()

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
    if (!isStack) {
      paneInstances = []
    }
    paneInstances.push(indicatorInstance)
    this._instances.set(paneId, paneInstances)
    this._sort(paneId)
    return indicatorInstance.calcIndicator(this._chartStore.getDataList())
  }

  getInstances(paneId: string): Indicator[] {
    return this._instances.get(paneId) ?? []
  }

  removeInstance(paneId: string, name?: string): boolean {
    let removed = false
    const paneInstances = this._instances.get(paneId)
    if (isValid(paneInstances)) {
      if (isString(name)) {
        const index = paneInstances.findIndex((ins) => ins.name === name)
        if (index > -1) {
          paneInstances.splice(index, 1)
          removed = true
        }
      } else {
        this._instances.set(paneId, [])
        removed = true
      }
      if (this._instances.get(paneId)?.length === 0) {
        this._instances.delete(paneId)
      }
    }
    return removed
  }

  hasInstances(paneId: string): boolean {
    return this._instances.has(paneId)
  }

  calcInstance(indicators: Indicator[]): void {
    if (indicators.length > 0) {
      const tasks: Record<string, Promise<unknown>> = {}
      indicators.forEach(indicator => {
        tasks[indicator.id] = indicator.calcIndicator(this._chartStore.getDataList())
      })
      this._chartStore.getTaskScheduler().add(tasks)
    }
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

  async override(indicator: IndicatorOverride, paneId?: string): Promise<[boolean, boolean]> {
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

    matchingIndicators.forEach((instance) => {
      instance.override(indicator)
      const { draw, calc, sort } = instance.shouldUpdate()
      sortFlag = sortFlag || sort
      if (calc) {
        tasks.push(instance.calcIndicator(this._chartStore.getDataList()))
      } else if (draw) {
        onlyUpdateFlag = true
      }
    })

    if (sortFlag) {
      this._sort()
    }
    const result = await Promise.all(tasks)
    return [onlyUpdateFlag, result.includes(true)]
  }
}
