# TD Sequential 指标实现规范

**文档版本：** 0.2  
**规则基线：** DeMARK 当前公开的 Sequential / 9-13 定义  
**默认参数：** Setup 9/4、Countdown 13/2  
**执行模型：** 收盘确认、单向遍历、确定性状态机  
**目标：** 实现可测试、可配置、可增量计算、可审计的 TD Sequential，而不是仅显示 Setup 9 的“神奇九转”  
**兼容性声明：** 本规范只复现公开且可机械定义的规则，不宣称与任何未公开的专有实现逐柱完全一致

---

## 0. 0.2 版决策摘要

本版本对 0.1 作出以下规范性调整：

1. Setup 使用单一方向扫描器，不再同时维护互相独立的 Buy/Sell run。
2. 公开基线固定为 Setup 9/4、Countdown 13/2；自定义参数必须通过配置约束。
3. 相等价格不再由含糊的布尔值处理，而由明确的 `setupEqualityPolicy` 决定。
4. 普通 Countdown 比较源与最终计数比较源分离。
5. Countdown 的计数阶段与后续处置状态分离，使“完成后被 Recycle”可被准确表达。
6. 明确定义单柱事务顺序，所有同柱冲突均按统一顺序解决。
7. 明确定义 Setup 22 Recycle 和 Range Recycle 的目标 Countdown、替代 Countdown 及同柱计数行为。
8. 明确定义 TDST 的创建、替换、破位与 Countdown Cancellation 是不同概念。
9. 明确定义 12-bar 窗口的第 0～13 根边界。
10. 补齐 provisional、稳定 ID、增量 delta、回滚及快照重放契约。
11. `Intersection`、Risk Level、Breakout Qualifiers 等未完整公开功能在没有 provider 时不得启用。
12. 所有规范性比较统一通过带容差的比较器完成。

本文中的“必须”“不得”属于规范要求；“建议”属于默认工程选择。

---

## 1. 实现范围

### 1.1 0.2 必须实现

1. Buy/Sell Setup 1～N，默认 N=9；
2. Setup 连续性、中断和单 run 唯一完成事件；
3. Continuous Scan 与 Require Price Flip 两种启动策略；
4. Perfected Setup；
5. 可选、具有明确生命周期的 Late Perfection；
6. True High / True Low；
7. TDST Resistance / Support；
8. Buy/Sell Sequential Countdown 1～M，默认 M=13；
9. Countdown 非连续累计；
10. Setup 完成柱可成为 Countdown 1；
11. 8 vs. 5 Deferral；
12. Final vs. 8 Deferral，默认即 13 vs. 8；
13. 相反方向 Setup Cancellation；
14. TDST Cancellation；
15. Setup 22 Recycle；
16. 可选 Setup Range Recycle；
17. Countdown 完成后的 12-bar 生命周期；
18. 完整实体、事件和每柱输出；
19. 批量、append、replace-last、remove-last；
20. Closed-bar 与 realtime provisional 两种计算模式；
21. 批量、增量和状态快照重放的一致性。

### 1.2 暂不内置精确公式

以下功能只允许通过扩展 provider 接入：

- Countdown Risk Level 精确价格公式；
- Setup Risk Level 精确价格公式；
- Risk Zone；
- 完整 Breakout Qualifiers；
- 精确 Intersection；
- Aggressive Sequential；
- Combo Countdown；
- 任何未公开的 TradingView / Symbolik 专有显示或状态行为。

如果调用方启用了需要 provider 的功能但没有提供 provider，引擎必须在配置校验阶段报错，不得静默降级，也不得伪装成官方实现。

---

## 2. 术语与方向

```ts
export type Direction = "BUY" | "SELL";
```

- Buy Setup / Buy Countdown：出现在下跌价格环境，代表潜在买入方向；
- Sell Setup / Sell Countdown：出现在上涨价格环境，代表潜在卖出方向；
- `direction` 表示信号方向，不等同于当前趋势方向；
- Setup count 使用连续合格柱；
- Countdown count 使用非连续合格柱；
- “当前柱”均指当前正在处理的 OHLC bar；
- 所有 ordinal 均从 1 开始，所有数组 index 均从 0 开始；
- `completionIndex` 是实体完成所在的输入数组 index。

---

## 3. 规则 Profile 与配置

### 3.1 Profile

```ts
export type TDSequentialProfile =
  | "PUBLIC_BASELINE_V0_2"
  | "TRADINGVIEW_STYLE_PUBLIC_V0_2"
  | "CUSTOM";
```

Profile 必须随结果保存。`CUSTOM` 表示调用方修改了任一规则字段。

`TRADINGVIEW_STYLE_PUBLIC_V0_2` 只表示采用当前公开设置名称及可确定语义，不表示与闭源脚本逐柱完全一致。

### 3.2 配置接口

```ts
export interface TDSequentialConfig {
  profile: TDSequentialProfile;
  rulesetVersion: "0.2";

  setupLength: number;
  setupLookback: number;
  setupEqualityPolicy:
    | "BREAK"
    | "CONTINUE_ACTIVE";
  setupStartPolicy:
    | "CONTINUOUS_SCAN"
    | "REQUIRE_PRICE_FLIP";

  enablePerfection: boolean;
  latePerfectionPolicy:
    | "DISABLED"
    | "UNTIL_NEXT_SETUP_COMPLETES";

  countdownLength: number;
  countdownLookback: number;
  countdownAllowEqual: boolean;
  countdownStartPolicy:
    | "ON_SETUP_COMPLETION_BAR"
    | "AFTER_SETUP_COMPLETION_BAR";

  finalCountComparisonSource:
    | "CLOSE"
    | "OPEN_OR_CLOSE";

  enable8Vs5Deferral: boolean;
  enableFinalVs8Deferral: boolean;

  enableOppositeSetupCancellation: boolean;
  enableTDSTCancellation: boolean;

  enableRecycle: boolean;
  recycleSetupCount: number;
  enableRangeRecycle: boolean;
  recycleRangeMinRatio: number;
  recycleRangeMaxRatio: number;

  tdstBreakPolicy: "SIMPLE_CLOSE";

  calculationMode:
    | "CLOSED_BAR_ONLY"
    | "REALTIME_PROVISIONAL";

  tickSize?: number;
}
```

`HIGH_LOW` 不属于 0.2 的最终计数源。需要该行为时应通过 Aggressive Sequential 扩展实现。

### 3.3 PUBLIC_BASELINE_V0_2

```ts
export const PUBLIC_BASELINE_V0_2: TDSequentialConfig = {
  profile: "PUBLIC_BASELINE_V0_2",
  rulesetVersion: "0.2",

  setupLength: 9,
  setupLookback: 4,
  setupEqualityPolicy: "BREAK",
  setupStartPolicy: "CONTINUOUS_SCAN",

  enablePerfection: true,
  latePerfectionPolicy: "DISABLED",

  countdownLength: 13,
  countdownLookback: 2,
  countdownAllowEqual: true,
  countdownStartPolicy: "ON_SETUP_COMPLETION_BAR",
  finalCountComparisonSource: "CLOSE",

  enable8Vs5Deferral: false,
  enableFinalVs8Deferral: true,

  enableOppositeSetupCancellation: true,
  enableTDSTCancellation: true,

  enableRecycle: true,
  recycleSetupCount: 22,
  enableRangeRecycle: false,
  recycleRangeMinRatio: 1.0,
  recycleRangeMaxRatio: 2.0,

  tdstBreakPolicy: "SIMPLE_CLOSE",
  calculationMode: "CLOSED_BAR_ONLY"
};
```

