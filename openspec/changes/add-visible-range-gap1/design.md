## Context

The existing `gaps` feature derives TradingView-style records from the complete candle list, retains historical partial-fill segments, supports deviation/count/trail options, and emits data-lifecycle logs. Gap1 has a different meaning: its calculation horizon is exactly the current visible range, its right edge represents the viewport's effective "now", and its rendering keeps only the current remaining price region. A later fill outside the viewport must not affect a historical viewport, while an opening candle at the left edge may use the immediately preceding offscreen candle as detection context.

The chart already recalculates `VisibleRange`, rebuilds `ChartStore._visibleDataList`, and redraws the main canvas for scrolling, zooming, resizing, data changes, alignment, and data-zoom changes. The existing gap layer already has the correct z-order and `Styles.gap` provides the required appearance.

## Goals / Non-Goals

**Goals:**

- Add an independent `gap1` boolean/object option without changing `gaps` behavior.
- Detect every positive-width full high/low gap whose opening candle is in the visible range.
- Use only candles through the visible right boundary to derive the remaining unfilled region.
- Render exactly one current-state rectangle for each still-unfilled Gap1 record.
- Keep the newest retained gaps under a configurable count limit and optionally render precision-aware value labels.
- Recalculate deterministically for every visible-range and data change.
- Reuse the main price axis, bar pixel alignment, gap styles, and gap main-canvas z-order.

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

### Expose an independent boolean or object option

Add `Options.gap1?: boolean | Gap1Options`, disabled by default. The object contains `maxGapCount` (default 15, integer-clamped to 1-500) and `showValue` (default false); passing an object enables Gap1 and merges into the retained normalized configuration. Enabling recalculates from the current data and visible range; disabling clears Gap1 records without discarding configuration. `Options.gaps` and `Options.gap1` are evaluated independently, so both may be enabled. Appearance is always read from `Styles.gap`; style-only and `showValue`-only updates redraw without recalculating records.

Gap1 intentionally has no minimum-deviation, trail-length, or close-mode option. Every positive-width full gap is eligible, remaining-region tracking always follows partial-fill semantics, and the final active records are sorted by `openTimestamp` descending before applying `maxGapCount` so newer gaps win deterministically.

### Calculate strictly within the visible time horizon

Clamp `VisibleRange.from` and `VisibleRange.to` to the loaded data bounds and treat `to` as exclusive. Iterate opening candle indices from `from` through `to - 1`. At index `from`, read `dataList[from - 1]` when available so a gap that opens on the first visible candle is detectable; never register a gap whose opening candle is left of `from`.

For each subsequent visible candle, update active gaps before detecting a newly opened gap:

- Upward remaining region `[bottom, top]`: remove it when `low <= bottom`; otherwise lower `top` when `low < top`.
- Downward remaining region `[bottom, top]`: remove it when `high >= top`; otherwise raise `bottom` when `high > bottom`.

Only active records at the exclusive right boundary are returned. Data at index `to` or later is never examined, even if it has already filled a returned gap in the complete loaded history. Identical data and visible ranges therefore produce identical Gap1 records.

### Recalculate after visible data is adjusted

`ChartStore.adjustVisibleDataList()` is the single integration point for visible-range-derived state. After rebuilding the visible data list, it asks Gap1Store to recalculate from the current data and `TimeScaleStore.getVisibleRange()`. This path is already reached after scrolling, zooming, resizing, alignment, data-zoom changes, initial/replaced/updated data, and layout-driven range changes.

Enabling Gap1 performs an immediate calculation using the current range. Clearing chart data explicitly clears Gap1 records. This avoids subscribing an internal feature to public action callbacks and avoids coupling TimeScaleStore directly to Gap1.

### Draw one current-state rectangle per active gap

Gap1View converts each record into one rectangle:

- left: the gap formation boundary at `openIndex - 1`, pixel-snapped with the shared bar utility and clipped to the widget;
- right: the current main-widget right edge;
- vertical bounds: the record's current remaining top/bottom converted with `pane.getMainAxisWidget()` and clipped vertically.

It batches upward and downward records through `drawRect()` with `Styles.gap`. GapLayer draws the existing GapView first and Gap1View second, both above the grid and below candles. When both features overlap, normal alpha compositing may darken the shared region; this is an intentional consequence of independent simultaneous enablement.

When `showValue` is enabled, Gap1View draws two adjacent text runs at the rectangle's left side after the rectangle. Upward gaps display `lower-upper +percentage%(+width)` using the lower boundary as the percentage denominator. Downward gaps display `upper-lower -percentage%(-width)` using the upper boundary as the denominator, so the label expresses a fall rather than an unsigned range. Price values and signed width use chart price precision, while percentage uses three decimals. The price-range run reads `Styles.xAxis.tickText.color` on every draw so theme and runtime style updates apply without Gap1-specific configuration; the statistical suffix continues to reuse the direction's `borderColor`. Upward labels use a top baseline below the rectangle, while downward labels use a bottom baseline above it.

### Keep Gap1 isolated and silent

Gap1 records remain internal. They do not enter indicators, crosshair data, tooltips, Y-axis range calculations, overlays, persistence, selection, removal, or lifecycle logs. An empty result draws nothing and produces no message.

### Extend the existing AAPL gaps demo

Keep one demo page so users can compare the two gap semantics against identical data and styles. Add independent Gap and Gap1 switches, initialize both for coexistence, and place Gap1's switch, maximum-count input, and value-label switch on their own toolbar row. Show the effective visible range in the status panel and update that status on visible-range actions. Existing TradingView Gap behavior controls remain scoped to `Options.gaps`; the shared style selector continues to update `Styles.gap` for both features. The guide explains that dragging or zooming recalculates Gap1 and that later offscreen fills are intentionally ignored.

## Risks / Trade-offs

- **A historical viewport can show a gap that is filled later in loaded but offscreen data.** → This is the confirmed viewport-relative meaning of Gap1; tests will lock it explicitly.
- **Simultaneous Gap and Gap1 regions can overlap and darken.** → Keep both independently selectable as requested and document deterministic draw order.
- **All visible full gaps can be noisy on very dense ranges.** → The default maximum of 15 bounds rendering while preserving the newest opening dates; users can raise it up to 500.
- **Worst-case calculation can approach visible-bars × active-gaps.** → Limit work to the visible horizon, mutate only active records, and verify with a focused large-visible-range test if profiling indicates a problem.
- **The `gap1` name is product-specific.** → Preserve the requested public name and keep internal types clearly prefixed with `Gap1`.

## Migration Plan

1. Add the disabled-by-default option and internal calculator/store.
2. Integrate recalculation with visible-data adjustment and data clearing.
3. Add Gap1View to the existing GapLayer after GapView.
4. Add focused behavior, coexistence, isolation, and regression tests.
5. Rollback by disabling/removing `gap1`; existing `gaps` data and behavior require no migration.

## Open Questions

None. The viewport-right-boundary and left-context-candle semantics are confirmed.
