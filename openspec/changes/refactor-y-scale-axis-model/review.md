# `refactor-y-scale-axis-model` 代码审查报告

## 结论

新架构的核心关系是合理的：

```text
series / indicator -> 1 YScale -> 0..N YAxis
```

把数值尺度、数据绑定和视觉轴拆开后，同一个尺度可以在多个位置呈现，拖动任一轴只修改共享尺度；百分比也可以作为轴标签投影，而不必创建第二个尺度。这一方向无需回退。

当前实现仍有 2 个高优先级正确性问题、2 个中优先级 API/语义问题和 1 个低优先级表达能力问题。合入前至少应解决空 `yScaleId` 引用与 overlay 标签绕过 `labelDisplay` 的问题。

## 审查发现

### 1. [高] 空 `yScaleId` 可以破坏引用不变量

**位置：**

- `src/Chart.ts:1280`
- `src/pane/DualYPane.ts:109`
- `src/Chart.ts:1382`

`overrideYAxis`、`createOrOverrideYAxis` 和 `overrideIndicator` 都使用 truthy 判断验证 `yScaleId`。因此显式传入空字符串 `''` 时会跳过“目标尺度必须存在”的检查，却仍会把空字符串保存为绑定值。

后果因入口不同而不一致：

- YAxis 保存空 ID 后，后续通过 `YAxisWidget.getScale()` 解析尺度时可能直接崩溃。
- Indicator 保存空 ID 后，无法再参与任何已注册尺度的范围计算、绘制和标签生成，表现为静默丢失。

这违反了“每个 axis 和 indicator 必须引用 pane 内已有 scale”的架构不变量。

**建议：**

- 使用字段存在性判断，例如 `'yScaleId' in options`，不要用 truthy 判断区分“未传入”和“传入空值”。
- 所有写入引用的 API 统一验证 ID 为非空字符串，并验证其在目标 pane 中存在。
- 添加 `overrideYAxis({ yScaleId: '' })` 与 `overrideIndicator({ yScaleId: '' })` 的回归测试，明确期望为拒绝更新且保留原绑定。

### 2. [高] Overlay 的 Y 轴标签绕过 `labelDisplay`

**位置：**

- `src/view/OverlayView.ts:528`
- `src/extension/overlay/simpleTag.ts:24`
- `src/component/Overlay.ts:103`

默认 overlay Y 轴标签直接对 `point.value` 做价格精度、千分位和小数折叠格式化，没有调用 `YAxisWidget.formatLabel()`。`simpleTag` 的自定义标签也直接格式化原始价格。

因此，同一价格尺度左侧配置 `labelDisplay: Value`、右侧配置 `labelDisplay: Percentage` 时，普通 tick 可以分别显示价格和百分比，但选中 overlay 后，右轴标签仍显示价格。视觉轴在同一位置同时存在两套互相矛盾的显示语义。

此外，公开的 `createYAxisFigures` 回调参数只提供 `yScale`，没有提供当前 axis 的 `labelDisplay` 或统一的 `formatLabel` 能力。第三方 overlay 即使想遵循轴投影，也无法可靠复用内置逻辑。

**建议：**

- 建立唯一的 axis 标签投影入口，并让 tick、crosshair、last-value、overlay 等所有 Y 轴标签都通过该入口。
- 向 `createYAxisFigures` 提供与当前视觉轴相关的格式化能力，例如 `formatLabel(value, fallback)`；不要要求扩展自行读取百分比基准并重复算法。
- 添加左右轴共享 scale、但 `labelDisplay` 不同的 overlay 标签测试。

### 3. [中] 迁移文档遗漏公开回调参数的 breaking change

**位置：**

- `src/component/Indicator.ts:32`
- `src/component/Indicator.ts:85`
- `src/component/Indicator.ts:98`
- `src/component/Overlay.ts:103`
- `openspec/changes/refactor-y-scale-axis-model/migration.md:150`

除资源创建和绑定 API 外，本次改动还把多个公开扩展回调中的 `yAxis` 参数改为了 `yScale`，包括：