### 3.4 TRADINGVIEW_STYLE_PUBLIC_V0_2

该 Profile 与 `PUBLIC_BASELINE_V0_2` 仅有以下差异：

```ts
{
  profile: "TRADINGVIEW_STYLE_PUBLIC_V0_2",
  finalCountComparisonSource: "OPEN_OR_CLOSE"
}
```

本规范对 `OPEN_OR_CLOSE` 作如下确定性工程定义：

```ts
Buy final ordinary qualification:
  min(open[current], close[current]) <= low[current - countdownLookback]

Sell final ordinary qualification:
  max(open[current], close[current]) >= high[current - countdownLookback]
```

即开盘价或收盘价任一满足即可。该定义用于消除实现歧义，不宣称披露或复制专有内部算法。

### 3.5 配置约束

构造引擎时必须一次性校验配置：

```text
setupLength >= 4
setupLookback >= 1
countdownLength >= 1
countdownLookback >= 1
recycleSetupCount > setupLength
recycleRangeMinRatio > 0
recycleRangeMaxRatio >= recycleRangeMinRatio
tickSize === undefined || finite(tickSize) && tickSize > 0
```

附加约束：

- 开启 8 vs. 5 时，`countdownLength >= 8`；
- 开启 Final vs. 8 时，`countdownLength >= 9`；
- `rulesetVersion` 不是 `0.2` 时必须拒绝；
- Profile 为两个内置 Profile 时，配置必须与其字面值完全一致；修改任一字段后必须标为 `CUSTOM`；
- 所有 count、lookback 必须是安全正整数；
- 所有 ratio 必须是有限数；
- 不支持的枚举值必须报错，不得回退到默认值。

---

## 4. 输入数据契约

```ts
export interface OHLCBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  isClosed?: boolean;
}
```

### 4.1 基本校验

输入必须满足：

- 按 `timestamp` 严格升序排列；
- `timestamp` 唯一且为安全整数；
- OHLC 均为有限数，不接受 `NaN`、`Infinity`；
- `high >= max(open, close)`；
- `low <= min(open, close)`；
- 缺失 K 线不自动补零；
- 时间缺口按“缺少 bar”处理，不按自然时间补 bar；
- 同一轮计算必须使用一致的复权方式；
- 历史复权发生变化时必须全量重算。

### 4.2 `isClosed` 语义

```ts
isClosed = bar.isClosed !== false;
```

规则如下：

- 批量输入中最多只有最后一根可以是未收盘柱；
- 未收盘柱出现在历史中间位置时必须报错；
- `CLOSED_BAR_ONLY` 不接受未收盘柱；
- `REALTIME_PROVISIONAL` 可以处理最后一根未收盘柱；
- provisional 计算必须基于最后一个已提交状态的临时副本；
- provisional 事件和实体不得进入永久事件日志或永久快照；
- 同一 timestamp 从 `isClosed=false` 变为 `true` 时，通过 `replaceLastBar` 回滚临时状态后重新计算并提交。

### 4.3 增量接口约束

- `appendBar` 的 timestamp 必须大于现有最后一根；
- `replaceLastBar` 的 timestamp 必须等于现有最后一根；
- `removeLastBar` 在空序列上必须返回明确错误；
- 不支持直接修改中间历史柱；调用方修改历史数据后必须全量重算。

---

## 5. 数值比较

所有价格比较必须通过统一比较器：

```ts
export interface PriceComparator {
  compare(a: number, b: number): -1 | 0 | 1;
}
```

默认 epsilon：

```ts
epsilon = tickSize !== undefined
  ? tickSize * 0.1
  : Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 8;
```

比较器定义：

```ts
if (a < b - epsilon) return -1;
if (a > b + epsilon) return 1;
return 0;
```

规则映射：

```text
a <  b  → compare(a, b) === -1
a <= b  → compare(a, b) <= 0
a >  b  → compare(a, b) === 1
a >= b  → compare(a, b) >= 0
a == b  → compare(a, b) === 0
```

输入校验中的 OHLC 结构约束也必须使用同一个比较器。

count、ordinal、index 等整数使用精确比较。Range ratio 等无量纲数不得使用 `tickSize`；它们使用独立的标量比较器：

```ts
scalarEpsilon =
  Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 8;
```

标量严格/包含比较的映射与价格比较器相同。

---

## 6. 派生价格

### 6.1 True High

```ts
trueHigh[i] = i === 0
  ? high[i]
  : Math.max(high[i], close[i - 1]);
```

### 6.2 True Low

```ts
trueLow[i] = i === 0
  ? low[i]
  : Math.min(low[i], close[i - 1]);
```

True High / True Low 只使用当前及过去数据，不得读取未来柱。

---

## 7. Setup 扫描器

### 7.1 单柱方向

```ts
function setupRelation(i: number): -1 | 0 | 1 | null {
  if (i < config.setupLookback) return null;
  return compare(close[i], close[i - config.setupLookback]);
}
```

映射：

- `-1`：Buy Setup 条件；
- `1`：Sell Setup 条件；
- `0`：相等；
- `null`：数据不足。

### 7.2 扫描器状态

```ts
export interface SetupScannerState {
  direction: Direction | null;
  runId?: string;
  startIndex?: number;
  runLength: number;
  barIndices: number[];
  completedSetupId?: string;
}
```

引擎只维护一个当前 Setup run。默认严格比较下，一根柱不可能同时属于 Buy 和 Sell Setup。

### 7.3 CONTINUOUS_SCAN

对于非相等关系：

- 扫描器为空时，当前柱以对应方向开始 count 1；
- 当前方向相同，`runLength += 1`；
- 当前方向相反，旧 run 在当前柱之前结束，当前柱立即成为新方向 count 1。

因此 Setup 计到 8 后方向条件失败但转为相反方向时，失败柱同时是相反方向 count 1。

### 7.4 相等价格

`setupEqualityPolicy` 只影响 `setupRelation(i) === 0`：

#### BREAK

- 终止当前 run；
- 当前柱不属于 Buy 或 Sell Setup；
- 扫描器恢复为空。

#### CONTINUE_ACTIVE

- 有活动 run 时，相等柱延续该 run；
- 没有活动 run 时，相等柱不启动新 run；
- 相等柱永远不能单独决定 Buy/Sell 方向。

此定义确保相等价格不会创建双向 Setup。

### 7.5 Setup 完成

当当前 run 首次达到：

```ts
runLength === setupLength
```

