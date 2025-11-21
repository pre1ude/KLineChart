
import { type AxisTemplate } from '../../component/Axis'
import YAxisImp, { type YAxisConstructor } from '../../component/YAxis'

import defaultYAxis from './default'

const yAxises: Record<string, YAxisConstructor> = {
  default: YAxisImp.extend(defaultYAxis)
}

function registerYAxis(axis: AxisTemplate): void {
  yAxises[axis.name] = YAxisImp.extend(axis)
}

function getYAxisClass(name: string): YAxisConstructor {
  return yAxises[name] ?? yAxises.default
}

export {
  registerYAxis,
  getYAxisClass
}
