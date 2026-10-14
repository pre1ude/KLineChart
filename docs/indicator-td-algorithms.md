# TD 指标状态机与公式对比

本文是 [指标实现公式与对比指南](indicator-algorithms.md) 的 TD 专章，覆盖 `TD9`、`td9_timeshare` 和 `TDSEQ`。源码基线为 `2b98feddb`。这里记录当前实现，而不是把仓库中的设计规范当作已全部实现的功能。

这类指标的结果取决于连续计数、非连续计数、取消、重启和同柱处理顺序，不能仅以一个滚动公式表示。下标 $t$ 从 0 开始；$O,H,L,C$ 分别表示开、高、低、收。

## 三个指标的关系

| 项目 | TD9 | td9_timeshare | TDSEQ |
| --- | --- | --- | --- |
| 计算来源 | [td9/engine.ts](../src/extension/indicator/td9/engine.ts) | 直接复用 TD9 的 `calc` | [tdSequential/engine.ts](../src/extension/indicator/tdSequential/engine.ts) |
| Setup | 固定 9 柱、回看 4 柱 | 同 TD9 | 默认 9／4，可配置 |
| 完善条件 Perfection | 完成时检查 | 同 TD9 | 完成时检查，可选延迟完善 |
| Countdown | 无 | 无 | 默认非连续计数至 13 |
| TDST 水平线 | 无 | 无 | 有 |
| Recycle | 可在完成后重新开始 Setup | 同 TD9 | 对 Countdown 进行回收和替换 |
| 价格比较 | JavaScript 直接比较 | 同 TD9 | 统一容差比较器 |
| 显示 | K 线上方／下方数字 | 分时线着色及数字 9 | Setup、最终 Countdown、延迟／回收标记及 TDST |

“Buy” 是下跌环境对应的计数方向标签，“Sell” 是上涨环境对应的标签；两者本身不表示系统已执行交易。

## TD9 的数学规则

源码：[配置](../src/extension/indicator/td9/config.ts)、[引擎](../src/extension/indicator/td9/engine.ts)、[指标适配及显示过滤](../src/extension/indicator/td9/index.ts)。

### 默认配置

| 配置 | 默认值 | 含义 |
| --- | --- | --- |
| `setupStartPolicy` | `CONTINUOUS_SCAN` | 有合格方向即可开始 |
| `afterCompleted` | `WAIT_BREAK` | 完成 9 后等本方向中断 |
| `enablePerfection` | `true` | 完成时计算完善条件 |
| `calculationMode` | `CLOSED_BAR_ONLY` | 不接受明确标为未收盘的柱 |

配置通过 `extendData.config` 传入，也支持在 `extendData` 直接传 TD9 配置。`calcParams=[]`，9 和 4 不由周期参数修改。

### Setup 连续计数

当 $t\ge4$，定义：

$$\delta_t=C_t-C_{t-4},\qquad d_t=\begin{cases}BUY,&\delta_t<0\\SELL,&\delta_t>0\\\varnothing,&\delta_t=0\end{cases}$$

状态只有 `IDLE`、`COUNTING(direction,count)` 和 `COMPLETED(direction)`：

1. $\delta_t=0$：立即回到 IDLE，本柱无标记。
2. 同方向处于 COUNTING：计数加 1，输出本柱数字；到 9 后进入 COMPLETED。
3. 同方向已 COMPLETED：`WAIT_BREAK` 不再输出；`RESTART` 则本柱重新从 1 开始。
4. 方向改变或当前为空闲：清除旧 run，满足启动条件后本柱记 1。

默认连续扫描的最早 1 在 $t=4$，连续成立时最早 9 在 $t=12$。改变方向的那根柱可以直接成为反向 1。

若 `setupStartPolicy=REQUIRE_PRICE_FLIP`，新 run 还需要：

$$BUY:\ \delta_t<0\land\delta_{t-1}\ge0,\qquad SELL:\ \delta_t>0\land\delta_{t-1}\le0$$

需要 $t\ge5$ 才能检查前一个差值，因此这一配置下最早 1 在 5，最早 9 在 13。**`afterCompleted=RESTART` 导致的同方向重启绕过 Price Flip 要求。**

### Perfection 完善条件

设一个完整 Setup 的第 6～9 根对应下标 $b_6,b_7,b_8,b_9$：

