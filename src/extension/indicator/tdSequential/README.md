# TD Sequential 0.2 使用指南

本目录实现了基于公开规则的 TD Sequential 0.2，包含：

- Buy/Sell Setup 9/4；
- Perfected Setup 和可选 Late Perfection；
- True High / True Low 与 TDST Resistance / Support；
- Buy/Sell Countdown 13/2；
- 8 vs. 5、Final vs. 8 Deferral；
- Opposite Setup、TDST Cancellation；
- Setup 22、Setup Range Recycle；
- Closed-bar、realtime provisional、事件、增量 delta 和状态快照。

内置指标名称是 `TDSEQ`。完整规则定义参见 [TD Sequential 0.2 实现规范](../../../../docs/td-sequential-spec-v0.2.md)，可运行页面参见 [AAPL / NVDA Daily Demo](../../../../tests/html/indicator/td-sequential.html)。

Demo 可切换 AAPL 和 NVDA；两份 Nasdaq 日线快照均覆盖 2021-07-20 至 2026-07-20，共 1,255 根且交易日期逐根对齐。

> 本实现复现公开且可机械定义的规则，不宣称与任何未公开或闭源实现逐柱完全一致。

## 1. 在图表中使用

### 1.1 使用默认规则

`TDSEQ` 是价格序列指标，通常应叠加到主 K 线窗格：

```ts
import { init, PaneIdConstants } from '@dm/kchart'

const chart = init('chart')

chart.createIndicator(
  'TDSEQ',
  false,
  { id: PaneIdConstants.CANDLE }
)

chart.applyNewData(dataList)
```

默认使用 `PUBLIC_BASELINE_V0_2`：Setup 9/4、Countdown 13/2、仅处理已收盘柱。

### 1.2 指定 Profile 和渲染样式

建议设置稳定的指标实例 ID，便于后续通过 `overrideIndicator` 更新：

```ts
import {
  PaneIdConstants,
  PUBLIC_BASELINE_V0_2,
  init
} from '@dm/kchart'

const chart = init('chart')

chart.createIndicator({
  id: 'tdseq-main',
  name: 'TDSEQ',
  extendData: {
    config: PUBLIC_BASELINE_V0_2,
    render: {
      buySetupColor: '#D94A4A',
      sellSetupColor: '#16A085',
      buyCountdownColor: '#D94A4A',
      sellCountdownColor: '#16A085',
      resistanceColor: '#F05A67',
      supportColor: '#1EA672',
      fontSize: 10,
      fontWeight: 600,
      layerGap: 12,
      provisionalOpacity: 0.55,
      showCancelled: false
    }
  }
}, false, { id: PaneIdConstants.CANDLE })

chart.applyNewData(dataList)
```

### 1.3 运行时切换 Profile

```ts
import {
  PaneIdConstants,
  TRADINGVIEW_STYLE_PUBLIC_V0_2
} from '@dm/kchart'

chart.overrideIndicator({
  id: 'tdseq-main',
  extendData: {
    config: TRADINGVIEW_STYLE_PUBLIC_V0_2,
    render: {
      showCancelled: true
    }
  }
}, PaneIdConstants.CANDLE)
```

计算配置改变后会重新计算整个指标。`render` 只控制展示，不改变计算结果。

## 2. 输入数据

批量函数和增量引擎接受标准 OHLC 数据：

```ts
interface TDSequentialInputBar {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
  isClosed?: boolean
}
```

输入必须满足：

- `timestamp` 是安全整数，严格递增且不重复；
- OHLC 都是有限数；
- `high >= max(open, close)`；
- `low <= min(open, close)`；
- `isClosed` 省略时视为 `true`；
- 最多只有最后一根柱可以是未收盘柱；
- 历史复权数据发生变化时应执行全量重算。

## 3. Profile 与自定义配置

### 3.1 内置 Profile

