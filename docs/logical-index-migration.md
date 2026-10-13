# 逻辑坐标迁移指南：IPoint.dataIndex → logicalIndex

本指南适用于将视口、画线投影和拖动计算统一为逻辑坐标的这次重构。`IPoint` 虽然表示临时几何点，但已经通过包导出、Chart 方法和扩展回调暴露，因此这次调整是破坏性变更。

没有旧字段的运行时兼容层。TypeScript 调用方应修复类型错误；JavaScript 调用方也需要检查，旧输入可能只返回价格而不返回横向位置：

```js
// 旧调用：新实现返回 { value: 15 }，不再读取 dataIndex。
chart.internalToExternal({ dataIndex: 17, value: 15 })
```

## 1. 哪些接口需要迁移

| 接口或类型 | 原表示 | 新表示 |
| --- | --- | --- |
| 导出的 `IPoint` | `{ dataIndex, value }` | `{ logicalIndex, value }` |
| `chart.externalToInternal(point)` | 返回 `Partial<IPoint>`，横坐标为数组下标 | 返回 `Partial<IPoint>`，横坐标为逻辑坐标 |
| `chart.internalToExternal(point)` | 输入横坐标为 `dataIndex` | 输入横坐标为 `logicalIndex` |
| `event.overlayData.internalToExternal(point)` | 接收旧 `IPoint` | 接收新 `IPoint` |
| `chart.getChartStore().getOverlayStore().getProjectedPoints(overlay)` | 返回含 `dataIndex` 的投影点 | 返回含 `logicalIndex` 的投影点 |

以下接口仍使用原有单位：

- `Point`、`overlay.points`、画线导入导出、绘制及拖动模板参数继续使用 `{ timestamp, offset?, value }`。
- `chart.convertToPixel()` 接收时间点；`chart.convertFromPixel()` 返回时间点。
- K 线数组和指标结果数组、`getDataByDataIndex()`、`coordinateToDataIndex()`、`scrollToDataIndex()`、`zoomAtDataIndex()` 继续使用数组下标。
- 自定义图形回调里的 `xAxis.convertToPixel()` 输入、`xAxis.convertFromPixel()` 输出仍为数组下标。
- `getVisibleRange()` 的 `from/to/domainFrom/domainTo` 仍为数组下标单位；`from/to` 用于 `[from, to)` 遍历，连续边界可以有小数。

**不要全局把 dataIndex 重命名为 logicalIndex。** 两者的数值在加载历史后不同：最初 10 根 K 线的最后一根是 `dataIndex = 9`、`logicalIndex = 9`；前面加载 8 根后，它变成 `dataIndex = 17`、`logicalIndex = 9`。

## 2. 从时间点读取行情或指标

迁移前：

```ts
const point = chart.externalToInternal(timePoint)
if (point.dataIndex !== undefined) {
  const bar = chart.getDataByDataIndex(point.dataIndex)
}
```

迁移后，在数组访问处转换：

```ts
const point = chart.externalToInternal(timePoint)
if (point.logicalIndex !== undefined) {
  const timeIndex = chart.getChartStore().getTimeIndex()
  const dataIndex = timeIndex.logicalToDataIndex(point.logicalIndex)
  const bar = chart.getDataByDataIndex(dataIndex)
  // 指标数组同样使用 dataIndex，例如 indicator.result[dataIndex]。
  // 界外点可能没有对应行情，bar 为 undefined 时跳过数据读取。
}
```

`externalToInternal()` 仍返回部分点。没有行情、时间参考无法定位或 offset 非法时，可能只有 `value`；不要把缺失的 `logicalIndex` 默认设为 0。

## 3. 把已有数组下标转换为时间点

迁移前：

```ts
const point = chart.internalToExternal({ dataIndex, value })
```

迁移后：

```ts
const timeIndex = chart.getChartStore().getTimeIndex()
const point = chart.internalToExternal({
  logicalIndex: timeIndex.dataIndexToLogical(dataIndex),
  value
})
```

传入的是**当前数组**的下标。不要把前插前保存的旧下标当成当前下标；需要跨数据更新保存位置时，预先保存时间点。

事件辅助方法采用相同规则：

```ts
const timeIndex = chart.getChartStore().getTimeIndex()
const point = event.overlayData.internalToExternal({
  logicalIndex: timeIndex.dataIndexToLogical(dataIndex),
  value
})
```

`internalToExternal()` 只为整数逻辑坐标生成时间锚点。小数、NaN、Infinity 不会被自动取整。界外整数位置仍使用边界行情的实际 timestamp 加整数 offset。

## 4. 自定义画线的投影与像素坐标

只需要绘制时，优先使用 `createFigures` / `createControlPoints` 已提供的 `coordinates`，或者公开的 `chart.convertToPixel(timePoint, finder)`。

