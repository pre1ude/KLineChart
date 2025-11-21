

import { type AxisTemplate } from '../../component/Axis'

const defaultXAxis: AxisTemplate = {
  name: 'default',
  createTicks: ({ defaultTicks }) => defaultTicks
}

export default defaultXAxis