$$BUY:\ \min(L_{b_8},L_{b_9})<\min(L_{b_6},L_{b_7})$$
$$SELL:\ \max(H_{b_8},H_{b_9})>\max(H_{b_6},H_{b_7})$$

只有完成柱的 `setupMark` 标记 `perfected=true`；要求严格突破，相等不算。没有延迟完善，也不会回头在第 8 根补一个新标记。

### 原始计数与图上数字

`calculateTD9()` 保留逐柱原始计数；指标调用的 `calculateTD9Outputs()` 另做显示过滤：

- 任意已完成到 9 的 run，其 1～9 全部保留。
- 当前数组最后一柱正在计数且值至少为 6 时，该 run 已出现的数字全部保留。
- 其他未完成的 run 被隐藏，包括中途中断的 1～5 或 1～8。

因此添加后续数据时，历史位置的**可见标记**可能出现或消失。例如末尾计数到 6 时回显 1～6，下一柱若中断且该 run 未到 9，这些标记会隐藏。比较回放时应分别比较原始引擎结果和适配器结果。

### 分时变体

[td9Timeshare.ts](../src/extension/indicator/timeshare/td9Timeshare.ts) 通过展开 `td9` 模板复用同一计算及过滤逻辑，注册名为 `td9_timeshare`。同一 run 的相邻有效柱按收盘价连线着色，到 9 时绘制数字 9 和引导线。它没有分钟专属的价格公式，也不按日期自动清空计数。

## TDSEQ 配置与比较器

源码：[配置](../src/extension/indicator/tdSequential/config.ts)、[类型与输出](../src/extension/indicator/tdSequential/types.ts)、[引擎](../src/extension/indicator/tdSequential/engine.ts)、[指标适配](../src/extension/indicator/tdSequential/index.ts)。

### 默认配置全表

| 配置 | 默认值 |
| --- | --- |
| `profile` / `rulesetVersion` | `PUBLIC_BASELINE_V0_2` / `0.2` |
| `setupLength` / `setupLookback` | 9 / 4 |
| `setupEqualityPolicy` / `setupStartPolicy` | `BREAK` / `CONTINUOUS_SCAN` |
| `enablePerfection` / `latePerfectionPolicy` | true / `DISABLED` |
| `countdownLength` / `countdownLookback` | 13 / 2 |
| `countdownAllowEqual` | true |
| `countdownStartPolicy` | `ON_SETUP_COMPLETION_BAR` |
| `finalCountComparisonSource` | `CLOSE` |
| `enable8Vs5Deferral` / `enableFinalVs8Deferral` | false / true |
| `enableOppositeSetupCancellation` / `enableTDSTCancellation` | true / true |
| `enableRecycle` / `recycleSetupCount` | true / 22 |
| `enableRangeRecycle` | false |
| `recycleRangeMinRatio` / `recycleRangeMaxRatio` | 1 / 2 |
| `tdstBreakPolicy` | `SIMPLE_CLOSE` |
| `calculationMode` | `CLOSED_BAR_ONLY` |
| `tickSize` | 未设置 |

另一个内置配置名 `TRADINGVIEW_STYLE_PUBLIC_V0_2` 仅把最终计数比较源改为 `OPEN_OR_CLOSE`。这是**本仓库的配置名**，不是对 TradingView 全量算法兼容性的证明。覆盖配置使其不再等于对应预设时，解析器将 profile 改为 `CUSTOM`。

所有计数和回看参数必须为正安全整数；Setup 长度至少 4；Recycle 计数必须大于 Setup 长度。开启 8 vs 5 延迟要求 Countdown 长度至少 8；开启最终 vs 8 延迟要求至少 9。Range 比例必须为有限正值且上限不小于下限，提供的 tickSize 必须有限且为正。

### 浮点比较

本文 TDSEQ 小节中的价格大小关系均通过比较器判断：

$$\varepsilon(a,b)=\begin{cases}0.1\,tickSize,&\text{设置 tickSize}\\8\,\epsilon_{JS}\max(1,|a|,|b|),&\text{否则}\end{cases}$$
$$cmp(a,b)=\begin{cases}-1,&a<b-\varepsilon\\1,&a>b+\varepsilon\\0,&\text{否则}\end{cases}$$

其中 $\epsilon_{JS}=Number.EPSILON$。所谓严格小于，是 `cmp<0`；允许相等，是 `cmp<=0`。设置 tickSize **不会把价格四舍五入到 tick**，只改变比较容差。Range 比例使用独立标量比较器，只用上述机器精度形式，不用 tickSize。

