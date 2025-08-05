/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type Nullable from './Nullable'
import type KLineData from './KLineData'

export interface Margin {
  marginLeft: number
  marginTop: number
  marginRight: number
  marginBottom: number
}

export interface Padding {
  paddingLeft: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
}

export interface Offset {
  offsetLeft: number
  offsetTop: number
  offsetRight: number
  offsetBottom: number
}

/**
 * line type
 */
export enum LineType {
  Dashed = 'dashed',
  Solid = 'solid'
}

export interface LineStyle {
  style: LineType
  /** 线粗细 */
  size: number
  color: string
  dashedValue: number[]
}

export interface SmoothLineStyle extends LineStyle {
  smooth: boolean | number
}

export interface StateLineStyle extends LineStyle {
  show: boolean
}

export enum PolygonType {
  Stroke = 'stroke',
  Fill = 'fill',
  StrokeFill = 'stroke_fill'
}

export interface PolygonStyle {
  style: PolygonType
  color: string | CanvasGradient
  borderColor: string
  borderSize: number
  borderStyle: LineType
  borderDashedValue: number[]
}

export interface RectStyle extends PolygonStyle {
  borderRadius: number
}

export interface TextStyle extends Padding {
  style: PolygonType
  color: string
  size: number
  family: string
  weight: number | string
  borderStyle: LineType
  borderDashedValue: number[]
  borderSize: number
  borderColor: string
  borderRadius: number
  backgroundColor: string | CanvasGradient
}

/**
 * @deprecated
 * Starting from v10, it will be deleted
 */
export type RectTextStyle = TextStyle

export interface StateTextStyle extends TextStyle {
  show: boolean
}

/**
 * @deprecated
 * Starting from v10, it will be deleted
 */
export type StateRectTextStyle = StateTextStyle

export type LastValueMarkTextStyle = Omit<StateTextStyle, 'backgroundColor'>

export enum TooltipShowRule {
  Always = 'always',
  FollowCross = 'follow_cross',
  None = 'none'
}

export enum TooltipShowType {
  Standard = 'standard',
  Rect = 'rect'
}

export interface ChangeColor {
  upColor: string
  downColor: string
  noChangeColor: string
}

export interface GradientColor {
  offset: number
  color: string
}

export interface GridStyle {
  show: boolean
  horizontal: StateLineStyle
  vertical: StateLineStyle
}

export type TooltipTextStyle = Pick<TextStyle, 'color' | 'size' | 'family' | 'weight'> & Margin

export interface TooltipLegendChild {
  text: string
  color: string
}

/**
 * @deprecated
 * Starting from v10, it will be deleted
 */
export type TooltipDataChild = TooltipLegendChild

export interface TooltipLegend {
  title: string | TooltipLegendChild
  value: string | TooltipLegendChild
}

/**
 * @deprecated
 * Starting from v10, it will be deleted
 */
export type TooltipData = TooltipLegend

export enum TooltipIconPosition {
  Left = 'left',
  Middle = 'middle',
  Right = 'right'
}
export interface TooltipIconStyle extends Padding, Margin {
  id: string
  position: TooltipIconPosition
  color: string
  activeColor: string
  size: number
  fontFamily: string
  icon: string
  backgroundColor: string
  activeBackgroundColor: string
}

export interface TooltipStyle {
  showRule: TooltipShowRule
  showType: TooltipShowType
  defaultValue: string
  text: TooltipTextStyle
  icons: TooltipIconStyle[]
}

export interface CandleAreaPointStyle {
  show: boolean
  color: string
  radius: number
  rippleColor: string
  rippleRadius: number
  animation: boolean
  animationDuration: number
}

export interface CandleAreaStyle {
  lineSize: number
  lineColor: string
  value: string
  lineOnly: boolean
  smooth: boolean
  backgroundColor: string | GradientColor[]
  point: CandleAreaPointStyle
}

export interface CandleHighLowPriceMarkStyle {
  show: boolean
  color: string
  textOffset: number
  textSize: number
  textFamily: string
  textWeight: string
}

