
import type Nullable from '../common/Nullable'
import type ChartStore from './ChartStore'
import { type IndicatorCreate, Indicator, IndicatorSeries } from '../component/Indicator'
import { isValid, isString } from '../common/utils/typeChecks'
import { getIndicatorClass } from '../extension/indicator/index'

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
    const { name } = indicator
    let paneInstances = this._instances.get(paneId)
    if (isValid(paneInstances)) {
      const instance = paneInstances.find((ins) => ins.name === name)
      if (isValid(instance)) {
        return Promise.reject(new Error('Duplicate indicators.'))
      }
    }
    if (!isValid(paneInstances)) {
      paneInstances = []
    }
    const indicatorTemplate = getIndicatorClass(name)!
    const indicatorInstance = new Indicator(indicatorTemplate)

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

  async calcInstance(name?: string, paneId?: string): Promise<boolean> {
    const tasks: Array<Promise<boolean>> = []
    if (isString(name)) {
      if (isString(paneId)) {
        const paneInstances = this._instances.get(paneId)
        if (isValid(paneInstances)) {
          const instance = paneInstances.find((ins) => ins.name === name)
          if (isValid(instance)) {
            tasks.push(instance.calcIndicator(this._chartStore.getDataList()))
          }
        }
      } else {
        this._instances.forEach((paneInstances) => {
          const instance = paneInstances.find((ins) => ins.name === name)
          if (isValid(instance)) {
            tasks.push(instance.calcIndicator(this._chartStore.getDataList()))
          }
        })
      }
    } else {
      this._instances.forEach((paneInstances) => {
        paneInstances.forEach((instance) => {
          tasks.push(instance.calcIndicator(this._chartStore.getDataList()))
        })
      })
    }
    const result = await Promise.all(tasks)
    return result.includes(true)
  }

  getInstanceByPaneId(paneId?: string, name?: string): Nullable<Indicator> | Nullable<Map<string, Indicator>> | Map<string, Map<string, Indicator>> {
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

  async override(indicator: IndicatorCreate, paneId: Nullable<string>): Promise<[boolean, boolean]> {
    const { name } = indicator
    let instances = new Map<string, Indicator[]>()
    if (paneId !== null) {
      const paneInstances = this._instances.get(paneId)
      if (isValid(paneInstances)) {
        instances.set(paneId, paneInstances)
      }
    } else {
      instances = this._instances
    }
    let onlyUpdateFlag = false
    const tasks: Array<Promise<boolean>> = []
    let sortFlag = false
    instances.forEach((paneInstances) => {
      const instance = paneInstances.find((ins) => ins.name === name)
      if (isValid(instance)) {
        instance.override(indicator)
        const { draw, calc, sort } = instance.shouldUpdate()
        sortFlag = sort
        if (calc) {
          tasks.push(instance.calcIndicator(this._chartStore.getDataList()))
        } else if (draw) {
          onlyUpdateFlag = true
        }
      }
    })
    if (sortFlag) {
      this._sort()
    }
    const result = await Promise.all(tasks)
    return [onlyUpdateFlag, result.includes(true)]
  }
}