创建且仅创建一个 `SetupInstance`。同一连续 run 在 N+1、N+2 等柱不得重复创建 Setup。

```ts
export interface SetupInstance {
  id: string;
  direction: Direction;
  runId: string;

  startIndex: number;
  completionIndex: number;
  countBarIndices: number[];

  highestTrueHigh: number;
  lowestTrueLow: number;
  range: number;

  perfectionState:
    | "DISABLED"
    | "PENDING"
    | "PERFECTED"
    | "IMPERFECTED_FINAL";
  perfectionIndex?: number;
  perfectionDetectionIndex?: number;

  extendedRunLength: number;
  extendedRunEndIndex?: number;
  recycleTriggerIndex?: number;

  supersededIndex?: number;
}
```

`countBarIndices.length` 必须等于 `setupLength`。`range` 固定为 Setup 1～N 的：

```ts
highestTrueHigh - lowestTrueLow
```

`supersededIndex` 只用于记录 pending Late Perfection 的资格窗口被后续 Setup 完成关闭；它不表示删除 Setup。

### 7.6 扩展 run

Setup 完成后，只要同方向条件持续满足，继续更新：

```ts
extendedRunLength = runLength;
```

扩展 count 默认不渲染 N+1～Recycle Count，但必须保存在状态中。

当 run 终止时设置 `extendedRunEndIndex` 为最后一个属于该 run 的柱 index。

---

## 8. Price Flip

Price Flip 使用配置化 lookback：

```ts
bearishPriceFlip(i) =
  i >= setupLookback + 1 &&
  compare(close[i], close[i - setupLookback]) === -1 &&
  compare(close[i - 1], close[i - 1 - setupLookback]) >= 0;

bullishPriceFlip(i) =
  i >= setupLookback + 1 &&
  compare(close[i], close[i - setupLookback]) === 1 &&
  compare(close[i - 1], close[i - 1 - setupLookback]) <= 0;
```

在 `REQUIRE_PRICE_FLIP` 模式中：

- Bearish Price Flip 启动 Buy Setup 1；
- Bullish Price Flip 启动 Sell Setup 1；
- 没有 Price Flip 时，即使单柱 Setup 条件成立也不得启动新的 run；
- run 启动后，连续性规则与 Continuous Scan 相同。

Price Flip 所需最少数据量是 `setupLookback + 2` 根，而不是固定 6 根。

---

## 9. Perfected Setup

令：

```ts
N = setupLength;
candidateA = Setup count N - 1;
candidateB = Setup count N;
referenceA = Setup count N - 3;
referenceB = Setup count N - 2;
```

默认 N=9 时即候选 8/9 与参考 6/7。

### 9.1 Buy Perfection

候选柱之一的 low 必须严格低于两个参考 low：

```ts
(low[candidateA] < low[referenceA] &&
 low[candidateA] < low[referenceB]) ||
(low[candidateB] < low[referenceA] &&
 low[candidateB] < low[referenceB])
```

等价形式：

```ts
min(low[candidateA], low[candidateB]) <
min(low[referenceA], low[referenceB])
```

### 9.2 Sell Perfection

```ts
(high[candidateA] > high[referenceA] &&
 high[candidateA] > high[referenceB]) ||
(high[candidateB] > high[referenceA] &&
 high[candidateB] > high[referenceB])
```

### 9.3 Late Perfection

两个内置 Profile 均使用 `DISABLED`。

Setup 在完成柱按以下顺序设置初始状态：

```text
enablePerfection = false
  → DISABLED

enablePerfection = true 且完成时通过
  → PERFECTED

enablePerfection = true、未通过、Late Perfection disabled
  → IMPERFECTED_FINAL

enablePerfection = true、未通过、Late Perfection enabled
  → PENDING
```

`UNTIL_NEXT_SETUP_COMPLETES` 只允许用于 `CUSTOM`：

- 未完善 Setup 在完成后进入 `PENDING`；
- Buy：后续第一根 `low` 严格低于原 Setup 两个参考 low 时完善；
- Sell：后续第一根 `high` 严格高于原 Setup 两个参考 high 时完善；
- 每柱先检查已有 pending Setup 的 Late Perfection，再处理本柱的新 Setup 完成；
- 本柱若同时使旧 Setup 完善并完成新 Setup，旧 Setup 先产生 `SETUP_PERFECTED`，随后被 supersede；
- 任意方向的新 Setup 完成后，仍处于 pending 的旧 Setup 变为 `IMPERFECTED_FINAL`；
- finalized 后不得再次完善。

Late Perfection 只改变 Perfection 状态，不创建新 Setup，也不重启 Countdown。

### 9.4 Perfection 来源柱与确认柱

Setup 只有在 count N 收盘后才能被确认。因此当 count N-1 已满足 Perfection 条件时：

- `perfectionIndex` 保存实际满足条件的 N-1 柱；
- `perfectionDetectionIndex` 保存 Setup `completionIndex`；
- `SETUP_PERFECTED` 事件的 `barIndex` 必须是确认时的 `completionIndex`；
- 事件 payload 另外携带 `perfectionIndex`；
- 不得在 Setup 尚未完成的 N-1 柱提前写入永久 Perfected 事件；
- 若 N-1 和 N 都满足，`perfectionIndex` 取较早的 N-1；
- Late Perfection 的两个 index 均为实际后续完善柱。

---

## 10. TDST

### 10.1 创建

Buy Setup 创建 TDST Resistance：

```ts
price = max(trueHigh of Setup count bars 1...N)
```

Sell Setup 创建 TDST Support：

```ts
price = min(trueLow of Setup count bars 1...N)
```

```ts
export interface TDSTLevel {
  id: string;
  setupId: string;
  direction: Direction;
  type: "RESISTANCE" | "SUPPORT";
  price: number;

  startIndex: number;
  endIndex?: number;
  state: "ACTIVE" | "BROKEN" | "REPLACED";

  breakPolicy: "SIMPLE_CLOSE";
  breakoutQualification: "NOT_IMPLEMENTED";
}
```

`startIndex` 等于 Setup `completionIndex`。

### 10.2 同类型替换

新 Buy Setup 完成时：

- 当前仍为 `ACTIVE` 的旧 Resistance 变为 `REPLACED`；
- `endIndex` 设为当前 index；
- 新 Resistance 成为当前显示层级。

Sell Support 对称处理。

被替换只影响 TDST 的显示生命周期。尚未结束的 Countdown 仍使用其 `originSetupId` 对应的冻结 TDST 值执行 Cancellation。

### 10.3 SIMPLE_CLOSE 破位

在 Setup 完成后的后续已收盘柱：

```ts
Resistance BROKEN if close[current] > resistance.price
Support BROKEN    if close[current] < support.price
```

这里的“破位”表示任意收盘价越过，不要求前一柱位于另一侧。

本规则不是官方 Qualified Breakout。必须输出：

```ts
breakoutQualification: "NOT_IMPLEMENTED"
```

不得把 TDST 显示破位与 Countdown 的 TDST Cancellation 混为同一条件。

---

## 11. Countdown 实体

