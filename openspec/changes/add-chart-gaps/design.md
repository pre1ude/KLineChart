## Context

TradingView exposes Gaps as an overlay indicator because Pine scripts use the indicator container for all calculated chart overlays. In this codebase, however, indicators are modeled as per-data-index numeric results consumed by Y-axis range calculation, tooltips, last-value marks, and crosshair data. User overlays are interactive, point-based, exportable drawing objects. A gap is instead a chart-owned, data-derived price region with a multi-bar lifecycle, so neither existing abstraction is a natural owner.

The chart already provides the required low-level pieces: `ChartStore` owns candle data and knows how it changes, `CandleWidget` composes ordered layers, the main pane exposes its configured primary Y axis, and `drawRect()` can batch filled and stroked rectangles. The feature can therefore remain local to the main chart without changing indicator, overlay, tooltip, crosshair, or Y-axis range contracts.

## Goals / Non-Goals

**Goals:**

- Match the core TradingView Gaps behavior for full high/low gaps, rightward trails, touch-close and partial-close modes, 14-bar deviation filtering, count limits, trail limits, and green/red styling.
- Keep gap calculation deterministic across initial load, prepend, append, latest-bar update, historical update, replacement, option changes, and clear operations.
- Render gaps on the main canvas above the grid and below candles, indicators, and interactive overlays.
- Emit development-only `New Gap Appeared` and `Gap Closed` logs without replaying historical calculations.
- Add behavior through `Options.gaps` and appearance through the existing `Styles` model.

**Non-Goals:**

- Represent gaps as indicators or user overlays.
- Add selectable, draggable, editable, or persistable gap objects.
- Add production alert callbacks, action events, or an empty-state message.
- Add gap tooltip values or crosshair indicator data.
- Make gaps affect visible price-axis range.
- Implement incremental calculation in V1 or introduce a generic pattern-detection framework.

## Decisions

### Use a dedicated main-chart feature

Add `GapStore`, `GapView`, and `GapLayer`. `GapStore` owns normalized behavior options, calculated gap records, and log de-duplication state. `GapView` converts retained gap segments into rectangle coordinates and reads appearance from the chart's global styles. `GapLayer` draws only on the candle widget's main canvas.

Alternatives considered:

- **Indicator custom draw:** rejected because gap records are not aligned per K-line index and would pollute indicator tooltip, crosshair, pane, and result semantics.
- **Generated overlays:** rejected because automatic results would enter the interactive overlay store, export/persistence APIs, event tree, and overlay canvas while potentially creating many objects.
- **Generic data-decoration framework:** deferred until another feature demonstrates the same abstraction need.

### Separate gap behavior from appearance

Add `gaps?: boolean | GapOptions`. The feature is disabled by default. `true` enables the currently retained/default behavior configuration, `false` disables rendering and clears calculated results while retaining behavior configuration, and an object enables the feature and merges the supplied behavior fields.

Behavior defaults are:

- `closeGapsPartially: false`
- `maxGapCount: 15`, clamped to 1-500
- `minimalDeviationPercent: 30`, clamped to 1-100
- `limitMaxTrailLength: false`
- `maxTrailLength: 300`, normalized to a positive integer

Add `Styles.gap` with separate upward and downward direction styles. Its defaults are opaque red upward-gap and green downward-gap borders with 15%-opaque matching fills. Partial updates flow through `Options.styles` or `chart.setStyles()` using the existing deep style merge.

Every `GapOptions` field affects calculation, so a changed normalized behavior option causes a silent full recalculation and resets the log baseline. `Styles.gap` changes remain in the central chart style store, retain calculated records, and only require a redraw. No visual field is duplicated under `GapOptions`.

### Keep calculation pure and orchestration in GapStore

A pure `calculateGaps(dataList, options)` function returns retained gap records plus chronological open/close event records. GapStore invokes it and decides whether events may be logged based on the data-change context supplied by ChartStore.

V1 performs a full calculation. The algorithm maintains a rolling 14-bar high-low sum plus separate retained and active gap arrays, avoiding scans of already terminal gaps. This is simple and deterministic; a benchmark with at least 100,000 bars and default options will determine whether a later incremental design is necessary.

### Use explicit data-change context for logs

ChartStore classifies data changes as `init`, `prepend`, `append`, `update-latest`, `update-history`, `replace`, or `options`, including a `fromIndex` where relevant. Only append and latest-bar update contexts can emit logs. Initial calculation, historical recalculation, replacement, prepend, and option changes establish a baseline silently.

Event keys use gap direction and opening timestamp, with the closing timestamp added for close events. Repeated updates of the current bar therefore do not duplicate a previously emitted lifecycle log. Trail truncation and count eviction are not price closes and never emit `Gap Closed`.

### Model gap history as unfilled-region segments

