## Context

The existing `gaps` feature derives TradingView-style records from the complete candle list, retains historical partial-fill segments, supports deviation/count/trail options, and emits data-lifecycle logs. Gap1 has a different meaning: its calculation horizon is exactly the current visible range, its right edge represents the viewport's effective "now", and its rendering keeps only the current remaining price region. A later fill outside the viewport must not affect a historical viewport, while an opening candle at the left edge may use the immediately preceding offscreen candle as detection context.

The chart already recalculates `VisibleRange`, rebuilds `ChartStore._visibleDataList`, and redraws the main canvas for scrolling, zooming, resizing, data changes, alignment, and data-zoom changes. The gap layer shares the candle pane's main canvas, and `Styles.gap` provides the required appearance.

## Goals / Non-Goals

**Goals:**

- Add independent `gapShow`/`gap1Show` switches without coupling visibility to `gaps`/`gap1` configuration updates.
- Detect every positive-width full high/low gap whose opening candle is in the visible range.
- Reject original formation changes at or below 0.02% without applying the threshold again after partial fills.
- Use only candles through the visible right boundary to derive the remaining unfilled region.
- Render exactly one current-state rectangle for each still-unfilled Gap1 record.
- Keep the newest retained gaps under a configurable count limit and optionally render precision-aware value labels.
- Require a color for each gap direction and represent fill-only styles with zero border size rather than a transparent color.
- Recalculate deterministically for every visible-range and data change.
- Reuse the main price axis, bar pixel alignment, and gap styles, while placing gap rendering above candles and below indicators and interactive layers.

**Non-Goals:**

- Reuse Gap deviation, trail, touch-close, or logging options.
- Preserve historical partial-fill rectangles.
- Consider candle data to the right of the current viewport when deciding whether a Gap1 remains open.
- Add Gap1-specific styles, queries, events, tooltips, alerts, overlay interactions, or Y-axis range inputs.
- Prevent users from enabling `gaps` and `gap1` together.

## Decisions

### Keep Gap1 as a separate chart-owned feature

Add a pure `calculateGap1(dataList, visibleRange)` function, a small `Gap1Store`, and a `Gap1View`. The record model contains direction, opening index/timestamp, original formation index, and only the current remaining top/bottom bounds. It does not reuse `GapRecord.segments` because preserving historical geometry is explicitly outside Gap1 semantics.

Alternatives considered:

- **Add a mode to GapStore:** rejected because full-history state, filtering, retention, truncation, logging, and segmented rendering would become conditional throughout the existing feature.
- **Calculate inside Gap1View:** rejected because calculation should remain pure/testable and should not repeat on redraws unrelated to the visible range.
- **Generate overlays:** rejected because Gap1 is automatic, non-interactive, and must remain outside overlay persistence and event APIs.

### Separate configuration from visibility

Use `Options.gaps?: GapOptions` and `Options.gap1?: Gap1Options` only for retained normalized behavior, and add `Options.gapShow?: boolean` and `Options.gap1Show?: boolean` for visibility. Configuration updates while hidden do not calculate or render records. Show updates clear or calculate only their feature, and a show-on update uses the latest retained configuration. When both a hide/show flag and configuration arrive in one `setOptions` call, process hides first, merge configurations second, then process shows so enabling calculates exactly once with the newest values. The legacy boolean union forms are intentionally removed because this API is not released yet. Appearance is always read from `Styles.gap`; both direction styles require `borderColor`, while `borderSize: 0` suppresses strokes for fill-only presentations. Style-only and `showValue`-only updates redraw without recalculating records.

Gap1 intentionally has no configurable minimum-deviation, trail-length, or close-mode option. A fixed original-formation threshold rejects increases/decreases at or below 0.02%, using the prior boundary as the percentage denominator. The threshold is checked before record creation only; remaining-region tracking always follows partial-fill semantics and can retain a remainder below the threshold. Final active records are sorted by `openTimestamp` descending before applying `maxGapCount` so newer gaps win deterministically.

### Calculate strictly within the visible time horizon

Clamp `VisibleRange.from` and `VisibleRange.to` to the loaded data bounds and treat `to` as exclusive. Iterate opening candle indices from `from` through `to - 1`. At index `from`, read `dataList[from - 1]` when available so a gap that opens on the first visible candle is detectable; never register a gap whose opening candle is left of `from`.

For each subsequent visible candle, update active gaps before detecting a newly opened gap:

- Upward remaining region `[bottom, top]`: remove it when `low <= bottom`; otherwise lower `top` when `low < top`.
- Downward remaining region `[bottom, top]`: remove it when `high >= top`; otherwise raise `bottom` when `high > bottom`.

