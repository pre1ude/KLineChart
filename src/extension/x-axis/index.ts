

import { type AxisTemplate } from '../../component/Axis'
import XAxisImp, { type XAxisConstructor } from '../../component/XAxis'

import defaultXAxis from './default'

const xAxises: Record<string, XAxisConstructor> = {
  default: XAxisImp.extend(defaultXAxis)
}

function registerXAxis (axis: AxisTemplate): void {
  xAxises[axis.name] = XAxisImp.extend(axis)
}

function getXAxisClass (name: string): XAxisConstructor {
  return xAxises[name] ?? xAxises.default
}

export {
  registerXAxis,
  getXAxisClass
}
