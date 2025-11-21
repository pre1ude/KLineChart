

import { type AxisTemplate } from '../../component/Axis'

const defaultYAxis: AxisTemplate = {
  name: 'default',
  createTicks: ({ defaultTicks }) => defaultTicks
}

export default defaultYAxis