| Profile | 主要用途 | Final 普通比较源 |
| --- | --- | --- |
| `PUBLIC_BASELINE_V0_2` | 公开规则基线，默认值 | `CLOSE` |
| `TRADINGVIEW_STYLE_PUBLIC_V0_2` | 公开设置语义兼容模式 | `OPEN_OR_CLOSE` |
| `CUSTOM` | 修改任意规则参数后使用 | 由配置决定 |

两个内置 Profile 都是只读常量。调用 `resolveTDSequentialConfig` 修改内置 Profile 的任意字段后，返回配置的 `profile` 会自动变为 `CUSTOM`：

```ts
import {
  PUBLIC_BASELINE_V0_2,
  resolveTDSequentialConfig
} from '@dm/kchart'

const config = resolveTDSequentialConfig({
  ...PUBLIC_BASELINE_V0_2,
  setupStartPolicy: 'REQUIRE_PRICE_FLIP',
  enable8Vs5Deferral: true,
  enableRangeRecycle: true
})

console.log(config.profile) // CUSTOM
```

不要直接修改导出的 Profile 常量。需要自定义时使用对象展开或 `resolveTDSequentialConfig` 创建新对象。

### 3.2 主要计算参数

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `setupLength` | `9` | Setup 完成长度 |
| `setupLookback` | `4` | Setup 收盘价回看长度 |
| `setupEqualityPolicy` | `BREAK` | 相等价格中断，或仅延续活动 run |
| `setupStartPolicy` | `CONTINUOUS_SCAN` | 连续扫描，或要求 Price Flip |
| `enablePerfection` | `true` | 是否计算 Perfected Setup |
| `latePerfectionPolicy` | `DISABLED` | 是否允许完成后的 Late Perfection |
| `countdownLength` | `13` | Countdown 完成长度 |
| `countdownLookback` | `2` | Countdown 回看长度 |
| `countdownAllowEqual` | `true` | 普通 Countdown 比较是否包含相等 |
| `countdownStartPolicy` | `ON_SETUP_COMPLETION_BAR` | Setup 完成柱是否可成为 Countdown 1 |
| `finalCountComparisonSource` | `CLOSE` | 最终 count 使用 Close 或 Open/Close |
| `enable8Vs5Deferral` | `false` | 是否启用 8 vs. 5 Deferral |
| `enableFinalVs8Deferral` | `true` | 是否启用 Final vs. 8 Deferral |
| `enableOppositeSetupCancellation` | `true` | 相反 Setup 是否取消未完成 Countdown |
| `enableTDSTCancellation` | `true` | 是否启用 origin TDST Cancellation |
| `enableRecycle` | `true` | 是否启用 Recycle |
| `recycleSetupCount` | `22` | 连续 Setup run 的 Recycle 触发长度 |
| `enableRangeRecycle` | `false` | 是否启用 Setup Range Recycle |
| `recycleRangeMinRatio` | `1.0` | Range Recycle 比例下界 |
| `recycleRangeMaxRatio` | `2.0` | Range Recycle 比例上界 |
| `calculationMode` | `CLOSED_BAR_ONLY` | 已收盘模式或实时 provisional 模式 |
| `tickSize` | `undefined` | 可选的最小价格变动单位，用于比较容差 |

配置会在引擎构造或批量计算开始时一次性校验。非法组合会抛出明确错误，不会静默降级。

## 4. 批量计算

如果只需要计算结果而不需要内置图表渲染，可以直接调用：

```ts
import {
  PUBLIC_BASELINE_V0_2,
  calculateTDSequential
} from '@dm/kchart'

const result = calculateTDSequential(dataList, PUBLIC_BASELINE_V0_2)

console.log(result.configHash)
console.log(result.setups)
console.log(result.countdowns)
console.log(result.tdstLevels)
console.log(result.events)
```

常用结果字段：

