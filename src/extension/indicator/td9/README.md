# TD9 使用指南

`TD9` 是一个独立的 Setup 9 价格指标。它拥有自己的配置、输入输出类型和计算引擎，不依赖 `TDSEQ` 或 TD Sequential 模块。

## 使用

```ts
import { init, PaneIdConstants } from '@dm/kchart'

const chart = init('chart')

chart.createIndicator({
  name: 'TD9'
}, false, { id: PaneIdConstants.CANDLE })
```

TD9 默认行为：

- 使用连续 9/4 Setup；
- 默认在同方向条件完成 9 后保持静默，配置 `afterCompleted: 'RESTART'` 时下一根从 1 重新计数；
- 当前收盘价等于 4 根前收盘价时中断当前 Setup，且该柱不计数；
- 达到 Setup 6 后回填显示 1～6；
- 在完成 9 前中断时撤掉整组数字；
- Buy Setup 显示在蜡烛下方，默认使用 `#D94A4A`；
- Sell Setup 显示在蜡烛上方，默认使用 `#16A085`；
- Setup 1～8 使用 60% 不透明度，Setup 9 保持完全不透明；
- Perfected Setup 将数字 9 以 24px 字号显示，未在 Setup 8 或 9 完善时立即终结为未完善。

TD9 不包含 Countdown、Deferral `+`、Recycle `R`、TDST 或相关 Tooltip 字段。

## 自定义

```ts
chart.createIndicator({
  name: 'TD9',
  extendData: {
    config: {
      setupStartPolicy: 'REQUIRE_PRICE_FLIP',
      afterCompleted: 'WAIT_BREAK',
      enablePerfection: true,
      calculationMode: 'CLOSED_BAR_ONLY'
    },
    render: {
      buySetupColor: '#D94A4A',
      sellSetupColor: '#16A085',
      fontSize: 10,
      fontWeight: 600,
      provisionalOpacity: 0.8
    }
  }
}, false, { id: PaneIdConstants.CANDLE })
```

TD9 的 Setup 长度固定为 9，比较周期固定为 4。价格使用严格大小关系比较，相等时固定中断计数。`WAIT_BREAK` 会在 Setup 9 后等待方向中断，`RESTART` 会让下一根同方向柱直接从 1 开始，并且不要求新的 Price Flip。Perfection 仅在 Setup 9 完成时判断一次，不支持 Late Perfection，也不需要调用方提供 `tickSize`。

`setupStartPolicy` 用于控制 Setup 的启动方式：

- 希望使用类似持续扫描的“神奇九转”，请选择 `CONTINUOUS_SCAN`；
- 希望严格从趋势转折点开始计数，请选择 `REQUIRE_PRICE_FLIP`；
- 默认值为 `CONTINUOUS_SCAN`。

## 独立计算

```ts
import { calculateTD9 } from '@dm/kchart'

const result = calculateTD9(data)

console.log(result.bars)
```

`calculateTD9` 信任调用方传入的 `KLineData` 已按时间排序且 OHLC 数据有效，引擎不重复校验通用行情数据。`isClosed: false` 仅允许出现在最后一根 K 线，并且需要使用 `REALTIME_PROVISIONAL` 模式。