### True High 与 True Low

$$TH_0=H_0,\quad TL_0=L_0$$
$$TH_t=\max(H_t,C_{t-1}),\qquad TL_t=\min(L_t,C_{t-1})\quad(t>0)$$

这是把前收盘引入柱的极值，以计入跳空。后面的 Setup 范围和 TDST 取消使用它们；Countdown 基础条件仍用原始 $H,L$。

## TDSEQ Setup 与完善

设 Setup 长度为 $N$、回看为 $K$，用 $cmp(C_t,C_{t-K})$ 定义方向。默认行为与 TD9 的连续扫描类似，但存在以下区别：

- `setupEqualityPolicy=BREAK` 时相等中断；`CONTINUE_ACTIVE` 时相等可以沿用已有方向并**增加计数**，但不能从空闲启动。
- 同一 run 只在长度首次到 $N$ 时生成一次完成 Setup。之后继续增加 `extendedRunLength`，不会每隔 9 根重新生成 Setup。
- 同一时刻只有一个方向的 Setup 扫描器，但可以存在多个独立 Countdown。
- `REQUIRE_PRICE_FLIP` 使用与 TD9 对应的前后方向变化条件，比较由容差比较器完成。

设 Setup 的实际计数柱为 $b_1,\ldots,b_N$，完成下标为 $s=b_N$：

$$U=\max_{1\le j\le N}TH_{b_j},\qquad D=\min_{1\le j\le N}TL_{b_j},\qquad Range=U-D$$

这些范围只取最初完成 Setup 的 $N$ 柱，后续延长 run 不更新范围。

完善条件考察候选 $b_{N-1},b_N$ 是否有一根满足：

$$BUY:\ L_b<L_{b_{N-3}}\land L_b<L_{b_{N-2}}$$
$$SELL:\ H_b>H_{b_{N-3}}\land H_b>H_{b_{N-2}}$$

默认 $N=9$ 时就是 8／9 对比 6／7，严格突破。先检查较早候选；如果第 8 根已满足，`perfectionIndex` 可为第 8 根，但 `perfectionDetectionIndex` 和事件仍在完成第 9 根时产生。

如果开启 `UNTIL_NEXT_SETUP_COMPLETES`，尚未完善的 Setup 进入 PENDING，后续每柱继续与原来的两个参考极值比较；任意方向新 Setup 完成后，仍未完善的旧 Setup 终结为 `IMPERFECTED_FINAL`。同柱中先检测旧 Setup 的延迟完善，再处理新 Setup 的完成，因此在新完成柱上满足条件仍可完善。

**未完善不会阻止 Countdown 创建。** 当前实现没有“必须先 Perfected 才开始 Countdown”的门槛。

## TDST 水平线与取消

### 创建和显示破位

每个完成 Setup 创建一条 TDST：

$$BUY\ Setup:\ Resistance=U,\qquad SELL\ Setup:\ Support=D$$

同类新水平线替换当前同类 ACTIVE 线；阻力和支撑分别维护。显示破位仅在创建柱之后检查：

$$C_t>Resistance\ \Rightarrow\ 阻力线\ BROKEN$$
$$C_t<Support\ \Rightarrow\ 支撑线\ BROKEN$$

破位后不再作为当前水平线输出；替换后的旧线也不再是当前显示线。

### Countdown 取消

默认开启两条取消规则，只针对 `disposition=ACTIVE` 且未完成的 Countdown：

1. **相反 Setup 完成**：取消所有反方向的未完成 Countdown，不是反向 Setup 刚出现 1 就取消。
2. **违反自己的 TDST**：Buy Countdown 若 $TL_t>Resistance_{origin}$ 则取消；Sell 若 $TH_t<Support_{origin}$ 则取消。

这里引用的是 Countdown **原始 Setup 自己的 TDST**，即使该线后来被替换或已显示破位，也继续作为其判断依据。因此“收盘越过线导致线停止显示”和“真实低／高越过线导致取消”是两个不同条件。

## Countdown 非连续计数

### 创建与基础条件

Setup 完成时创建同方向 Countdown。默认可在完成柱立刻记为 1；配置为 `AFTER_SETUP_COMPLETION_BAR` 时从下一柱开始有资格计数。

设 Countdown 长度为 $M$、回看为 $Q$，默认 $M=13,Q=2$。普通候选条件为：