```ts
export interface CountdownInstance {
  id: string;
  direction: Direction;
  originSetupId: string;
  predecessorCountdownIds: string[];

  creationIndex: number;
  startEligibilityIndex: number;

  count: number;
  records: CountdownCountRecord[];
  deferredCandidates: CountdownDeferredRecord[];

  phase: "WAITING" | "COUNTING" | "COMPLETED";
  disposition: "ACTIVE" | "CANCELLED" | "RECYCLED";

  completionIndex?: number;
  cancellationIndex?: number;
  cancellationReason?:
    | "OPPOSITE_SETUP"
    | "TDST_VIOLATION";

  recycleIndex?: number;
  recycleReason?:
    | "SETUP_EXTENDED_COUNT"
    | "SETUP_RANGE_RATIO";
  recycleTriggerSetupId?: string;
}

export interface CountdownCountRecord {
  ordinal: number;
  barIndex: number;
  timestamp: number;
  comparisonSource: "CLOSE" | "OPEN_OR_CLOSE";
  comparisonValue: number;
  close: number;
  high: number;
  low: number;
}

export interface CountdownDeferredRecord {
  attemptedOrdinal: 8 | "FINAL";
  barIndex: number;
  timestamp: number;
  reason: "EIGHT_VS_FIVE" | "FINAL_VS_EIGHT";
}
```

重要不变量：

- `records.length === count`；
- record ordinal 必须严格从 1 递增；
- 同一 Countdown 一根柱最多记录一个正式 count；
- Deferred 只是一项失败尝试，不是 Countdown 的长期 phase；
- `COMPLETED + ACTIVE` 表示已完成且尚未 Recycle；
- `COMPLETED + RECYCLED` 表示历史上完成过，随后被 Recycle；
- `CANCELLED` 只允许发生在未完成 Countdown；
- `RECYCLED` 可以发生在未完成或已完成 Countdown。

---

## 12. Countdown 创建和起算

每个完成的 Setup 创建一个普通 Countdown，除非同柱已因配置错误而无法建立所需 TDST；正常有效输入不应出现这种情况。

```ts
startEligibilityIndex =
  countdownStartPolicy === "ON_SETUP_COMPLETION_BAR"
    ? setup.completionIndex
    : setup.completionIndex + 1;
```

创建时：

```ts
count = 0;
phase = currentIndex >= startEligibilityIndex
  ? "COUNTING"
  : "WAITING";
disposition = "ACTIVE";
```

Setup 完成柱若达到 eligibility 且满足 Countdown 条件，可以成为 Countdown 1。

---

## 13. Countdown 普通计数

### 13.1 非最终 count

Buy：

```ts
close[current] <= low[current - countdownLookback]
```

Sell：

```ts
close[current] >= high[current - countdownLookback]
```

是否包含相等由 `countdownAllowEqual` 控制。

### 13.2 最终 count 的普通条件

`finalCountComparisonSource === "CLOSE"` 时与普通 count 相同。

`OPEN_OR_CLOSE` 时：

```ts
Buy:
  min(open[current], close[current]) <=
  low[current - countdownLookback]

Sell:
  max(open[current], close[current]) >=
  high[current - countdownLookback]
```

比较是否包含相等仍由 `countdownAllowEqual` 控制。

正式记录 `comparisonValue` 时：

- Buy + `OPEN_OR_CLOSE` 保存 `min(open, close)`；
- Sell + `OPEN_OR_CLOSE` 保存 `max(open, close)`；
- `CLOSE` 保存 close。

### 13.3 暂停

不满足普通条件时：

- `count` 不变；
- `phase` 保持 `COUNTING`；
- 不创建 Deferred record；
- 不删除历史 count；
- 不触发 Cancellation。

Countdown 不要求连续。

---

## 14. Countdown Deferral

### 14.1 8 vs. 5

只有准备记录正式 count 8 时检查。

Buy：

```ts
low[current] < close[count5Bar]
```

Sell：

```ts
high[current] > close[count5Bar]
```

该比较始终严格，不受 `countdownAllowEqual` 影响。

未通过时：

- `count` 保持 7；
- 添加 `EIGHT_VS_FIVE` deferred record；
- 当前柱输出 `+`；
- 后续只有再次满足普通条件时才重新检查。

### 14.2 Final vs. 8

只有 `count === countdownLength - 1` 且当前柱满足最终 count 普通条件时检查。

Buy：

```ts
low[current] <= close[count8Bar]
```

Sell：

```ts
high[current] >= close[count8Bar]
```

该比较固定允许相等，不受 `countdownAllowEqual` 影响。

公开说明的主体规则使用小于等于/大于等于；个别设置摘要使用了非数学化的“less than/greater than”措辞。0.2 明确选择包含相等，并以本节公式作为唯一规范，避免实现随文字解释变化。

未通过时：

- count 保持 `countdownLength - 1`；
- 添加 `FINAL_VS_EIGHT` deferred record；
- 当前柱输出 `+`；
- 后续每一根满足最终 count 普通条件的柱都重新检查。

通过时正式记录 final count，并进入 `COMPLETED + ACTIVE`。

---

## 15. Countdown Cancellation

Cancellation 的目标必须同时满足：

```ts
phase !== "COMPLETED" && disposition === "ACTIVE"
```

### 15.1 相反方向 Setup

新 Sell Setup 完成时，取消所有未完成且 ACTIVE 的 Buy Countdown；新 Buy Setup 完成时反向处理。

```ts
disposition = "CANCELLED";
cancellationReason = "OPPOSITE_SETUP";
cancellationIndex = currentIndex;
```

已完成 Countdown 不受普通 Cancellation 影响。

### 15.2 TDST Cancellation

对于 Buy Countdown，使用其 origin Buy Setup 的冻结 TDST Resistance：

```ts
trueLow[current] > originTDSTResistance
```

对于 Sell Countdown，使用其 origin Sell Setup 的冻结 TDST Support：

```ts
trueHigh[current] < originTDSTSupport
```

该比较严格，不包含相等。

即使对应 TDST 显示线已被 `REPLACED` 或 `BROKEN`，origin 值仍用于该 Countdown 的 Cancellation。

### 15.3 审计

Cancellation 不得物理删除 count record。必须追加事件，由渲染层决定是否隐藏旧数字。

---

## 16. Recycle

Recycle 表示当前同方向价格趋势足以使原 Countdown 失去当前有效性。

Recycle 不删除原 Completion 事实。它将 `disposition` 改为 `RECYCLED` 并创建后续 Countdown。

### 16.1 Setup Extended Count Recycle

当已完成 Setup 所在的同一连续 run 首次达到：

```ts
extendedRunLength === recycleSetupCount
```

产生一次 Setup Extended Count trigger。同一 run 在 23、24 等柱不得重复产生 trigger。

目标 Countdown 必须满足：

```ts
countdown.originSetupId === triggerSetup.id &&
countdown.disposition === "ACTIVE"
```

它可以尚未完成，也可以已经完成。

若至少回收一个目标：