export type CandleLastPriceMarkLineStyle = Omit<StateLineStyle, 'color'>
export interface CandleLastPriceMarkStyle extends ChangeColor {
  show: boolean
  line: CandleLastPriceMarkLineStyle
  text: LastValueMarkTextStyle
}

export interface CandlePriceMarkStyle {
  show: boolean
  high: CandleHighLowPriceMarkStyle
  low: CandleHighLowPriceMarkStyle
  last: CandleLastPriceMarkStyle
}

export enum CandleTooltipRectPosition {
  Fixed = 'fixed',
  Pointer = 'pointer'
}

export interface CandleTooltipRectStyle extends Omit<RectStyle, 'style' | 'borderDashedValue' | 'borderStyle'>, Padding, Offset {
  position: CandleTooltipRectPosition
}

export interface CandleTooltipCustomCallbackData {
  prev: Nullable<KLineData>
  current: KLineData
  next: Nullable<KLineData>
}

export type CandleTooltipCustomCallback = (data: CandleTooltipCustomCallbackData, styles: CandleStyle) => TooltipLegend[]

export interface CandleTooltipStyle extends TooltipStyle, Offset {
  custom: CandleTooltipCustomCallback | TooltipLegend[]
  rect: CandleTooltipRectStyle
}

export enum CandleType {
  /** 实心K线 */
  CandleSolid = 'candle_solid',
  /** 空心K线 */
  CandleStroke = 'candle_stroke',
  /** 涨空心线 */
  CandleUpStroke = 'candle_up_stroke',
  /** 跌空心线 */
  CandleDownStroke = 'candle_down_stroke',
  /** OHLC线 */
  Ohlc = 'ohlc',
  /** 面积图线 */
  Area = 'area'
}

export interface CandleBarColor extends ChangeColor {
  upBorderColor: string
  downBorderColor: string
  noChangeBorderColor: string
  upWickColor: string
  downWickColor: string
  noChangeWickColor: string
}

export interface CandleStyle {
  type: CandleType
  bar: CandleBarColor
  area: CandleAreaStyle
  priceMark: CandlePriceMarkStyle
  tooltip: CandleTooltipStyle
}

export type IndicatorPolygonStyle = Omit<PolygonStyle, 'color' | 'borderColor'> & ChangeColor

export interface IndicatorLastValueMarkStyle {
  show: boolean
  text: LastValueMarkTextStyle
}

export interface IndicatorTooltipStyle extends TooltipStyle, Offset {
  showName: boolean
  showParams: boolean
}

export interface IndicatorStyle {
  ohlc: ChangeColor
  bars: IndicatorPolygonStyle[]
  lines: SmoothLineStyle[]
  circles: IndicatorPolygonStyle[]
  lastValueMark: IndicatorLastValueMarkStyle
  tooltip: IndicatorTooltipStyle
  [key: string]: any
}

export type AxisLineStyle = Omit<StateLineStyle, 'style' | 'dashedValue'>

export interface AxisTickLineStyle extends AxisLineStyle {
  length: number
}

export interface AxisTickTextStyle extends Pick<StateTextStyle, 'show' | 'color' | 'weight' | 'family' | 'size'> {
  marginStart: number
  marginEnd: number
}

export interface AxisStyle {
  show: boolean
  size: number | 'auto'
  axisLine: AxisLineStyle
  tickLine: AxisTickLineStyle
  tickText: AxisTickTextStyle
}

export type XAxisStyle = AxisStyle

export enum YAxisPosition {
  Left = 'left',
  Right = 'right',
  Both = 'both'
}

export enum YAxisType {
  Normal = 'normal',
  Percentage = 'percentage',
  MinutePercentage = 'minute-percentage',
  Log = 'log'
}

export interface YAxisStyle extends AxisStyle {
  // type: YAxisType
  position: YAxisPosition
  inside: boolean
  reverse: boolean
}

export interface CrosshairDirectionStyle {
  show: boolean
  line: StateLineStyle
  text: StateTextStyle
}

export interface CrosshairStyle {
  show: boolean
  horizontal: CrosshairDirectionStyle
  vertical: CrosshairDirectionStyle
}