| 字段 | 内容 |
| --- | --- |
| `bars` | 每根已提交柱的 Setup、Countdown、TDST 和事件输出 |
| `provisional` | 最后一根未收盘柱的临时输出，不进入永久历史 |
| `setups` | 完整 Setup 实体及 Perfection、扩展 run 状态 |
| `countdowns` | 完整 Countdown count、Deferral、Cancellation、Recycle 状态 |
| `tdstLevels` | TDST 创建、替换、破位历史 |
| `completionLifecycles` | Countdown 完成后的 12-bar 生命周期 |
| `events` | 按 `sequence` 排序的永久审计事件 |
| `configHash` | 当前规则配置的稳定哈希 |

例如，只消费完成信号：

```ts
const completedEvents = result.events.filter(
  event => event.type === 'COUNTDOWN_COMPLETED'
)

for (const event of completedEvents) {
  console.log(event.timestamp, event.direction, event.entityId)
}
```

事件和实体 ID 是确定性的。业务侧应使用 ID 去重，不要只使用数组位置或显示数字。

## 5. 增量与实时计算

### 5.1 已收盘柱增量计算

```ts
import { TDSequentialEngine } from '@dm/kchart'

const engine = new TDSequentialEngine()

// 初始化历史数据，同时建立逐柱快照。
engine.calculate(historyBars)

// 新柱 timestamp 必须大于当前最后一根。
const delta = engine.appendBar(nextClosedBar)

console.log(delta.addedEventIds)
console.log(delta.removedEventIds)
console.log(delta.addedOrUpdatedEntityIds)
console.log(engine.result)
```

`appendBar`、`replaceLastBar`、`removeLastBar` 返回 `TDSequentialDelta`，便于事件存储或 UI 层增量同步。

### 5.2 Realtime provisional

实时模式只允许最后一根柱为未收盘状态：

```ts
import {
  TDSequentialEngine,
  resolveTDSequentialConfig
} from '@dm/kchart'

const realtimeConfig = resolveTDSequentialConfig({
  profile: 'CUSTOM',
  calculationMode: 'REALTIME_PROVISIONAL'
})

const engine = new TDSequentialEngine(realtimeConfig)
engine.calculate(closedHistory)

engine.appendBar({
  timestamp: currentTimestamp,
  open,
  high,
  low,
  close,
  isClosed: false
})

// 更新同一根未收盘柱时必须保持 timestamp 不变。
engine.replaceLastBar({
  timestamp: currentTimestamp,
  open,
  high: updatedHigh,
  low: updatedLow,
  close: updatedClose,
  isClosed: false
})

console.log(engine.result.provisional)

// 收盘时仍使用 replaceLastBar 提交同一 timestamp。
engine.replaceLastBar({
  timestamp: currentTimestamp,
  open,
  high: finalHigh,
  low: finalLow,
  close: finalClose,
  isClosed: true
})
```

provisional 事件带 `provisional=true`，不会进入 `result.events` 或永久快照。不要在柱收盘前将它持久化为正式信号。

### 5.3 回滚与重放

```ts
// 替换最后一根已提交柱。
const replaceDelta = engine.replaceLastBar(correctedLastBar)

// 删除最后一根柱。
const removeDelta = engine.removeLastBar()

// 恢复到指定输入 index 处理完成后的状态。
engine.restoreSnapshot(100)

// 从该位置重新追加剩余数据。
for (const bar of correctedBarsAfter100) {
  engine.appendBar(bar)
}
```

`restoreSnapshot(-1)` 恢复为空状态。`engine.snapshots` 返回快照副本，修改返回值不会污染引擎内部状态。

## 6. 图表标记含义

### 6.1 Setup 数字的确认显示

内置 `TDSEQ` 指标会延迟确认 Setup 数字，以减少短暂价格波动产生的零散 `1`、`2`、`3`：

- Setup 连续计数未达到 6 时不显示；
- 达到 6 时，一次性回填显示该 run 的 `1`～`6`；
- 随后达到 7、8 时继续显示；
- 如果在完成 9 前中断，会撤掉该 run 已显示的全部数字；
- 完成 9 后，`1`～`9` 永久保留。

