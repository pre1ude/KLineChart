import Chart, { DomPosition } from './Chart'
import { type Options, FormatDateType, LayoutChildType } from './Options'

// Enums and Constants
import { ActionType } from './common/Action'
import { LoadDataType } from './common/LoadDataCallback'
import {
  LineType,
  PolygonType,
  TooltipShowRule,
  TooltipShowType,
  TooltipIconPosition,
  CandleType,
  YAxisPosition,
  YAxisType,
  CandleTooltipRectPosition
} from './common/Styles'
import { IndicatorSeries } from './component/Indicator'
import { OverlayState } from './component/Overlay'
import { PanePosition, PaneIdConstants } from './pane/types'

// Utils
import { logTag, logWarn } from './common/utils/logger'
import {
  clone,
  merge,
  isString,
  isNumber,
  isValid,
  isObject,
  isArray,
  isFunction,
  isBoolean
} from './common/utils/typeChecks'
import {
  formatPrecision,
  formatBigNumber,
  formatDate,
  formatThousands,
  formatFoldDecimal
} from './common/utils/format'
import { calcTextWidth } from './common/utils/canvas'
import { setCursor } from './common/utils/cursor'

// Figure Utils
import { checkCoordinateOnArc, drawArc } from './extension/figure/arc'
import { checkCoordinateOnCircle, drawCircle } from './extension/figure/circle'
import {
  isPointOnLine,
  drawLine,
  getLinearYFromSlopeIntercept,
  getLinearSlopeIntercept,
  getLinearYFromCoordinates
} from './extension/figure/line'
import { checkCoordinateOnPolygon, drawPolygon } from './extension/figure/polygon'
import { checkCoordinateOnRect, drawRect } from './extension/figure/rect'
import { checkCoordinateOnText, drawText } from './extension/figure/text'

// Extension APIs
import { registerFigure, getSupportedFigures, getFigureTemplate } from './extension/figure/index'
import { registerIndicator, getSupportedIndicators } from './extension/indicator/index'
import { registerLocale, getSupportedLocales } from './extension/i18n/index'
import { registerOverlay, getOverlayTemplate, getSupportedOverlays } from './extension/overlay/index'
import { registerStyles } from './extension/styles/index'
import { registerXAxis } from './extension/x-axis'
import { registerYAxis } from './extension/y-axis'

const instances = new Map<string, Chart>()
let chartBaseId = 1

/**
 * Chart version
 * @return {string}
 */
function version(): string {
  return '__VERSION__'
}

/**
 * Init chart instance
 * @param ds
 * @param options
 * @returns {Chart}
 */
function init(ds: HTMLElement | string, options?: Options): Chart {
  logTag()
  let dom: HTMLElement | null
  if (isString(ds)) {
    dom = document.getElementById(ds)
  } else {
    dom = ds
  }
  if (!dom) {
    throw new Error('The chart cannot be initialized correctly. Please check the parameters. The chart container cannot be null and child elements need to be added!!!')
  }
  let chart = instances.get(dom.id)
  if (isValid(chart)) {
    logWarn('', '', 'The chart has been initialized on the dom！！！')
    return chart
  }
  const id = `k_line_chart_${chartBaseId++}`
  chart = new Chart(dom, options)
  chart.id = id
  dom.setAttribute('k-line-chart-id', id)
  instances.set(id, chart)
  return chart
}

/**
 * Destroy chart instance
 * @param dcs
 */
function dispose(dcs: HTMLElement | Chart | string): void {
  let id: string | null
  if (dcs instanceof Chart) {
    id = dcs.id
  } else {
    let dom: HTMLElement | null
    if (isString(dcs)) {
      dom = document.getElementById(dcs)
    } else {
      dom = dcs
    }
    id = dom?.getAttribute('k-line-chart-id') ?? null
  }
  if (id !== null) {
    instances.get(id)?.destroy()
    instances.delete(id)
  }
}

const utils = {
  clone,
  merge,
  isString,
  isNumber,
  isValid,
  isObject,
  isArray,
  isFunction,
  isBoolean,
  formatPrecision,
  formatBigNumber,
  formatDate,
  formatThousands,
  formatFoldDecimal,
  calcTextWidth,
  getLinearSlopeIntercept,
  getLinearYFromSlopeIntercept,
  getLinearYFromCoordinates,
  checkCoordinateOnArc,
  checkCoordinateOnCircle,
  checkCoordinateOnLine: isPointOnLine,
  checkCoordinateOnPolygon,
  checkCoordinateOnRect,
  checkCoordinateOnText,
  drawArc,
  drawCircle,
  drawLine,
  drawPolygon,
  drawRect,
  drawText,
  setCursor
}

// ==================== Core API ====================

export { version, init, dispose }

// ==================== Extension APIs ====================

export {
  // Figure
  registerFigure,
  getSupportedFigures,
  getFigureTemplate,
  // Indicator
  registerIndicator,
  getSupportedIndicators,
  // Overlay
  registerOverlay,
  getSupportedOverlays,
  getOverlayTemplate,
  // Locale
  registerLocale,
  getSupportedLocales,
  // Styles
  registerStyles,
  // Axis
  registerXAxis,
  registerYAxis
}

// ==================== Utility Functions ====================

export { utils }

// ==================== Enums ====================

export {
  // Action
  ActionType,
  // Data Loading
  LoadDataType,
  // Styles
  LineType,
  PolygonType,
  TooltipShowRule,
  TooltipShowType,
  TooltipIconPosition,
  CandleTooltipRectPosition,
  CandleType,
  YAxisPosition,
  YAxisType,
  // Format
  FormatDateType,
  // Chart
  DomPosition,
  // Indicator
  IndicatorSeries,
  // Layout
  LayoutChildType,
  // Pane
  PanePosition,
  PaneIdConstants,
  // Overlay
  OverlayState
}

// ==================== Type Exports ====================

// Core Types
export type { Chart, ResizeAnchor, PaneScope } from './Chart'
export type { default as ChartImp } from './Chart'
export type { DataZoomOptions, Options } from './Options'

// Data Types
export type { default as KLineData } from './common/KLineData'
export type { default as Precision } from './common/Precision'
export type { IPoint, Point } from './common/Point'
export type { default as Crosshair } from './common/Crosshair'

// Style Types
export type {
  Styles,
  TooltipIconStyle,
  GradientColor,
  CandleTooltipCustomCallback,
  CandleTooltipCustomCallbackData,
  IndicatorStyle,
  OverlayStyle,
  FigureStyleConfig,
} from './common/Styles'

// Layout Types
export type { LayoutChild } from './Options'

// Indicator Types
export type { Indicator, IndicatorCreate, IndicatorTemplate, IndicatorTooltipData } from './component/Indicator'

// Overlay Types
export type { Overlay, OverlayCreate, OverlayTemplate, OverlayMode, EventOverlayInfo, OverlayEventCallback, OverlayMouseTouchEvent } from './component/Overlay'

// Event Types
export type { MouseTouchEvent } from './common/SyntheticEvent'

// Action Types
export type {
  ActionCallback,
  ActionCallbackParams,
  ClickEventData,
  ZoomEventData,
  ScrollEventData,
  VisibleRangeChangeEventData,
  TooltipIconClickEventData,
  CrosshairChangeEventData,
  PaneDragEventData
} from './common/Action'
