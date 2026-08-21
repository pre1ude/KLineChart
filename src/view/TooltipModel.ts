import type Bounding from '../common/Bounding'
import type Crosshair from '../common/Crosshair'
import type { TooltipDirectionStyle } from '../common/TooltipDirection'
import type {
  Styles,
  TooltipIconStyle,
  TooltipLegend,
  TooltipStyle,
  TooltipTextStyle
} from '../common/Styles'

export type StandardTooltipContent = {
  type: 'icons'
  icons: TooltipIconStyle[]
} | {
  type: 'legends'
  legends: TooltipLegend[]
  styles: TooltipTextStyle
}

export interface StandardTooltipBlock {
  type: 'standard'
  paneId: string
  indicatorId: string
  indicatorName: string
  left: number
  top: number
  maxWidth: number
  styles: TooltipStyle
  contents: StandardTooltipContent[]
}

export interface RectTooltipBlock {
  type: 'rect'
  top: number
  bounding: Bounding
  yLeftAxisWidth: number
  yRightAxisWidth: number
  crosshair: Crosshair
  styles: Styles
  drawCandle: boolean
  drawIndicator: boolean
  candleLegends: TooltipLegend[]
  indicatorLegends: TooltipLegend[][]
}

export type TooltipBlock = StandardTooltipBlock | RectTooltipBlock

export interface TooltipRenderModel {
  visible: boolean
  paneId: string
  bounding: Bounding
  blocks: TooltipBlock[]
  directionStyle: TooltipDirectionStyle
}
