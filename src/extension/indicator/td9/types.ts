import type KLineData from '../../../common/KLineData'

export type TD9Direction = 'BUY' | 'SELL'

export interface TD9Config {
  setupStartPolicy: 'CONTINUOUS_SCAN' | 'REQUIRE_PRICE_FLIP'
  /** Controls whether a completed Setup waits for interruption or immediately restarts. */
  afterCompleted: 'WAIT_BREAK' | 'RESTART'
  enablePerfection: boolean
  calculationMode: 'CLOSED_BAR_ONLY' | 'REALTIME_PROVISIONAL'
}

export type TD9InputBar = KLineData & { isClosed?: boolean }

export interface TD9SetupMark {
  setupId: string
  direction: TD9Direction
  value: number
  perfected?: boolean
}

export interface TD9BarOutput {
  barIndex: number
  timestamp: number
  provisional: boolean
  setupMark?: TD9SetupMark
}

export interface TD9Result {
  config: Readonly<TD9Config>
  bars: TD9BarOutput[]
  provisional?: TD9BarOutput
}

export interface TD9RenderOptions {
  buySetupColor?: string
  sellSetupColor?: string
  /** @deprecated Use buySetupColor and sellSetupColor for directional setup colors. */
  setupColor?: string
  /** Optional override for both Buy and Sell Perfected Setup marks. */
  perfectedColor?: string
  fontSize?: number
  fontWeight?: number | string
  provisionalOpacity?: number
}

export interface TD9IndicatorExtendData {
  config?: Partial<TD9Config>
  render?: TD9RenderOptions
}