1. 为每个目标追加 `COUNTDOWN_RECYCLED`；
2. 设置 `disposition = "RECYCLED"`；
3. 创建一个 replacement Countdown；
4. replacement 的 `originSetupId` 仍为 trigger Setup；
5. `predecessorCountdownIds` 保存被回收的 ID；
6. `creationIndex` 和 `startEligibilityIndex` 均为 trigger index；
7. replacement 可以在 trigger 同柱成为 Countdown 1；
8. replacement 使用 origin Setup 原有 TDST，不重新计算 TDST。

### 16.2 Setup Range Recycle

当新同方向 Setup 完成时，逐个检查当前已存在且 ACTIVE、origin 为更早 Setup 的同方向 Countdown。

```ts
oldRange = oldOriginSetup.range;
newRange = newSetup.range;
```

若：

```ts
oldRange > epsilon
```

则计算：

```ts
ratio = newRange / oldRange;
```

使用第 5 节的标量比较器判断以下闭区间，满足时回收该旧 Countdown：

```ts
recycleRangeMinRatio <= ratio &&
ratio <= recycleRangeMaxRatio
```

若 `oldRange <= epsilon`，不得除零；该旧 Countdown 不触发 Range Recycle，并且必须输出 `DIAGNOSTIC` 事件，code 固定为 `ZERO_OR_NEAR_ZERO_SETUP_RANGE`。

新 Setup 正常创建的 Countdown 即为 replacement，不额外重复创建。它的 `predecessorCountdownIds` 包含本柱因 Range Recycle 被回收的 Countdown ID。

### 16.3 Recycle 与完成事件

若一个 Countdown 先完成、后 Recycle，事件顺序必须保留：

```text
COUNTDOWN_COMPLETED
...
COUNTDOWN_RECYCLED
```

渲染层可以把原 `13` 显示为 `R`，数据层不得修改或删除原完成事件。

### 16.4 Recycle 与 Cancellation 同柱

Cancellation 优先于 Recycle：

- 已在本柱被取消的 Countdown 不再参与 Recycle；
- 已完成 Countdown 不会被 Cancellation，因此仍可被 Recycle；
- Recycle 后 replacement 才参与本柱计数。

---

## 17. Countdown 完成后的 12-bar 生命周期

```ts
export interface CountdownCompletionLifecycle {
  countdownId: string;
  completionIndex: number;
  barsSinceCompletion: number;
  state:
    | "WITHIN_12_BARS"
    | "AFTER_12_BARS"
    | "INVALIDATED_BY_RECYCLE";
  stateChangedIndex?: number;
}
```

定义：

```ts
barsSinceCompletion = currentIndex - completionIndex;
```

- 完成柱：0；
- 后续第 1 根：1；
- 后续第 12 根：12，仍属于 `WITHIN_12_BARS`；
- 后续第 13 根：13，进入 `AFTER_12_BARS` 并产生一次 `COMPLETION_WINDOW_ELAPSED`；
- 没有第 13 根数据时不得提前发出 elapsed；
- Countdown 被 Recycle 时转为 `INVALIDATED_BY_RECYCLE`，不再产生 elapsed；
- 普通 TDST 显示破位不改变生命周期；
- 未实现 ResponseDetector 时不得推断是否已经产生市场响应。

Risk Level 属于独立扩展，不影响上述计数边界。

---

## 18. 单柱确定性处理顺序

每根柱必须作为一次不可分割事务，严格按以下顺序处理：

```text
1. 校验输入柱，计算 True High / True Low
2. 对上一柱结束时仍 pending 的 Setup 检查 Late Perfection
3. 更新唯一 Setup 扫描器
4. 生成 Setup Started / Progress / Interrupted / Completed 事件
5. 对新完成 Setup 创建 TDST，并替换同类型旧显示线
6. 为新完成 Setup 创建普通 Countdown，但暂不计数
7. 使用本柱新完成的相反 Setup 取消旧的未完成 Countdown
8. 对仍有效的未完成 Countdown 执行 TDST Cancellation
9. 对未被取消的 Countdown 执行 Range Recycle 和 Extended Count Recycle
10. 创建 Extended Count replacement Countdown，并补充 predecessor 关联
11. 对所有本柱 eligible、ACTIVE、未完成 Countdown 执行普通计数
12. 在准备记录 8 或 final 时执行相应 Deferral
13. 记录正式 count 和 Countdown Completion
14. 更新 TDST SIMPLE_CLOSE 显示生命周期
15. 更新 12-bar Completion 生命周期
16. 按事件 sequence 输出本柱事件和快照
```

补充规则：

- 第 6 步新 Countdown 不属于“旧 Countdown”，不会因创建自己的 Setup 而在第 7 步取消；
- 第 8 步允许检查新 Countdown，但合法 OHLC 下它通常不可能立即违反自己的 origin TDST；
- 第 9 步只回收本柱该步骤开始时仍为 ACTIVE 的实例；
- 第 10 步创建的 replacement 可参与第 11 步本柱计数；
- 所有集合遍历按稳定 ID 升序，事件按单调递增 `sequence` 排序；
- 任何实体在同一柱最多发生一次 terminal disposition 变化。

---

## 19. 状态转换

### 19.1 Setup run

```text
EMPTY
  └─ qualifying start ─► RUNNING

RUNNING
  ├─ same direction/equality continuation ─► RUNNING
  ├─ reaches setupLength ─► RUNNING_COMPLETED
  └─ breaks/switches ─► EMPTY or new RUNNING

RUNNING_COMPLETED
  ├─ same direction continuation ─► RUNNING_COMPLETED
  ├─ reaches recycleSetupCount ─► RUNNING_COMPLETED + one trigger
  └─ breaks/switches ─► EMPTY or new RUNNING
```

### 19.2 Countdown

```text
WAITING + ACTIVE
  ├─ reaches eligibility ─► COUNTING + ACTIVE
  ├─ cancellation ─► WAITING + CANCELLED
  └─ recycle ─► WAITING + RECYCLED

COUNTING + ACTIVE
  ├─ non-qualifying bar ─► COUNTING + ACTIVE
  ├─ deferred candidate ─► COUNTING + ACTIVE
  ├─ formal count < final ─► COUNTING + ACTIVE
  ├─ formal final count ─► COMPLETED + ACTIVE
  ├─ cancellation ─► COUNTING + CANCELLED
  └─ recycle ─► COUNTING + RECYCLED

COMPLETED + ACTIVE
  └─ recycle ─► COMPLETED + RECYCLED
```

禁止转换：

- `COMPLETED → CANCELLED`；
- `CANCELLED → ACTIVE`；
- `RECYCLED → ACTIVE`；
- terminal disposition 后继续增加 count；
- 同一 Countdown 完成两次。

---

## 20. 稳定 ID

稳定 ID 必须在 batch、append 和 replay 中一致。

推荐格式：

```text
Setup run / instance:
  setup:{direction}:{startTimestamp}

TDST:
  tdst:{setupId}

Normal Countdown:
  countdown:{originSetupId}:0

Extended-count replacement:
  countdown:{originSetupId}:recycle:{triggerTimestamp}

Event:
  event:{entityId}:{type}:{timestamp}:{localOrdinal}
```