Each gap stores its original price bounds and a list of segments. The active segment represents the price region that remains unfilled during its horizontal interval. In partial-close mode, an advancing fill boundary ends the current segment and starts a smaller segment at the same K-line index. A full fill ends the current segment and creates no zero-height successor.

Gap terminal states are `closed` for price entry/full fill and `truncated` for visual trail limits. Count eviction removes a record instead of creating another terminal state.

Coverage is evaluated before trail truncation on each bar, so a gap filled on its limit bar closes normally. Trail length is `currentIndex - openIndex`, measured from the original gap-forming bar and never reset by partial fills.

### Render on the main canvas without affecting scale

Insert `GapLayer` between `GridLayer` and `CandleLayer` so candle bodies and wicks remain unobscured:

`Grid -> Gap -> Candle -> Indicator -> Overlay -> Crosshair -> Tooltip`

GapView uses the chart X axis and `pane.getMainAxisWidget()` for price conversion, and reads upward/downward appearance from `chartStore.getStyles().gap`. Active segments extend to the visible right boundary; ended segments stop at their recorded data index. Rectangles are clipped to the widget bounding box and batched by direction through `drawRect()`.

Gap prices originate between candle highs and lows, and gaps serve as annotations rather than scale-driving series, so the view does not contribute values to Y-axis range calculation.

The rectangle primitive strokes every positive-size region even when odd-width pixel correction reduces a dimension to zero, preserving borders for visually thin gaps. CandleBarView, IndicatorView, and GapView use one shared bar pixel utility for the candle wick rule, `Math.round(x - 0.5)`, preventing their horizontal alignment behavior from drifting independently. Because `drawRect()` insets odd-width strokes by half a pixel, an ended gap segment includes one additional pixel at its right boundary; its stroke center then matches the wick pixel center. Consecutive segments naturally share that same stroke center, while even-width borders use the shared snapped coordinate without the extra correction. Active segments continue to end at the widget boundary.

### Keep public surface minimal

Export `GapOptions` from `Options` and export `GapStyle` plus `GapDirectionStyle` with the other public style types. Keep `GapRecord`, calculation events, data-change context, and `GapStore.getGaps()` internal in V1. Do not add `createGap()`, `removeGap()`, or a public query API.

## Risks / Trade-offs

- **Full recalculation on every latest-bar update may become expensive with 500 simultaneously active gaps.** -> Iterate only active gaps, batch drawing, benchmark 100,000 bars, and defer incremental state/rollback unless measurements require it.
- **A main-chart-specific store and layer add dedicated code to core chart composition.** -> Keep the feature narrowly named and avoid premature generic abstractions.
- **Realtime candles can briefly create a gap that later disappears.** -> Always recompute display from current data and de-duplicate logs by stable event identity; no retraction log is emitted.
- **Development logging is side-effectful.** -> Keep the calculator pure, perform logging only in GapStore orchestration, and use the existing environment-gated logger pattern.
- **Behavior option merging can leave retained custom values after disable/re-enable.** -> Define retained behavior configuration as intentional and keep appearance independently controlled by the global style tree.

## Performance Validation

Measured on 2026-07-20 with Node.js v22.14.0 on arm64 using the production build and default gap options. The deterministic 100,000-candle dataset creates one long-lived upward gap every 5,000 bars, producing 19 lifecycle events and exercising the default retention ceiling with 15 retained active gaps and 15 visible segments.

- Full calculation: after 5 warm-up runs, 30 measured `calculateGaps()` runs had a 3.09 ms median, 5.15 ms p95, and 5.45 ms maximum.
- Visible rendering path: the built `GapView` performed X/Y conversion, clipping, direction batching, and the actual `drawRect()` dispatch for 15 active segments in a 1,000 x 600 widget. After 2,000 warm-up draws, 20 batches of 2,000 draws had a 0.00058 ms per-draw median and 0.00164 ms p95 using a no-op Canvas 2D context. This isolates chart-side rendering work and excludes browser rasterization/compositing.

The measured full recalculation remains comfortably below a 16.7 ms frame budget, while default retention bounds rendering to a small rectangle count. Incremental calculation is therefore not required before V1 release. It can remain a follow-up optimization if target-browser profiling with unusually high configured gap counts shows a material frame-time regression.

## Migration Plan

1. Add the new option and internal feature components with `gaps` disabled by default, so existing charts are unchanged.
2. Integrate calculation into ChartStore data mutations and rendering into CandleWidget.
3. Export the new option types and verify builds, tests, and image rendering.
4. Rollback consists of disabling/removing the `gaps` option and dedicated store/layer; no persisted data migration is required.

## Open Questions

None for V1. Exact green/red color constants may follow the project's chosen TradingView-compatible palette as long as the semantic colors and 15% fill opacity are preserved.