export interface OverlayPointStyle {
  color: string
  borderColor: string
  borderSize: number
  radius: number
  activeColor: string
  activeBorderColor: string
  activeBorderSize: number
  activeRadius: number
}

export interface OverlayStyle {
  point: OverlayPointStyle
  line: SmoothLineStyle
  rect: RectStyle
  polygon: PolygonStyle
  circle: PolygonStyle
  arc: LineStyle
  text: TextStyle
  /**
   * @deprecated
   * Starting from v10, it will be deleted
   */
  rectText: TextStyle
  [key: string]: any
}

export interface SeparatorStyle {
  size: number
  color: string
  fill: boolean
  activeBackgroundColor: string
}

export interface Styles {
  grid: GridStyle
  candle: CandleStyle
  indicator: IndicatorStyle
  xAxis: XAxisStyle
  yAxis: YAxisStyle
  separator: SeparatorStyle
  crosshair: CrosshairStyle
  overlay: OverlayStyle
}

const white = '#FFFFFF'
const textColor = '#76808F'
const axisLineColor = '#DDDDDD'

const upColor = '#FE5500'
const downColor = '#34C734'
const noChangeColor = '#9CA3AD'
const indicatorUpColor = 'rgba(255, 102, 0, 0.6)'
const indicatorDownColor = 'rgba(52, 199, 52, 0.6)'

function getAlphaBlue (alpha: number): string {
  return `rgba(22, 119, 255, ${alpha})`
}

function getDefaultGridStyle (): GridStyle {
  function item (): StateLineStyle {
    return {
      show: true,
      size: 1,
      color: '#EDEDED',
      style: LineType.Dashed,
      dashedValue: [2, 2]
    }
  }
  return {
    show: true,
    horizontal: item(),
    vertical: item()
  }
}

/**
 * Get default candle style
 * @type {{area: {backgroundColor: [{offset: number, color: string}, {offset: number, color: string}], lineColor: string, lineSize: number, value: string}, bar: {noChangeColor: string, upColor: string, downColor: string}, tooltip: {rect: {offsetTop: number, fillColor: string, borderColor: string, paddingBottom: number, borderRadius: number, paddingRight: number, borderSize: number, offsetLeft: number, paddingTop: number, paddingLeft: number, offsetRight: number}, showRule: string, values: null, showType: string, text: {marginRight: number, size: number, color: string, weight: string, marginBottom: number, family: string, marginTop: number, marginLeft: number}, labels: string[]}, type: string, priceMark: {high: {textMargin: number, textSize: number, color: string, textFamily: string, show: boolean, textWeight: string}, last: {noChangeColor: string, upColor: string, line: {dashValue: number[], size: number, show: boolean, style: string}, show: boolean, text: {paddingBottom: number, size: number, color: string, paddingRight: number, show: boolean, weight: string, paddingTop: number, family: string, paddingLeft: number}, downColor: string}, low: {textMargin: number, textSize: number, color: string, textFamily: string, show: boolean, textWeight: string}, show: boolean}}}
 */