禁止使用随机 UUID。输入 timestamp 唯一，因此以上 ID 在确定性重算中稳定。

`localOrdinal` 用于同一实体同柱可能产生多个不同阶段事件的情况，必须由固定事件顺序派生。

---

## 21. 事件模型

```ts
export type TDSequentialEventType =
  | "SETUP_STARTED"
  | "SETUP_PROGRESS"
  | "SETUP_INTERRUPTED"
  | "SETUP_COMPLETED"
  | "SETUP_PERFECTED"
  | "SETUP_IMPERFECTED_FINAL"
  | "SETUP_RECYCLE_TRIGGERED"
  | "TDST_CREATED"
  | "TDST_REPLACED"
  | "TDST_BROKEN"
  | "COUNTDOWN_CREATED"
  | "COUNTDOWN_PROGRESS"
  | "COUNTDOWN_DEFERRED"
  | "COUNTDOWN_COMPLETED"
  | "COUNTDOWN_CANCELLED"
  | "COUNTDOWN_RECYCLED"
  | "COMPLETION_WINDOW_ELAPSED"
  | "DIAGNOSTIC";

export interface BaseEvent {
  id: string;
  type: TDSequentialEventType;
  sequence: number;
  barIndex: number;
  timestamp: number;
  direction?: Direction;
  entityId: string;
  configHash: string;
  provisional: boolean;
}

export interface TDSequentialEvent<Payload = unknown>
  extends BaseEvent {
  payload: Payload;
}
```

每个具体事件必须携带重放该状态变化所需的 payload。例如：

- Countdown count 事件必须包含 ordinal 和 count record；
- Cancellation 必须包含 reason；
- Recycle 必须包含 trigger Setup ID、被回收 ID 和 replacement ID；
- TDST 事件必须包含 level ID 和 price；
- Diagnostic 必须包含稳定 code，不得只包含自由文本。

永久事件日志只允许 `provisional=false`。

---

## 22. 每柱输出

```ts
export interface SetupMark {
  setupId: string;
  direction: Direction;
  value: number;
  completed: boolean;
  provisional: boolean;
}

export interface CountdownMark {
  countdownId: string;
  direction: Direction;
  value: number | "+" | "R";
  kind: "COUNT" | "DEFERRED" | "COMPLETED" | "RECYCLED";
  provisional: boolean;
}

export interface TDSequentialBarOutput {
  barIndex: number;
  timestamp: number;
  provisional: boolean;

  setupMark?: SetupMark;
  countdownMarks: CountdownMark[];
  perfectedSetupIds: string[];

  currentTDSTResistanceId?: string;
  currentTDSTSupportId?: string;

  events: TDSequentialEvent[];
}
```

说明：

- 单一 Setup 扫描器保证每柱最多一个 Setup mark；
- extended Setup count 超过 `setupLength` 后默认不输出 Setup mark；
- 多个 Countdown 可以在同一柱计数，因此使用数组；
- Late Perfection 使用 ID 数组，不使用含糊的方向布尔值；
- TDST 的完整历史由结果级 `tdstLevels` 提供，每柱只引用当前显示层级；
- Cancellation 后的旧 marks 保留在审计数据中，默认渲染可以隐藏。

---

## 23. 结果和增量 Delta

```ts
export interface TDSequentialResult {
  rulesetVersion: "0.2";
  profile: TDSequentialProfile;
  compatibility:
    | "PUBLIC_RULES_BASELINE"
    | "DOCUMENTED_PUBLIC_SETTINGS_PARTIAL"
    | "CUSTOM_RULESET";
  config: Readonly<TDSequentialConfig>;
  configHash: string;

  capabilities: {
    riskLevel: "NOT_IMPLEMENTED" | "CUSTOM_PROVIDER" | "VERIFIED_RULESET";
    intersection: "DISABLED" | "CUSTOM_PROVIDER" | "VERIFIED_RULESET";
    breakoutQualification:
      | "NOT_IMPLEMENTED"
      | "CUSTOM_PROVIDER"
      | "VERIFIED_RULESET";
  };

  committedBarCount: number;
  bars: TDSequentialBarOutput[];
  setups: SetupInstance[];
  countdowns: CountdownInstance[];
  tdstLevels: TDSTLevel[];
  completionLifecycles: CountdownCompletionLifecycle[];
  events: TDSequentialEvent[];

  provisional?: TDSequentialBarOutput;
}

export interface TDSequentialDelta {
  operation: "APPEND" | "REPLACE_LAST" | "REMOVE_LAST";
  addedEventIds: string[];
  removedEventIds: string[];
  addedOrUpdatedEntityIds: string[];
  removedEntityIds: string[];
  committedBarOutput?: TDSequentialBarOutput;
  provisionalBarOutput?: TDSequentialBarOutput;
  removedBarTimestamp?: number;
}
```

`replaceLastBar` 和 `removeLastBar` 可以撤回最后一根已提交柱产生的事件，因此 delta 必须显式列出 removed IDs。

`bars` 只包含已提交柱；最后一根未收盘柱只出现在 `provisional`。两个内置 Profile 的 `compatibility` 分别为 `PUBLIC_RULES_BASELINE` 和 `DOCUMENTED_PUBLIC_SETTINGS_PARTIAL`。

---

## 24. 批量与增量计算

### 24.1 接口

```ts
calculate(
  bars: readonly OHLCBar[],
  config: TDSequentialConfig
): TDSequentialResult;

appendBar(bar: OHLCBar): TDSequentialDelta;
replaceLastBar(bar: OHLCBar): TDSequentialDelta;
removeLastBar(): TDSequentialDelta;
```

### 24.2 快照

每个已提交柱后保存内部快照：

```ts
export interface TDSequentialStateSnapshot {
  afterBarIndex: number;
  afterTimestamp: number;
  configHash: string;
  nextEventSequence: number;
  setupScanner: SetupScannerState;
  setups: SetupInstance[];
  countdowns: CountdownInstance[];
  tdstLevels: TDSTLevel[];
  completionLifecycles: CountdownCompletionLifecycle[];
}
```

`replaceLastBar`：

1. 恢复到倒数第二根已提交柱后的快照；
2. 撤回旧最后一根对应事件和实体变化；
3. 使用新 bar 重算；
4. 返回 added/removed delta。

`removeLastBar` 使用相同回滚机制但不重新计算。

如果当前最后一根只是 provisional：

- `replaceLastBar` 只丢弃旧临时状态并从最后已提交快照重新计算，不产生永久 `removedEventIds`；
- `removeLastBar` 只丢弃 provisional 输入和输出，不回滚已提交快照；
- 只有替换或移除已提交末柱时，delta 才撤回永久事件和实体变化。

### 24.3 任意位置重放

“从任意历史位置重放”必须具备：

- 该位置前一根结束后的完整状态快照；
- 至少 `max(setupLookback + 1, countdownLookback, 1)` 根必要价格上下文；
- 完全相同的 config 和 configHash。

