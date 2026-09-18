# Overlay 时间点模型迁移

Overlay 内部点和模板回调现在统一使用 `Point`：

```ts
interface Point {
  timestamp: number
  offset?: number
  value: number
}
```

`createOverlay`、`overrideOverlay` 的时间点输入格式保持不变。`overlay.points` 不再包含 `dataIndex`，也不再维护 `rawPoints`。已加载数据变化只更新派生绘图位置，导出保留原 timestamp/offset 表达。

offset 可省略（等价于 0），提供时必须是整数；拒绝小数、NaN、Infinity，不自动取整。创建时含非法 offset 的条目返回 undefined；更新时拒绝整次更新，原点、可见性等状态保持不变，开发模式会输出警告。直接构造 Overlay 实例并传入非法 offset 时抛出 RangeError。自定义模板也须遵守整数约定。

本次沿用已有 timestamp 和 offset 的解释，不增加周期字段或未来时间预测。旧模板需要升级，没有自动切换为旧可写 index 模型的兼容层。

## 读取与导出

绘图继续使用 `createFigures`、`createControlPoints` 收到的 `coordinates`。价格读取仍为 `overlay.points[i].value`。事件回调中可以直接读取时间点：

```ts
onDrawEnd(event) {
  const points = event.overlayData.overlay.points.map(point => ({ ...point }))
  savePoints(points)
}
```

不再对 `overlay.points` 调用 `internalToExternal`。图表的 `externalToInternal`、`internalToExternal` 仍是显式坐标转换工具，输入类型分别为 Point 与 IPoint。

已有行情位置转换为时间点时，使用实际 `dataList[dataIndex].timestamp`，不借用分时网格的刻度时间；转回 index 后保持原位置。界外位置仍使用边界 bar 的实际 timestamp 加整数 offset。非法 offset 不生成横向 index，小数 dataIndex 不生成时间锚点；转换结果中的独立 value 仍可保留。

特殊几何逻辑通过 Store 取得当前 `{ dataIndex, value }[]`：

```ts
const projected = chart.getChartStore().getOverlayStore().getProjectedPoints(overlay)
```

当前行情无法定位任一点时返回 undefined；返回值是临时结果，修改它不会改变画线。缓存由 OverlayStore 的 WeakMap 持有，主图与轴视图共享，像素坐标仍随视口重算。Overlay 本身不持有 ChartStore、转换服务、投影缓存或手势快照，不再提供 getProjectedPoints 方法。

## 更新字段

初始化数据和 update 都按运行时白名单提取可修改字段，包括 points、styles、extendData、visible、lock、mode 等属性，以及 onClick 等对外事件回调。模板方法、totalStep、绘制状态和未知运行时字段不会通过实例展开写回；styles 仍按原有规则合并，points 仍会检查整数 offset。

因此 `chart.overrideOverlay({ ...overlay, visible: false })` 可以正常更新可见性，也不会将缓存或图表服务递归合并进画线。持久化继续优先使用显式导出字段，而非将模板行为作为保存协议。

## 创建与控制点回调

`onDrawPointUpdate(points, index, point)` 和 `onControlPointUpdate(points, index, point, controlPointKey)` 的 points、point 均改为 Point。整体替换点时可使用：

```ts
points[index] = { ...point }
```

只复制横向位置时必须同时复制 timestamp 和 offset，不能仅替换 timestamp 而留下旧 offset：

```ts
points[0].timestamp = point.timestamp
points[0].offset = point.offset
```

只改变价格则修改 value。鼠标控制点交互由 OverlayLayer 保留投影横坐标未变的原时间表达，避免将纯价格修改变成重新锚定。虚拟控制点仍通过 controlPointKey 选择实际需要更新的存储点，例如矩形的四个角对应两个时间锚点。

## 主体拖动

`onBodyDrag` 的 point、prevPoint、prevPoints 现在也是时间点，并新增 movedPoints，表示组件按按下时的几何位置计算出的平移结果。模板选取需要提交的点即可：

```ts
onBodyDrag({ movedPoints }) {
  // 示例：只移动第二个锚点，第一点固定。
  this.points[1] = movedPoints[1]
}
```

OverlayLayer 持有按下时的快照并处理 bar 位置平移、数据边界的 reference/offset 选择，以及纯 Y 拖动时保留原锚点。Overlay 只接收并提交时间点，不查询行情；鼠标抬起后交互层清除手势快照。不要把原来的 dataIndex 差替换为 timestamp 毫秒差；不连续交易时间下两者并不等价。

如需计算价格位移，仍可使用 `point.value - prevPoint.value`。prevPoints 是按下时的时间点快照；回调收到的快照可以修改，不会影响组件下一次计算所用的基准。

模板的 onBodyDrag 参数保持上述形式。内部编辑方法 onDragMoveBody 现在也接收完整的 OverlayBodyDragParams，由交互层计算后调用；模型不再提供 startPressedMove，也不保存当前拖动的绘图位置。

## 数据变化与无法定位

`replaceData`、前置加载和追加行情不重选参考。例如 `{ timestamp: T, offset: 2 }` 对应的位置后来出现行情，导出仍保留这份表达，不改写成新 bar 的 timestamp 和 offset=0。

参考暂时无法定位时保留 points 和绘制状态，跳过该画线的几何绘制；数据恢复后重新投影。时间模型不会为了恢复显示而伪造新的参考时间。完全无行情时，鼠标无法建立新的时间点。

不应再调用原有 `syncPointsToRaw`、`reconvertAllFromRaw`、`updatePointPosition`、`updateInternalPoints`、`getSkipDraw` 或 `setSkipDraw`。它们已被时间点存储及按需投影取代。