该策略只影响内置指标的图形和 Tooltip，不修改 `calculateTDSequential` 返回的原始 Setup mark、Setup 实体和事件，因而不会丢失审计信息。

### 6.2 标记列表

| 标记 | 含义 |
| --- | --- |
| `1`～`9` | Setup count |
| `•` | 当前 Setup 已 Perfected |
| `13` | Countdown 完成 |
| `+` | 8 vs. 5 或 Final vs. 8 Deferred candidate |
| `R` | Countdown 被 Recycle |
| TDST Resistance | Buy Setup 产生的阻力水平线 |
| TDST Support | Sell Setup 产生的支撑水平线 |

内置指标只显示完成位置的 Countdown `13`，普通计数 `1`～`12` 不绘制；`+` 和 `R` 作为状态提示继续保留。该精简策略只作用于图形和 Tooltip，`calculateTDSequential` 返回的完整 Countdown records 和事件不受影响。

同一柱有多个 Countdown 标记时，会按照稳定 Countdown ID 分层错开。`showCancelled=false` 只在渲染层隐藏已取消 Countdown 的旧标记，底层记录和事件仍然保留。

## 7. 渲染选项

`extendData.render` 支持：

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `buySetupColor` | `#D94A4A` | Buy Setup 数字颜色 |
| `sellSetupColor` | `#16A085` | Sell Setup 数字颜色 |
| `setupColor` | 未设置 | 兼容旧配置；统一覆盖两个方向的 Setup 颜色 |
| `buyCountdownColor` | `#D94A4A` | Buy Countdown 颜色，与 Buy Setup 一致 |
| `sellCountdownColor` | `#16A085` | Sell Countdown 颜色，与 Sell Setup 一致 |
| `resistanceColor` | `#F05A67` | TDST Resistance 颜色 |
| `supportColor` | `#1EA672` | TDST Support 颜色 |
| `perfectedColor` | 未设置 | 可选；统一覆盖两个方向的 Perfected Setup 颜色 |
| `fontSize` | `10` | 标记字号 |
| `fontWeight` | `600` | 标记字重 |
| `layerGap` | `12` | 同柱多层标记间距 |
| `provisionalOpacity` | `0.55` | 未收盘临时标记透明度 |
| `showCancelled` | `false` | 是否显示已取消 Countdown 的历史数字 |

默认情况下 Perfected Setup 继续使用对应方向颜色，只通过 `•` 标识；显式配置 `perfectedColor` 后才会统一改色。方向专用的 `buySetupColor` / `sellSetupColor` 优先于兼容参数 `setupColor`。

TDST 线的可见性和颜色也可以通过通用 figure styles 覆盖：

```ts
chart.overrideIndicator({
  id: 'tdseq-main',
  styles: {
    figures: {
      tdstResistance: {
        visible: true,
        color: '#FF7A45'
      },
      tdstSupport: {
        visible: true,
        color: '#36CFC9'
      }
    }
  }
}, PaneIdConstants.CANDLE)
```

## 8. 当前能力边界

结果中的 `capabilities` 会明确声明当前能力。0.2 内置 Profile 不实现或不推断：

- 精确 Setup / Countdown Risk Level；
- Risk Zone；
- 精确 Intersection；
- Qualified Breakout；
- Aggressive Sequential；
- Combo Countdown；
- 闭源实现特有的显示或状态行为。

TDST 使用规范中定义的 `SIMPLE_CLOSE` 显示破位规则，`breakoutQualification` 固定为 `NOT_IMPLEMENTED`。不要把它解释为官方 Qualified Breakout。

## 9. 相关文件

- [`config.ts`](./config.ts)：内置 Profile、配置解析、校验和配置哈希；
- [`engine.ts`](./engine.ts)：批量计算、增量引擎、快照和 delta；
- [`types.ts`](./types.ts)：公开实体、事件和配置类型；
- [`index.ts`](./index.ts)：`TDSEQ` 内置指标模板与绘制；
- [`engine.test.ts`](./engine.test.ts)：规则、增量和边界测试。