function getDefaultCandleStyle (): CandleStyle {
  const highLow = {
    show: true,
    color: '#B8CAE6',
    textOffset: 5,
    textSize: 10,
    textFamily: 'Helvetica Neue',
    textWeight: 'normal'
  }
  return {
    type: CandleType.CandleSolid,
    bar: {
      upColor,
      downColor,
      noChangeColor,
      upBorderColor: upColor,
      downBorderColor: downColor,
      noChangeBorderColor: noChangeColor,
      upWickColor: upColor,
      downWickColor: downColor,
      noChangeWickColor: noChangeColor
    },
    area: {
      lineSize: 1,
      lineColor: '#4D97FF',
      smooth: false,
      value: 'close',
      lineOnly: false,
      backgroundColor: [{
        offset: 0,
        color: getAlphaBlue(0.01)
      }, {
        offset: 1,
        color: getAlphaBlue(0.2)
      }],
      point: {
        show: false,
        color: '#4D97FF',
        radius: 4,
        rippleColor: 'rgba(77, 151, 255, 0.3)',
        rippleRadius: 8,
        animation: false,
        animationDuration: 1000
      }
    },
    priceMark: {
      show: true,
      high: { ...highLow },
      low: { ...highLow },
      last: {
        show: true,
        upColor,
        downColor,
        noChangeColor,
        line: {
          show: true,
          style: LineType.Dashed,
          dashedValue: [4, 4],
          size: 1
        },
        text: {
          show: true,
          style: PolygonType.Fill,
          size: 12,
          paddingLeft: 4,
          paddingTop: 4,
          paddingRight: 4,
          paddingBottom: 4,
          borderColor: 'transparent',
          borderStyle: LineType.Solid,
          borderSize: 0,
          borderDashedValue: [2, 2],
          color: white,
          family: 'Helvetica Neue',
          weight: 'normal',
          borderRadius: 2
        }
      }
    },
    tooltip: {
      offsetLeft: 4,
      offsetTop: 6,
      offsetRight: 4,
      offsetBottom: 6,
      showRule: TooltipShowRule.FollowCross,
      showType: TooltipShowType.Rect,
      custom: [
        { title: 'time', value: '{time}' },
        { title: 'open', value: '{open}' },
        { title: 'high', value: '{high}' },
        { title: 'low', value: '{low}' },
        { title: 'close', value: '{close}' },
        { title: 'volume', value: '{volume}' }
      ],
      defaultValue: 'n/a',
      rect: {
        position: CandleTooltipRectPosition.Fixed,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        offsetLeft: 4,
        offsetTop: 4,
        offsetRight: 4,
        offsetBottom: 4,
        borderRadius: 4,
        borderSize: 1,
        borderColor: '#40516B',
        color: 'rgba(15,30,51, 0.7)'
      },
      text: {
        size: 12,
        family: 'Helvetica Neue',
        weight: 'normal',
        color: '#B8CAE6',
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4
      },
      icons: []
    }
  }
}

/**
 * Get default indicator style
 */
function getDefaultIndicatorStyle (): IndicatorStyle {
  const lines = ['#FDD75D', '#FF9379', '#0BE6CE', '#CF8FFF', '#23B6FF'].map(
    (color) => ({
      style: LineType.Solid,
      smooth: false,
      size: 1,
      dashedValue: [2, 2],
      color
    })
  )

  return {
    ohlc: {
      upColor,
      downColor,
      noChangeColor
    },
    bars: [{
      style: PolygonType.Fill,
      borderStyle: LineType.Solid,
      borderSize: 1,
      borderDashedValue: [2, 2],
      upColor: indicatorUpColor,
      downColor: indicatorDownColor,
      noChangeColor
    }],
    lines,
    circles: [{
      style: PolygonType.Fill,
      borderStyle: LineType.Solid,
      borderSize: 1,
      borderDashedValue: [2, 2],
      upColor,
      downColor,
      noChangeColor
    }],
    // 用于指标最新价标签
    lastValueMark: {
      show: false,
      text: {
        show: false,
        style: PolygonType.Fill,
        color: white,
        size: 12,
        family: 'Helvetica Neue',
        weight: 'normal',
        borderStyle: LineType.Solid,
        borderColor: 'transparent',
        borderSize: 0,
        borderDashedValue: [2, 2],
        paddingLeft: 4,
        paddingTop: 4,
        paddingRight: 4,
        paddingBottom: 4,
        borderRadius: 2
      }
    },
    tooltip: {
      offsetLeft: 4,
      offsetTop: 6,
      offsetRight: 4,
      offsetBottom: 6,
      showRule: TooltipShowRule.Always,
      showType: TooltipShowType.Standard,
      showName: true,
      showParams: true,
      defaultValue: 'n/a',
      text: {
        size: 12,
        family: 'Helvetica Neue',
        weight: 'normal',
        color: '#B8CAE6',
        marginLeft: 8,
        marginTop: 4,
        marginRight: 8,
        marginBottom: 4
      },
      icons: []
    }
  }
}