$$BUY:\ C_t\le L_{t-Q},\qquad SELL:\ C_t\ge H_{t-Q}$$

不满足条件则保持已有计数，**不会归零**。若 `countdownAllowEqual=false`，改为严格比较。每个 Countdown 每柱最多增加 1。

最终第 $M$ 个候选默认仍比较收盘价；在 `OPEN_OR_CLOSE` 模式下改用：

$$BUY:\ \min(O_t,C_t)\le L_{t-Q},\qquad SELL:\ \max(O_t,C_t)\ge H_{t-Q}$$

只有最终计数换源，前面普通计数始终用收盘价；严格／允许相等的配置仍生效。

### 延迟条件 Deferral

设 $c_r$ 为该 Countdown 第 $r$ 个**实际接受计数**的柱下标。先满足基础候选条件，再检查延迟门槛：

| 候选 | Buy 额外条件 | Sell 额外条件 | 默认 |
| --- | --- | --- | --- |
| 第 8 个 | $L_t<C_{c_5}$ | $H_t>C_{c_5}$ | 关闭 |
| 最终第 $M$ 个 | $L_t\le C_{c_8}$ | $H_t\ge C_{c_8}$ | 开启 |

参考的是第 5／8 个成功计数柱的**收盘价**，不是固定向前 5／8 根 K 线，也不是其高低价。两个门槛的相等规则不同，且不随 `countdownAllowEqual` 一起变更。

若基础条件合格但额外门槛失败，输出 `+`，记录延迟候选，已有计数不变；等待下一次合格候选。若基础条件本身不合格，不输出 `+`。

### 完成后的 12 柱窗口

Countdown 接受到第 $M$ 个计数后 `phase=COMPLETED`，不再继续计数。设完成下标为 $c$：

$$barsSinceCompletion=t-c$$

完成柱为 0，后续第 1～12 柱仍为 `WITHIN_12_BARS`，到第 13 柱转为 `AFTER_12_BARS`。这是时间生命周期，代码没有在此窗口内额外计算涨跌目标、胜负或反转确认。已完成 Countdown 若被 Recycle，生命周期变为 `INVALIDATED_BY_RECYCLE`。

## Recycle 回收和替换

Countdown 的两个状态维度相互独立：

- `phase`：WAITING、COUNTING、COMPLETED。
- `disposition`：ACTIVE、CANCELLED、RECYCLED。

因此已完成的 Countdown 仍可能 ACTIVE，随后被回收；它不会因为已经完成而自动避开 Recycle。

### Setup 延长至 22

默认同一 Setup run 的总长度恰好到 `recycleSetupCount=22` 时触发一次：

1. 找出所有 `originSetupId` 等于该 Setup 且 disposition 为 ACTIVE 的 Countdown，包括已完成的。
2. 将它们标为 RECYCLED，输出 `R`；若已完成，同时使其完成生命周期失效。
3. 创建同源替代 Countdown，计数从 0 开始，本触发柱即可作为新的 1。

该规则不表示每过 22 柱重复触发，也不是任意同方向 Setup 都能回收对方 Countdown。若没有合格回收对象，不创建替代 Countdown。

### Range 比例回收

默认关闭，需要 `enableRecycle=true` 且 `enableRangeRecycle=true`。新 Setup 完成时，对同方向、较早 Setup 来源、仍 ACTIVE 的 Countdown 检查：

$$r=\frac{Range_{new}}{Range_{old}},\qquad r_{min}\le r\le r_{max}$$

默认区间为 $[1,2]$，含两端。旧范围按价格比较器判为 0 或接近 0 时跳过，并产生诊断事件。符合条件的旧 Countdown 被回收；新 Setup 当柱已创建的普通 Countdown 作为替代，记录全部前驱 ID，并可以同柱开始计数。

## 同一柱的执行顺序

当完成、取消、回收、最终计数出现在同一柱，顺序会改变结果。`processBar()` 的实际顺序为：

1. 更新 True High／True Low，检测旧 Setup 的延迟完善。
2. 推进 Setup，识别新完成或延长回收触发。
3. 新 Setup 若完成，创建 TDST 和普通 Countdown，然后取消反向未完成 Countdown。
4. 对剩余未完成 ACTIVE Countdown 执行 TDST 取消。
5. 处理新 Setup 的 Range 回收。
6. 处理 Setup 延长回收，并创建替代 Countdown。
7. 对尚有资格的 Countdown 进行候选判断、延迟判断、计数和完成。
8. 更新 TDST 显示破位和完成后 12 柱生命周期。
9. 输出本柱标记、水平线、事件；需要时保存快照。

