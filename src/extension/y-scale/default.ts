
import { type AxisTemplate } from '../../component/Axis'

const defaultYScale: AxisTemplate = {
  name: 'default',
  createTicks: ({ defaultTicks }) => defaultTicks
}

export default defaultYScale
