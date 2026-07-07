## Context

Before this change, `ChartImp.adjustPaneViewport(...)` was the central refresh primitive for pane layout, axis tick building, axis width measurement, visible range adjustment, crosshair recalculation, and pane repaint. The implementation was centralized, but its low-level boolean controls were called directly from several layers:

- `Chart` public API methods and pane management paths.
- `ChartStore` data mutation paths.
- `TimeScaleStore` scroll, zoom, and range refresh paths.
- `Event` axis interaction paths.
- `SeparatorWidget` pane resize dragging.

The underlying dependency cycle is expected for a financial chart:

```text
container / pane / style state
  -> pane height and width
  -> mainWidth
  -> visible range
  -> visible data and Y-axis range
  -> axis ticks and label widths
  -> mainWidth
```

The problem is not that this pipeline exists. The problem is that callers outside `Chart` must know which booleans trigger which portions of the pipeline.

## Goals / Non-Goals

**Goals:**

- Make layout refresh call sites semantic and readable.
- Keep `Chart` as the only owner of low-level layout recalculation flags.
- Preserve current synchronous behavior for data callbacks, resize, and indicator calculation completion.
- Create a structure that supports dirty-flag batching without another broad call-site rewrite.
- Coalesce high-frequency viewport-only refresh requests through the existing invalidation mask.

**Non-Goals:**

- Do not change public chart APIs.
- Do not rewrite axis tick calculation, pane height allocation, or time scale modes.
- Do not make data callbacks, resize, pane layout, metric layout, or exact layout paths asynchronous.
- Do not introduce a broader rendering pipeline rewrite.

## Decisions

### Add semantic refresh methods on `Chart`

`ChartImp` will expose internal semantic methods used by chart-owned stores, events, and widgets:

- `refreshPaneLayout()`
- `refreshViewportLayout(afterLayoutSettled?)`
- `refreshMetricLayout()`
- `refreshResizeLayout(anchor?)`

The semantic methods submit a layout invalidation mask to the shared flush pipeline. Data changes, time-scale changes, and axis interactions all use `refreshViewportLayout()` because they need the same viewport/tick/update sequence. Style, option, locale, and metric-affecting changes use `refreshMetricLayout()` because they can legitimately recalculate exact axis metrics. Callers outside `Chart` should no longer pass low-level boolean combinations for layout refresh.

Alternative considered: replace `adjustPaneViewport(...)` with an options object immediately. This improves readability at each call site, but still leaks low-level layout mechanics to stores and widgets.

### Use layout invalidation flags as the synchronous pipeline primitive

The first migration adds internal invalidation flags for `VerticalLayout`, `HorizontalLayout`, `UpdatePane`, `AxisTicks`, `ForceAxisTicks`, and `AllowAxisWidthShrink`. Semantic refresh methods and private intent helpers submit these flags through `_invalidateLayout(...)`, which merges them into a pending mask and then synchronously drains pending work. If layout work enqueues another invalidation while a flush is already in progress, the new mask is merged and handled by the same drain after the current pass. The legacy `adjustPaneViewport(...)` boolean adapter is removed.

Alternative considered: introduce a full requestAnimationFrame scheduler for all layout work. That is closer to Lightweight Charts, but it changes callback and interaction timing. This change adopts the invalidation mask and pending-merge shape while keeping authoritative refresh paths synchronous.

### Add frame-batched viewport requests for high-frequency interactions

After callers are routed through semantic refresh methods, `Chart` adds a narrower `requestViewportLayout()` path for high-frequency viewport-only work. The request path merges the same `HorizontalLayout`, `UpdatePane`, and `AxisTicks` mask as `refreshViewportLayout()`, but schedules the drain on the next animation frame so repeated scroll, zoom, and range interactions within a frame collapse into one flush.

Synchronous entry points remain authoritative. If a synchronous pane, metric, resize, or direct viewport refresh arrives while a viewport request is scheduled, the pending frame is canceled and the merged mask is flushed immediately. This keeps data callbacks and exact layout operations synchronous while gaining Lightweight Charts-style batching for bursty viewport updates.

### Keep the public chart type narrow