- indicator figure attrs callback 的位置参数；
- indicator `createTooltipDataSource` 参数；
- indicator `draw` 参数；
- overlay `create*Figures` 参数。

TypeScript 使用者会收到编译错误，但 JavaScript 使用者若继续解构 `{ yAxis }`，只会在运行时得到 `undefined`。当前迁移指南没有列出这些变化，也没有给出扩展代码的迁移示例。

同时，迁移表将旧类型写成了 `YScaleType.Percentage` / `YScaleType.MinutePercentage`；变更前的实际类型是 `YAxisType.Percentage` / `YAxisType.MinutePercentage`。

**建议：**

- 在 breaking-change 总览和迁移清单中补齐所有公开 callback 参数变化。
- 给出 indicator 与 overlay 各一个 `yAxis -> yScale` 的迁移示例。
- 修正旧枚举名称，避免使用者搜索和替换错误的符号。

### 4. [中] 百分比投影基准与被投影尺度的数据源无关

**位置：**

- `src/widget/YAxisWidget.ts:109`

所有 `Percentage` 视觉轴都使用主 K 线可见区第一条数据的 `close` 作为基准。该逻辑对默认价格尺度通常成立，但 `labelDisplay` 是所有 axis 都可配置的公共选项；当 axis 引用指标尺度或外部资产尺度时，标签仍以主 K 线价格为基准，百分比没有明确业务含义。

当基准不存在或小于等于零时，当前实现把所有值都显示为 `0.00%`。这会把“无法计算”伪装成真实的零变化。

**建议：**

需要明确选择并记录一种产品语义：

1. 将 `Percentage` 限制为默认 K 线价格尺度的显示投影，并在非法组合时拒绝配置；或
2. 让 axis/scale 显式提供 `basis` 或 `basisResolver`，使百分比基准与数据源一致。

基准无效时建议显示 `--`、隐藏标签或回退为 Value，不能统一返回 `0.00%`。相应行为应有零值、缺失数据和非默认尺度测试。

### 5. [低] `axisTitle` 放在共享 scale 上，无法按视觉轴区分

**位置：**

- `src/component/YScaleHost.ts:15`
- `src/view/YAxisView.ts:69`

`axisTitle` 当前属于 `YScaleOptions`，而 `YAxisView` 从共享 scale 读取标题。因此同一个 scale 的所有视觉轴只能显示同一标题。

在左轴显示 Value、右轴显示 Percentage 的典型场景中，调用方无法分别配置“Price”和“Change %”。这不会破坏数值计算，但削弱了“一个尺度可在 N 个位置以不同投影呈现”的 API 表达能力。

**建议：**

将纯展示标题放入 `YAxisOptions`。如果 scale 仍需要携带单位或数据语义，可以保留单独的 scale 元数据，不要让它直接代替每个视觉轴的标题。

## 修复优先级

1. 统一所有引用写入路径的 `yScaleId` 验证，封住无效引用。
2. 统一 axis 标签投影入口，并让 overlay 标签接入 `labelDisplay`。
3. 补齐迁移文档中的 callback breaking changes，修正旧枚举名称。
4. 明确百分比基准的适用范围和无效基准行为。
5. 决定 `axisTitle` 是否迁移到视觉轴。

## 验证情况

本轮审查已运行并通过以下聚焦测试：

```text
src/widget/YAxisWidget.test.ts
src/pane/DualYPane.test.ts
src/Event.test.ts

3 个测试文件通过，16 个测试通过。
```

同时，`git diff --check` 通过。

此前对该变更执行的完整验证结果为：

- TypeScript 类型检查通过；
- 单元测试 508/508 通过；
- 浏览器测试 12/12 通过；
- lint 无错误；
- build 通过；
- OpenSpec strict validation 通过。

现有测试尚未覆盖空 `yScaleId` 的 mutation 路径，也未覆盖 overlay 在百分比视觉轴上的标签投影，因此上述通过结果不能排除本报告中的两个高优先级问题。