需要自己处理投影点时：

```ts
const store = chart.getChartStore()
const projected = store.getOverlayStore().getProjectedPoints(overlay)
if (projected !== undefined) {
  for (const point of projected) {
    const x = store.getTimeScaleStore().logicalToCoordinate(point.logicalIndex)
    // 用 x 和 point.value 继续几何计算。
  }
}
```

如果已有代码调用 `xAxis.convertToPixel()`，先换算为数组下标：

```ts
const dataIndex = chart.getChartStore().getTimeIndex().logicalToDataIndex(point.logicalIndex)
const x = xAxis.convertToPixel(dataIndex)
```

不要直接调用 `xAxis.convertToPixel(point.logicalIndex)`。在初始逻辑起点为 0 时它看起来正常，前插历史后会产生偏移。

`getProjectedPoints()` 无法解析全部锚点时返回 `undefined`；此时跳过几何计算并保留原时间点。返回的数组是临时结果，修改它不会更新画线。更新画线继续通过 `overrideOverlay()` 提交时间点。

## 5. 持久化与缓存生命周期

已有 `{ timestamp, offset?, value }` 画线存档不需要转换。不要持久化 `IPoint`，也不要把 `logicalIndex` 当作跨数据集的永久标识。

| 数据操作 | 临时逻辑坐标的有效性 |
| --- | --- |
| K 线模式下只更新价格 | 已有逻辑坐标保持有效 |
| 前插历史、按序尾部追加 | 已有真实 K 线的逻辑坐标保持有效 |
| `replaceData()` 的新序列完整包含旧时间序列，只扩展首尾 | 保留已有逻辑坐标 |
| `replaceData()` 中间插入、删除、裁剪或替换时间序列 | 需要从时间点重新投影 |
| `applyNewData()`、`clearData()`、切换数据集 | 丢弃旧临时坐标，即使新数据的时间戳相同 |
| 分时映射配置或相关数据变化 | 重新取投影，不假设临时坐标永久有效 |

最简单的调用方式是持有 `Point`，在需要几何数据时调用 `externalToInternal()` 或 `getProjectedPoints()`。后者已经处理组件内部缓存失效；业务代码通常无需另建投影缓存。若旧系统只存了 `dataIndex`，必须结合保存时对应的数据序列恢复 timestamp；仅凭旧下标无法可靠迁移。

DataZoom 仍按百分比、分时模式仍按时间槽决定视口。逻辑坐标稳定不代表这两种模式加载数据后像素位置也不变。

## 6. 直接使用内部类的扩展

如果业务代码通过深层路径导入或继承内部类，还需要检查这些变化：

| 内部接口 | 迁移方式 |
| --- | --- |
| `OverlayView.coordinateToPoint()` | 现在返回 `IPoint \| undefined`；需要时间点时再调用 `internalToExternal()` |
| `TimeScaleMode.calcVisibleRange()` / `calcVisibleRangeByCurrentState()` | 改为 `calcLogicalRange()` / `calcLogicalRangeByCurrentState()`，返回逻辑单位的 `{ from, to }` |
| `TimeScaleModeContext` | 新增逻辑起点和右边界的访问方法；移除 `getBarSpace`，需要柱宽时使用 `getBarWidth` |
| `TimeScaleStore.onAppendData()` | 改为 `onBatchDataAppended(count)`；仅用于批量尾部追加。单条实时追加不调用它，不能机械替换旧调用 |
| `TimeScaleMode.onAppendData()` | 已移除，实时追加通过保留逻辑视口实现原有行为 |
| `TimeScaleStore.restoreDataAnchor(anchor)` | 现在还需传入数据变更前保存的像素偏移 `fallbackOffset`，供锚点丢失时恢复 |

普通业务的数据加载应继续调用 Chart 的 `prependData()`、`appendData()`、`updateData()`、`replaceData()`，由组件完成这些内部状态更新。

## 7. 迁移验证

先在业务代码中搜索 `IPoint`、`externalToInternal`、`internalToExternal`、`getProjectedPoints`，逐处判断横坐标是逻辑坐标还是数组下标。建议至少验证：

1. 10 根数据中最后一根的画线，前插 8 根后仍贴在原 K 线上，读取行情使用下标 17。
2. 自定义画线的像素位置和指标取值在前插后仍一致。
3. 中间补数据、裁剪时间序列和切换数据集后，从保存的时间点重新定位。
4. 界外点、暂时缺失的锚点和空数据不会被当作第 0 根 K 线。
5. 时间点导出后重新导入，timestamp、offset、value 保持原有含义。

更早的 Overlay 时间点模型、模板回调与导出接口迁移见 [Overlay 时间点模型迁移](./overlay-time-points-migration.md)。