仅从某个中间 OHLC bar、在没有前置状态的情况下开始，不保证得到与全量计算相同的结果。

### 24.4 一致性不变量

```text
batch(all closed bars)
=== append one closed bar at a time
=== restore snapshot + replay remaining bars
```

比较内容包括实体、事件顺序、稳定 ID、TDST 状态和 12-bar 生命周期，不仅比较最终数字。

---

## 25. 不重绘与 provisional

### 25.1 CLOSED_BAR_ONLY

- 只接受已完成 K 线；
- 已确认历史 count 不因未来价格变化而改变；
- 后续 Cancellation 和 Recycle 是新状态事件，不是修改过去；
- 渲染层隐藏旧数字不等于数据层删除记录。

### 25.2 REALTIME_PROVISIONAL

- 只允许最后一根未收盘柱；
- 每次更新都从最后已提交快照创建临时状态；
- 所有临时输出带 `provisional=true`；
- 更新同一未收盘柱时，旧 provisional 结果整体作废，不进入 removed permanent events；
- 柱关闭后重新计算并以 `provisional=false` 提交；
- provisional ID 应使用与最终事件相同的确定性构造，但消费者必须以 provisional 标志区分，不得提前持久化为正式信号。

---

## 26. 渲染规范

默认位置：

| 元素 | 位置 |
| --- | --- |
| Buy Setup | K 线下方第一层 |
| Buy Countdown | K 线下方第二层 |
| Sell Setup | K 线上方第一层 |
| Sell Countdown | K 线上方第二层 |
| Deferral `+` | 对应 Countdown 层 |
| Perfected | Setup 完成柱或实际完善柱附近 |
| TDST Resistance / Support | 水平线 |
| Recycle | 原完成位置或触发位置显示 `R`，由视图策略决定 |
| Cancelled | 默认隐藏，调试模式可显示 |
| Provisional | 使用明显不同的透明度或样式 |

当同一柱存在多个 Countdown mark 时，按 Countdown 稳定 ID 排序后逐层错开，不得完全重叠。

渲染配置与计算配置必须分离。例如 `hideCancelledCounts` 属于 RendererConfig，不属于 `TDSequentialConfig`。

---

## 27. 扩展 Provider

```ts
export interface RiskLevelProvider {
  calculateSetupRiskLevel?(
    setup: Readonly<SetupInstance>,
    bars: readonly OHLCBar[]
  ): number | undefined;

  calculateCountdownRiskLevel?(
    countdown: Readonly<CountdownInstance>,
    bars: readonly OHLCBar[]
  ): number | undefined;
}

export interface IntersectionProvider {
  getCountdownEligibilityIndex(
    setup: Readonly<SetupInstance>,
    bars: readonly OHLCBar[]
  ): number | undefined;
}

export interface BreakoutQualifierProvider {
  qualifyTDSTBreak(
    level: Readonly<TDSTLevel>,
    bar: Readonly<OHLCBar>,
    context: readonly OHLCBar[]
  ): "QUALIFIED" | "DISQUALIFIED" | "NO_BREAK";
}
```

0.2 内置 Profile 不使用这些 provider。Provider 输出必须带 implementation metadata：

```ts
{
  implementation: "CUSTOM_PROVIDER" | "VERIFIED_RULESET";
  providerId: string;
  providerVersion: string;
}
```

没有 verified metadata 的 provider 不得标为官方规则。

---

## 28. 必须覆盖的边界条件

1. 数据不足 `setupLookback + 1` 时没有 Setup comparison；
2. Price Flip 数据不足 `setupLookback + 2` 时不得触发；
3. Setup count 8 后失败，失败柱按新方向规则决定是否成为 count 1；
4. `BREAK` 下相等价格中断 Setup；
5. `CONTINUE_ACTIVE` 下相等价格只能延续现有方向；
6. 相等价格在没有活动 run 时不启动 Setup；
7. Setup 完成柱成为 Countdown 1；
8. Countdown 普通条件失败时暂停但不归零；
9. 连续多个 final candidate 均被延迟；
10. 被延迟后先出现普通不合格柱，再最终完成；
11. 相反 Setup 完成与旧 Countdown 合格条件同柱发生；
12. Cancellation 优先，旧 Countdown 不得在该柱继续计数；
13. TDST Cancellation 与 final candidate 同柱发生；
14. Setup run 第 21 根不 Recycle，第 22 根 Recycle；
15. 已完成 13 在第 22 Setup trigger 后 Recycle；
16. Recycle replacement 在 trigger 同柱成为 count 1；
17. Range ratio 为 0.99、1.00、1.50、2.00、2.01；
18. old Setup range 为 0；
19. 多个同方向 Countdown 中只有匹配 origin 的实例被 Extended Count Recycle；
20. 多个旧 Countdown 被一个新 Setup Range Recycle；
21. TDST 显示线已替换，但旧 Countdown 仍使用 origin TDST；
22. TDST 收盘破位与 TDST Cancellation 条件不同；
23. 完成柱 barsSince=0；
24. 后续第 12 根仍 within，第 13 根转 after；
25. 第 12 根后无数据时不得提前 elapsed；
26. Recycle 后 Completion 生命周期转 invalidated；
27. 跳空使 True High/Low 不同于普通 High/Low；
28. 极小 tick size 和边界 epsilon；
29. `NaN`、Infinity、重复 timestamp、乱序输入被拒绝；
30. 未收盘柱位于历史中间被拒绝；
31. provisional 多次替换不污染正式事件日志；
32. 未收盘柱转已收盘柱只提交一次正式事件；
33. replace/remove last 回滚实体和事件；
34. batch、append、snapshot replay 完全一致；
35. 修改历史复权数据后全量重算。

---

## 29. 测试计划

### 29.1 Setup

- Buy/Sell 连续完成；
- 中断与反向 count 1；
- 单一 run 不重复生成 Setup；
- 完成后延长至 Recycle Count；
- 两种相等策略；
- Continuous 与 Price Flip 模式；
- 非默认 setupLength/lookback；
- 配置非法值。

### 29.2 Perfection

- Buy/Sell 在倒数第二根完善；
- Buy/Sell 在最后一根完善；
- 严格相等不完善；
- disabled；
- Late Perfection 在下一 Setup 前发生；
- Late Perfection 与新 Setup 完成同柱；
- 新 Setup 完成后旧 pending finalized；
- 非默认 setupLength 的相对索引。

### 29.3 Countdown

- 连续和非连续 M 次；
- Setup 完成同柱 count 1；
- start-after policy；
- CLOSE 最终条件；
- OPEN_OR_CLOSE 的 open-only、close-only、均不满足；
- 8 vs. 5 严格边界；
- Final vs. 8 包含相等；
- 多次 deferral 后完成；
- 多实例同柱计数。

### 29.4 Cancellation 与 Recycle

