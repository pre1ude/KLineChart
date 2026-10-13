# 逻辑坐标重构：最终提交前审查

## 结论

当前改动具备提交条件，未发现尚未解决的提交阻塞问题。结论基于全部工作区差异审查、运行时边界对照、完整回归测试及生产构建，不代表对所有外部业务扩展的兼容性承诺。

`IPoint.dataIndex` 被 `logicalIndex` 替代是明确的破坏性变更，已按用户确认的设计保留。提交说明应标明 BREAKING CHANGE，并随代码提交 [迁移指南](../../../docs/logical-index-migration.md) 和更新后的 [Overlay 迁移说明](../../../docs/overlay-time-points-migration.md)。本轮没有执行 Git 提交。

## 本轮发现并修复的问题

### [P2，已修复] 零宽度 DataZoom 空视口使用了错误的逻辑原点

前插 8 根历史数据后，逻辑起点为 -8。DataZoom 在主图宽度变为 0 时返回逻辑范围 `{ from: 0, to: 0 }`，经转换得到公开数组范围 `{ from: 8, to: 8 }`，像素 0 也被拾取为数组下标 8；修改前两者均以数组下标 0 为基准。

修复后，空逻辑范围使用当前逻辑起点，公开范围回到 0。可见范围上界同时约束在 `[0, count]`，避免容差取整产生 `-0`。新增回归测试先失败后通过，并验证宽度恢复后保留原来的 DataZoom 百分比范围。

## 源码审查结果

| 文件 | 结果与重点 |
| --- | --- |
| `src/Chart.ts` | 通过；时间点/像素转换使用统一逻辑几何，公开数组下标接口保持原单位。 |
| `src/common/Point.ts` | 通过；只保留一个 IPoint 表示，破坏性变化已记录，Point 持久化格式不变。 |
| `src/common/VisibleRange.ts` | 通过；逻辑范围和公开数组范围的单位明确。 |
| `src/component/Overlay.ts` | 通过；事件辅助转换方法采用新 IPoint，模板业务点继续使用 Point。 |
| `src/component/TimeIndex.ts` | 通过；前插保持已有逻辑锚点，重建/配置变化通过 revision 使其失效。 |
| `src/store/ChartStore.ts` | 通过；覆盖初始化、前插、批量/实时追加、完整/扩展/修正快照、清空与原地时间戳修改；相同时间序列比较结果被复用。 |
| `src/store/OverlayStore.ts` | 通过；已解析投影按逻辑 revision 失效，未解析点在数据版本变化后重试，返回对象不泄露缓存引用。 |
| `src/store/TimeScaleStore.ts` | 通过；像素适配、边界容差、重置、锚点恢复与空范围约束一致。 |
| `src/store/time-scale/TimeScaleMode.ts` | 通过；范围限制及柱宽调整保留原有政策。 |
| `src/store/time-scale/KLineTimeScaleMode.ts` | 通过；滚动、缩放、对齐和 resize 使用逻辑位置。 |
| `src/store/time-scale/DataZoomTimeScaleMode.ts` | 通过；百分比政策保留，零宽度空视口问题已修复。 |
| `src/store/time-scale/TimeShareTimeScaleMode.ts` | 通过；日历时间槽政策保留，投影在相应映射变化后失效。 |
| `src/view/OverlayView.ts` | 通过；拾取、磁吸、几何位置与轴标签在明确边界换算数组下标。 |
| `src/widget/layer/OverlayLayer.ts` | 通过；仅建立完整拖动快照，重投影原子更新，失败后可恢复，数据集重置使旧手势失效。 |

同时复核了全部修改的单元测试、浏览器测试、业务示例和迁移文档。仓库生产调用和示例中未发现遗留的旧 IPoint.dataIndex 访问；迁移文档中的旧代码仅用于前后对照。

## 最终验证

| 检查 | 结果 |
| --- | --- |
| 完整单元测试 | 78 个文件，817 项通过 |
| 完整浏览器测试 | 8 个文件，71 项通过 |
| 生产与浏览器 TypeScript 检查 | 通过 |
| 完整仓库 ESLint | 0 errors，49 warnings；警告均来自未改动文件，改动文件无诊断 |
| 生产构建 | 通过，包括模块和声明文件生成 |
| 发布声明检查 | 5 个迁移示例通过；新 IPoint 可导入，旧 dataIndex 字段按预期被类型系统拒绝 |
| 文档相对链接 | 通过 |
| OpenSpec 严格校验及 diff 空白检查 | 通过 |

浏览器首次全量运行与其他构建检查并行时，有 1 项业务示例在等待页面就绪时超时。未修改断言或等待时间；随后该文件单独运行 17 项全部通过，无并行构建时完整套件 71 项全部通过。加载时序稳定性属于后续可关注项，当前未复现稳定的功能失败。

性能验证沿用 [任务记录](./tasks.md) 中的同进程交替基准：相同时间序列的快照计算避免了重复扫描，投影缓存复用仍然有效。该基准不包含 Canvas 绘制，不能作为帧率承诺。

本轮测试生成的失败截图已移至仓库外的临时目录；构建产物由现有忽略规则排除。提交应包含源码、测试、迁移文档和该 OpenSpec 变更目录，不包含这些临时产物。