function getDefaultXAxisStyle (): XAxisStyle {
  return {
    show: true,
    size: 'auto',
    axisLine: {
      show: true,
      color: axisLineColor,
      size: 1
    },
    tickText: {
      show: true,
      color: textColor,
      size: 12,
      family: 'Helvetica Neue',
      weight: 'normal',
      marginStart: 4,
      marginEnd: 4
    },
    tickLine: {
      show: true,
      size: 1,
      length: 3,
      color: axisLineColor
    }
  }
}

function getDefaultYAxisStyle (): YAxisStyle {
  const style = getDefaultXAxisStyle() as YAxisStyle
  style.position = YAxisPosition.Left
  style.inside = false
  style.reverse = false
  return style
}

function getDefaultCrosshairStyle (): CrosshairStyle {
  function item (): CrosshairDirectionStyle {
    return {
      show: true,
      line: {
        show: true,
        style: LineType.Dashed,
        dashedValue: [4, 2],
        size: 1,
        color: textColor
      },
      text: {
        show: true,
        style: PolygonType.Fill,
        color: white,
        size: 12,
        family: 'Helvetica Neue',
        weight: 'normal',
        borderStyle: LineType.Solid,
        borderDashedValue: [2, 2],
        borderSize: 1,
        borderColor: textColor,
        borderRadius: 2,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 4,
        paddingBottom: 4,
        backgroundColor: textColor
      }
    }
  }

  return {
    show: true,
    horizontal: item(),
    vertical: item()
  }
}

function getDefaultOverlayStyle (): OverlayStyle {
  function text (): TextStyle {
    return {
      style: PolygonType.Fill,
      color: '#000000',
      size: 12,
      family: 'Helvetica Neue',
      weight: 'normal',
      borderStyle: LineType.Solid,
      borderDashedValue: [2, 2],
      borderSize: 1,
      borderRadius: 2,
      borderColor: '#FFC62B',
      paddingLeft: 4,
      paddingRight: 4,
      paddingTop: 4,
      paddingBottom: 4,
      backgroundColor: '#FFC62B'
    }
  }
  return {
    point: {
      color: '#FFC62B',
      borderColor: '#FFC62B',
      borderSize: 1,
      radius: 5,
      activeColor: '#FFC62B',
      activeBorderColor: '#FFC62B',
      activeBorderSize: 3,
      activeRadius: 5
    },
    line: {
      style: LineType.Solid,
      smooth: false,
      color: '#FFC62B',
      size: 1,
      dashedValue: [2, 2]
    },
    rect: {
      style: PolygonType.Fill,
      color: 'rgba(255,198,43,0.15)',
      borderColor: '#FFC62B',
      borderSize: 1,
      borderRadius: 0,
      borderStyle: LineType.Solid,
      borderDashedValue: [2, 2]
    },
    polygon: {
      style: PolygonType.Fill,
      color: 'rgba(255,198,43,0.15)',
      borderColor: '#FFC62B',
      borderSize: 1,
      borderStyle: LineType.Solid,
      borderDashedValue: [2, 2]
    },
    circle: {
      style: PolygonType.Fill,
      color: 'rgba(255,198,43,0.15)',
      borderColor: '#FFC62B',
      borderSize: 1,
      borderStyle: LineType.Solid,
      borderDashedValue: [2, 2]
    },
    arc: {
      style: LineType.Solid,
      color: '#FFC62B',
      size: 1,
      dashedValue: [2, 2]
    },
    text: text(),
    rectText: text()
  }
}

function getDefaultSeparatorStyle (): SeparatorStyle {
  return {
    size: 1,
    color: axisLineColor,
    fill: true,
    activeBackgroundColor: getAlphaBlue(0.08)
  }
}

export function getDefaultStyles (): Styles {
  return {
    grid: getDefaultGridStyle(),
    candle: getDefaultCandleStyle(),
    indicator: getDefaultIndicatorStyle(),
    xAxis: getDefaultXAxisStyle(),
    yAxis: getDefaultYAxisStyle(),
    separator: getDefaultSeparatorStyle(),
    crosshair: getDefaultCrosshairStyle(),
    overlay: getDefaultOverlayStyle()
  }
}