- 两类 Cancellation 的 Buy/Sell 对称情况；
- 已完成 Countdown 不被取消；
- Extended Recycle 未完成和已完成 Countdown；
- Range Recycle 单个和多个目标；
- Cancellation/Reycle 同柱优先级；
- replacement 同柱计数；
- 审计事件不丢失。

### 29.5 TDST 与生命周期

- True High/Low 跳空；
- TDST 创建、替换、收盘破位；
- origin TDST 与显示 TDST 分离；
- 12-bar 的 0、1、12、13 边界；
- Recycle invalidation。

### 29.6 增量和实时

```text
batch === append === snapshot replay
```

- replace closed last；
- remove closed last；
- provisional 多次更新；
- provisional 转 committed；
- 事件 ID、sequence 和实体 ID 一致；
- delta 的 added/removed 集合准确。

### 29.7 对称性

对 OHLC 使用镜像变换：

```ts
newOpen  = constant - oldOpen;
newClose = constant - oldClose;
newHigh  = constant - oldLow;
newLow   = constant - oldHigh;
```

原 Buy 信号应映射为 Sell，原 Resistance 应映射为 Support，反之亦然。

0.2 验收至少需要：

- 40 个聚焦单元测试；
- 8 组完整状态机集成测试；
- 4 组批量/增量/重放一致性测试；
- 3 组 provisional 回滚测试。

---

## 30. 核心处理伪代码

```ts
function processBar(i: number, provisional: boolean): void {
  validateBarAndOrdering(i);
  updateDerivedPrices(i);

  evaluatePendingLatePerfection(i);

  const setupEvents = setupScanner.process(i);
  const completedSetups = collectCompletedSetups(setupEvents);
  const extendedTriggers = collectExtendedRecycleTriggers(setupEvents);

  for (const setup of completedSetups) {
    createAndActivateTDST(setup, i);
    createNormalCountdownWithoutCounting(setup, i);
  }

  cancelIncompleteCountdownsByOppositeSetups(completedSetups, i);
  cancelIncompleteCountdownsByOriginTDST(i);

  const rangeRecycleResult = recycleByNewSetupRanges(
    completedSetups,
    i
  );
  attachPredecessorsToNormalCountdowns(rangeRecycleResult);

  const extendedRecycleResult = recycleByExtendedRuns(
    extendedTriggers,
    i
  );
  createExtendedReplacementCountdowns(extendedRecycleResult, i);

  for (const countdown of countEligibleCountdownsInStableOrder(i)) {
    if (!qualifiesOrdinaryCount(countdown, i)) continue;

    const nextOrdinal = countdown.count + 1;

    if (
      nextOrdinal === 8 &&
      config.enable8Vs5Deferral &&
      !passes8Vs5(countdown, i)
    ) {
      recordDeferral(countdown, "EIGHT_VS_FIVE", i);
      continue;
    }

    if (
      nextOrdinal === config.countdownLength &&
      config.enableFinalVs8Deferral &&
      !passesFinalVs8(countdown, i)
    ) {
      recordDeferral(countdown, "FINAL_VS_EIGHT", i);
      continue;
    }

    recordFormalCount(countdown, nextOrdinal, i);

    if (nextOrdinal === config.countdownLength) {
      completeCountdown(countdown, i);
    }
  }

  updateTDSTDisplayLifecycle(i);
  updateCompletionLifecycles(i);
  emitBarOutput(i, provisional);
}
```

---

## 31. 验收标准

实现完成必须满足：

- Setup 和 Countdown 不读取未来数据；
- Setup 单一扫描器保证同柱方向唯一；
- 配置和所有预设可完整序列化；
- 非法配置在计算前失败；
- Countdown 非连续累计；
- Final vs. 8 可以重复延迟；
- 同柱执行顺序唯一且与伪代码一致；
- 所有实体和事件 ID 在三种计算方式中稳定；
- Cancellation 不物理删除历史 count；
- Recycle 不修改历史完成事件；
- 已完成 Countdown 可被 Recycle，但不可被 Cancellation；
- TDST 显示生命周期与 origin Cancellation 引用分离；
- 12-bar 边界无 off-by-one；
- provisional 不污染永久状态；
- replace/remove 返回可审计 delta；
- batch、append、snapshot replay 完全一致；
- Risk/Intersection/Qualifier 未实现时明确拒绝或标记；
- 输出包含 ruleset version、profile、完整 config 和 config hash；
- 输出包含 compatibility 和未实现能力声明；
- 达到第 29 节最低测试数量。

---

## 32. 推荐开发阶段

### Phase 1：确定性核心

```text
配置校验
统一比较器
True High / True Low
Setup 单一扫描器
Perfected Setup
Countdown 13/2
Final vs. 8
Opposite Setup Cancellation
事件与稳定 ID
```

### Phase 2：结构状态

```text
TDST 创建/替换/破位
TDST Cancellation
8 vs. 5
12-bar 生命周期
```

### Phase 3：Recycle 与多实例

```text
Extended Count Recycle
Range Recycle
多个 Countdown
Completion 后 Recycle
```

### Phase 4：增量与实时

```text
状态快照
append/replace/remove
provisional
事件 delta
任意快照位置重放
```

### Phase 5：可验证扩展

```text
RiskLevelProvider
IntersectionProvider
BreakoutQualifierProvider
额外规则 Profile
```

---

## 33. 架构建议

```text
OHLC Validation
      │
      ▼
Price Comparator + Derived Prices
      │
      ▼
Single Setup Scanner
      │
      ├────────► Perfection Lifecycle
      ├────────► TDST Registry
      │
      ▼
Countdown Manager
      ├─ Ordinary Count
      ├─ Deferral
      ├─ Cancellation
      ├─ Recycle
      └─ Completion
              │
              ▼
Completion Lifecycle
              │
              ▼
Event Store + State Snapshots
              │
       ┌──────┴──────┐
       ▼             ▼
Chart Renderer   Backtest/Scanner
```

核心原则：

> 计算层只产生事实、状态和可审计事件；渲染层决定如何显示；策略层决定是否交易；风险层决定仓位和退出。

引擎内部不得直接执行交易：

```ts
// 禁止
if (buy13) enterLong();
```

正确关系：

```text
TD Sequential Engine → 市场状态事件
Strategy             → 入场/退出决策
Risk Manager         → 仓位和风险控制
Renderer             → 标签、线条和隐藏策略
```

---

## 34. 公开资料依据

本规范主要依据以下公开页面中能够机械表达的内容：

1. DeMARK Analytics, 9-13：Setup、Countdown、12-bar、Deferral、Recycle、Cancellation 公开说明  
   <https://demark.com/9-13/>
2. DeMARK 9-13 on TradingView：当前公开设置、Continuous Setup、TDST、Countdown、Deferral、Recycle 与 Cancellation 说明  
   <https://www.tradingview.com/script/gVMuxasg-DeMARK-9-13/>
3. DeMARK Indicator Descriptions：Setup、13、TDST、Risk Level 等术语说明  
   <https://demark.com/indicators-list/>

公开页面没有给出完整机械公式的部分，本规范均以“工程定义”“扩展 provider”或“不支持”明确标记。