例如同柱既发生取消又本可成为第 13 个计数，取消先执行，该 Countdown 不会在此柱完成；延长回收与旧 Countdown 候选同柱时，先回收旧对象，再让新对象尝试计 1。

## 收盘确认与增量计算

TD9 和 TDSEQ 都把没有 `isClosed` 字段的柱视为已收盘：

- `CLOSED_BAR_ONLY`：只要出现 `isClosed=false` 就报错，而不是默默跳过。
- `REALTIME_PROVISIONAL`：只允许最后一柱未收盘；在已提交状态的临时副本上计算它，并单独返回 `provisional`，不提交其状态。

TDSEQ 额外校验：时间戳必须为安全整数、唯一且严格递增；OHLC 必须有限；高价不能低于开／收，低价不能高于开／收（通过价格比较器判断）。TD9 没有同等完整的 OHLC 和时间校验。

`TDSequentialEngine` 支持批量、追加、替换末柱、删除末柱和快照恢复。替换末柱必须保持时间戳；修改已提交末柱时先退回前一快照再重算。未收盘末柱应通过替换确认，不能直接在其后追加另一柱而把未收盘柱留在数组中间。

对比增量与批量结果时，需比较相同最终输入及配置下的逐柱输出、实体、事件，而不是仅比较最后一柱的图形。

## TDSEQ 的显示过滤

原始 `calculateTDSequential()` 返回所有计数和事件；指标模板的 `calc` 在此基础上进行过滤：

1. 默认 `showCancelled=false`，隐藏被取消 Countdown 的历史标记。
2. Setup 显示已完成 run，以及数组末尾计数至少为 6 的当前 run；隐藏其他未完成 run。
3. 隐藏 `kind=COUNT` 的普通 Countdown 标记，只保留 `COMPLETED`、`DEFERRED`、`RECYCLED`，对应最终数字、`+`、`R`。

因此图上没有 1～12，并不表示内部没有数过。过滤发生在返回给图表的结果上，不能只查 `indicator.result[].countdownMarks` 就认定它是完整引擎计数历史。事件字段仍可提供额外审计信息。

## 跨平台逐项核对清单

| 维度 | 本仓库需明确的内容 |
| --- | --- |
| Setup 起点 | 连续扫描还是必须 Price Flip；最早可计算位置 |
| 相等处理 | 直接比较还是带容差；相等中断还是继续计数 |
| 完成后的扫描 | 等中断、重启 1，还是延长同一 run |
| 完善规则 | 严格／非严格、8／9 对 6／7、是否延迟完善 |
| Countdown 起点 | Setup 完成当柱还是下一柱 |
| 普通候选 | 收盘价与两柱前原始高低价，是否允许相等 |
| 最终候选 | CLOSE 还是 OPEN_OR_CLOSE |
| 延迟条件 | 8 vs 5、最终 vs 8 的开关及比较符号 |
| 取消 | 反向 Setup 完成时机；真实高低价与原始 TDST |
| Recycle | 对象范围、完成对象是否可被回收、替代对象同柱资格 |
| TDST | True High／Low 范围、同类替换、显示破位与取消区分 |
| 12 柱窗口 | 完成柱是否计为 0，第 13 柱才到期 |
| 实时状态 | 未收盘数据是否临时计算、是否回滚 |
| 可视结果 | 原始计数与隐藏标记、历史回显、已取消标记 |

当前引擎在 `capabilities` 中固定声明 Risk Level 为 `NOT_IMPLEMENTED`、Intersection 为 `DISABLED`、Breakout Qualification 为 `NOT_IMPLEMENTED`。不能根据 [既有 TD 设计规范](td-sequential-spec-v0.2.md) 中关于 provider 的设想，推断当前引擎已有对应公式或注入接口。

验证入口为 [TD9 测试](../src/extension/indicator/td9/index.test.ts)、[分时 TD9 测试](../src/extension/indicator/timeshare/td9Timeshare.test.ts)、[TDSEQ 引擎测试](../src/extension/indicator/tdSequential/engine.test.ts)、[fixture 测试](../src/extension/indicator/tdSequential/fixture.test.ts) 及 [显示适配测试](../src/extension/indicator/tdSequential/index.test.ts)。