Before adding a newly detected record, calculate its original directional change. Require the result to be strictly greater than 0.02%, treating equality as filtered. Do not reapply this test in `updateGap`; otherwise a valid gap would disappear merely because a partial fill reduced its remaining region below the formation threshold.

Only active records at the exclusive right boundary are returned. Data at index `to` or later is never examined, even if it has already filled a returned gap in the complete loaded history. Identical data and visible ranges therefore produce identical Gap1 records.

### Recalculate after visible data is adjusted

`ChartStore.adjustVisibleDataList()` is the single integration point for visible-range-derived state. After rebuilding the visible data list, it asks Gap1Store to recalculate from the current data and `TimeScaleStore.getVisibleRange()`. This path is already reached after scrolling, zooming, resizing, alignment, data-zoom changes, initial/replaced/updated data, and layout-driven range changes.

Showing Gap1 performs an immediate calculation using the current range. Clearing chart data explicitly clears Gap1 records. This avoids subscribing an internal feature to public action callbacks and avoids coupling TimeScaleStore directly to Gap1.

### Draw one current-state rectangle per active gap

Gap1View converts each record into one rectangle:

- left: the gap formation boundary at `openIndex - 1`, pixel-snapped with the shared bar utility and clipped to the widget;
- right: the current main-widget right edge;
- vertical bounds: the record's current remaining top/bottom converted with `pane.getMainAxisWidget()` and clipped vertically.

It batches upward and downward records through `drawRect()` with `Styles.gap`. CandleLayer draws first, then GapLayer draws the existing GapView followed by Gap1View, so both gap modes appear above candles and below IndicatorLayer and the interactive layers. When both features overlap, normal alpha compositing may darken the shared region; this is an intentional consequence of independent simultaneous enablement.

When `showValue` is enabled, Gap1View draws two adjacent text runs at the rectangle's left side after the rectangle. Upward gaps display `lower-upper +percentage%(+width)` using the lower boundary as the percentage denominator. Downward gaps display `upper-lower -percentage%(-width)` using the upper boundary as the denominator, so the label expresses a fall rather than an unsigned range. Price values and signed width use chart price precision, while percentage uses three decimals. The price-range run reads `Styles.xAxis.tickText.color` on every draw so theme and runtime style updates apply without Gap1-specific configuration; the statistical suffix continues to reuse the direction's `borderColor`. After setting the label font, the view measures both runs plus their separator. If the preferred left-aligned origin would put the complete label past the widget's right edge, both runs shift left as one unit; the resulting origin is clamped to zero for exceptionally narrow widgets. Upward labels use a top baseline below the rectangle, while downward labels use a bottom baseline above it.

### Keep Gap1 isolated and silent

Gap1 records remain internal. They do not enter indicators, crosshair data, tooltips, Y-axis range calculations, overlays, persistence, selection, removal, or lifecycle logs. An empty result draws nothing and produces no message.

### Extend the existing AAPL gaps demo

Keep one demo page so users can compare the two gap semantics against identical data and styles. Add independent Gap and Gap1 switches, initialize both for coexistence, and place Gap1's switch, maximum-count input, and value-label switch on their own toolbar row. The switches update `gapShow`/`gap1Show`, while all behavior controls update `gaps`/`gap1` without implicitly changing visibility. Show the effective visible range in the status panel and update that status on visible-range actions. The shared style selector continues to update `Styles.gap` for both features. The fill-only preset keeps direction colors for text and sets `borderSize: 0` so Gap1 statistics remain visible. The guide explains that dragging or zooming recalculates Gap1 and that later offscreen fills are intentionally ignored.

## Risks / Trade-offs

- **A historical viewport can show a gap that is filled later in loaded but offscreen data.** → This is the confirmed viewport-relative meaning of Gap1; tests will lock it explicitly.
- **Simultaneous Gap and Gap1 regions can overlap and darken.** → Keep both independently selectable as requested and document deterministic draw order.
- **All visible full gaps can be noisy on very dense ranges.** → The default maximum of 15 bounds rendering while preserving the newest opening dates; users can raise it up to 500.
- **Worst-case calculation can approach visible-bars × active-gaps.** → Limit work to the visible horizon, mutate only active records, and verify with a focused large-visible-range test if profiling indicates a problem.
- **The `gap1` name is product-specific.** → Preserve the requested public name and keep internal types clearly prefixed with `Gap1`.

## Migration Plan

1. Add the disabled-by-default configuration fields, explicit show switches, and internal Gap1 calculator/store.
2. Integrate recalculation with visible-data adjustment and data clearing.
3. Add Gap1View to the existing GapLayer after GapView and place GapLayer after CandleLayer.
4. Add focused behavior, coexistence, isolation, and regression tests.
5. Rollback by disabling/removing `gap1`; existing `gaps` data and behavior require no migration.

## Open Questions

None. The viewport-right-boundary and left-context-candle semantics are confirmed.
