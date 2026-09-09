
import { type AxisTemplate } from '../../component/Axis'
import YScaleImp, { type YScaleConstructor } from '../../component/YScale'

import defaultYScale from './default'

const yScales: Record<string, YScaleConstructor> = {
  default: YScaleImp.extend(defaultYScale)
}

function registerYScale(scale: AxisTemplate): void {
  yScales[scale.name] = YScaleImp.extend(scale)
}

function getYScaleClass(name: string): YScaleConstructor {
  return yScales[name] ?? yScales.default
}

export {
  registerYScale,
  getYScaleClass
}