The root `init()` API should return the exported `Chart` interface rather than the concrete `ChartImp` class type. This keeps internal refresh methods available to chart-owned internals without advertising them as part of the public chart contract.

Alternative considered: expose refresh methods on the public `Chart` type and mark them internal by convention. That is easy, but it still leaks implementation details to consumers and external mocks.

### Use invalidation-driven layout convergence in the shared flush pipeline

The existing resize path ran multiple passes until `mainWidth` stabilized because width changes can shift visible range, which can then affect Y-axis ticks and axis label width. This logic belongs in the shared viewport refresh primitive rather than a single resize caller.

The shared flush pipeline drains pending invalidation masks until no more layout work is requested. A pass that changes `mainWidth` enqueues another axis-tick invalidation instead of running a local fixed-pass loop. If pane repaint was requested, repaint is carried forward and executed only after the layout drain settles. A high safety cap prevents accidental infinite layout drains, but normal convergence is driven by invalidations becoming empty rather than by a fixed stabilization count.

Alternative considered: leave stabilization only in resize. That keeps the smaller code change, but it leaves the main layout cycle unresolved for the non-resize paths that also change visible range and axis label width.

### Run initial auto alignment after layout settles

Initial data alignment depends on the final `mainWidth`, which can change after data-driven axis ticks are built and Y-axis label widths are measured. Init data loading therefore calls `refreshViewportLayout(...)` with `autoInitialAlignment()` as its layout-settled callback instead of registering that work separately before the first viewport refresh.

Layout-settled callbacks run after the layout drain has no more pending invalidations but before the final pane repaint. If a callback changes time-scale state and submits another viewport invalidation, the pending repaint is skipped and the drain continues. This lets initial auto alignment use the stable width while avoiding an intermediate pane update based on the pre-alignment visible range.

### Keep viewport refreshes grow-only for auto axis width

Viewport refreshes follow the Lightweight Charts-style approach of avoiding a full layout contraction when axis labels become shorter. When `yAxis.size` is `auto`, `refreshViewportLayout()` measures the new label width but keeps the previous axis width if the new optimal width is smaller. If labels require more space, the axis can still widen and enqueue another axis-tick invalidation when the resulting `mainWidth` changes.

Full metric/layout paths (`refreshPaneLayout()`, `refreshMetricLayout()`, and `refreshResizeLayout(anchor?)`) include `AllowAxisWidthShrink`, so they recompute exact axis width and may shrink it. This avoids turning ordinary scroll/data updates into full layout churn while still allowing style, pane, and resize changes to settle to the exact layout.

## Risks / Trade-offs

- [Risk] A semantic method may map to the wrong boolean combination and subtly miss a refresh step. -> Mitigation: implement wrappers as direct aliases for existing call patterns and add focused tests against delegation.
- [Risk] Some tests mock only the old boolean refresh adapter; replacing call sites can break mocks without behavior changes. -> Mitigation: update mocks to use semantic methods or private intent helpers where needed.
- [Risk] Narrowing the `init()` return type may expose consumer code that relied on implementation-class-only methods. -> Mitigation: this aligns the generated type with the documented public `Chart` contract and keeps internal refresh hooks out of that contract.
- [Risk] The codebase may still have direct legacy boolean refresh calls inside `Chart`. -> Mitigation: replace remaining internal calls with semantic methods or narrowly named private intent helpers.
- [Risk] Applying convergence to more refresh paths can add extra axis tick/width work when axis labels change. -> Mitigation: drive follow-up work only from concrete invalidations and keep a safety cap for unexpected non-settling drains.

## Migration Plan

1. Add semantic refresh methods to `ChartImp`.
2. Add internal layout invalidation flags, pending mask merging, and a shared synchronous flush pipeline.
3. Remove `adjustPaneViewport(...)` and route all remaining internal cases through semantic methods or private intent helpers.
4. Return the exported `Chart` interface from `init()` while keeping `ChartImp` as the internal concrete class.
5. Move main-width convergence from `resize()` into the shared invalidation drain.
6. Replace non-`Chart` call sites in stores, events, and widgets with semantic methods.
7. Update focused tests and mocks.
8. Run targeted tests, then type-check.

Rollback is straightforward: restore the replaced call sites to their previous boolean refresh invocations and remove the semantic methods.
