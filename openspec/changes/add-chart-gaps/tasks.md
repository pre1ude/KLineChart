## 1. Public Options and Gap Model

- [x] 1.1 Add `GapOptions`, `Options.gaps`, `GapStyle`, `GapDirectionStyle`, and `Styles.gap` with documented behavior/appearance ownership and public type exports.
- [x] 1.2 Add internal normalized gap behavior option, direction, status, close-reason, segment, record, event, and data-change context types plus behavior defaults.
- [x] 1.3 Implement merging and normalization for count, deviation, and trail behavior with focused unit tests; use the existing style deep merge for `Styles.gap`.

## 2. Pure Gap Calculation

- [x] 2.1 Add calculation tests for upward/downward full-gap detection, open-close overlap rejection, the fixed 14-bar range average, warm-up behavior, and threshold equality.
- [x] 2.2 Implement the rolling 14-bar minimum-deviation filter and chronological registration of upward/downward gaps.
- [x] 2.3 Add tests for touch-close outer-boundary behavior and implement `entered` closure while retaining the full historical segment.
- [x] 2.4 Add tests for advancing/non-advancing partial fills, complete fills, zero-height avoidance, and symmetric downward behavior, then implement segmented partial-close tracking.
- [x] 2.5 Add tests for count eviction, active-gap eviction, original-open-index trail measurement, truncation, and fill-over-truncation precedence, then implement retention and trail limits.
- [x] 2.6 Add deterministic recalculation tests proving identical data/options produce identical gap records and latest-candle revisions can add, update, or remove derived gaps.

## 3. Gap Store and Diagnostic Logging

- [x] 3.1 Extend the common logger with a structured development-only `logInfo` helper without changing production logging behavior.
- [x] 3.2 Implement `GapStore` ownership of enablement, normalized behavior options, calculated records, option signatures, and clear/reset behavior.
- [x] 3.3 Implement GapStore event filtering and de-duplication so only append/latest-bar contexts emit `New Gap Appeared` or price-driven `Gap Closed` logs.
- [x] 3.4 Add GapStore tests for initial/replace/prepend/history/options silence, append logging, latest-bar de-duplication, partial-progress silence, and no close log for truncation, eviction, disablement, or clear.

## 4. Chart Data Integration

- [x] 4.1 Add a GapStore instance and internal getter to ChartStore, initialize it from `Options.gaps`, and clear it with chart data.
- [x] 4.2 Classify existing ChartStore data mutation branches as init, prepend, append, latest update, historical update, and replace with the correct `fromIndex`.
- [x] 4.3 Recalculate enabled gaps before the existing viewport redraw path for every supported data mutation, while keeping indicator task scheduling and callbacks unchanged.
- [x] 4.4 Add ChartStore tests for initialization, runtime enable/disable, partial behavior updates, `Styles.gap` changes without recalculation, every data-change context, and silent historical recalculation.

## 5. Main-Chart Rendering

- [x] 5.1 Add GapView tests for active right-edge extension, ended-segment coordinates, horizontal/vertical clipping, reversed Y coordinates, direction batching, and configured main-axis use.
- [x] 5.2 Implement GapView to read GapStore records and `Styles.gap`, convert segment bounds with the chart X axis and pane main Y axis, clip them to widget bounds, and batch upward/downward rectangles through `drawRect()`.
- [x] 5.3 Add a non-interactive GapLayer that draws GapView on the main canvas and export it from the layer index.
- [x] 5.4 Insert GapLayer between GridLayer and CandleLayer in CandleWidget and add an integration assertion for the intended layer order.

## 6. Isolation and Regression Coverage

- [x] 6.1 Add integration tests confirming gaps do not enter indicator results, indicator tooltips, crosshair indicator data, Y-axis range inputs, overlay queries, overlay exports, selection, or removal.
- [x] 6.2 Add tests confirming disabled gaps and no-gap datasets render no rectangles, text, warning, or lifecycle log.
- [x] 6.3 Verify image composition includes gap regions on the main canvas without requiring overlay inclusion.

## 7. Verification and Performance

- [x] 7.1 Run the focused Gap calculation, GapStore, GapView, ChartStore, and layer integration tests and resolve all failures.
- [x] 7.2 Run the full unit test suite, TypeScript type check, ESLint, and build.
- [x] 7.3 Measure full recalculation and visible rendering with at least 100,000 candles under default settings and document whether incremental calculation is required before release.

## 8. Separate Gap Behavior and Appearance

- [x] 8.1 Move upward/downward visual fields from `GapOptions` into `Styles.gap` and keep only calculation-affecting fields in GapStore.
- [x] 8.2 Update GapView, public exports, default styles, focused tests, and OpenSpec artifacts for the separated ownership model.
- [x] 8.3 Run the full unit test suite, TypeScript type check, ESLint, build, and final OpenSpec validation.

## 9. Interactive Demo

- [x] 9.1 Add a deterministic Gaps demo covering enablement, partial closing, deviation filtering, retention, trail limits, style updates, and incremental replay.
- [x] 9.2 Register the Gaps demo in the existing HTML test index.
- [x] 9.3 Verify the demo source, full test suite, build, and final OpenSpec status.

## 10. AAPL Daily Demo Data

- [x] 10.1 Fetch and normalize a local AAPL daily OHLCV snapshot from the Nasdaq Historical API with source metadata.
- [x] 10.2 Replace the synthetic demo series with the local AAPL snapshot and adapt replay guidance to real historical gaps.
- [x] 10.3 Validate the snapshot, detected gaps, demo module, full tests, build, and final OpenSpec status.

## 11. Gap Border Rendering Regressions

- [x] 11.1 Add regression tests proving stroke-fill rectangles retain their border at very small heights and consecutive segments of one gap share an overlapping odd-width border.
- [x] 11.2 Render positive-size rectangles with a stroke even when their corrected dimensions degenerate, and align consecutive gap-segment boundaries for odd border widths.
- [x] 11.3 Run focused rendering tests, the full unit suite, type check, ESLint, build, and final OpenSpec validation.

## 12. Candle Wick Pixel Alignment

- [x] 12.1 Add GapView regression tests for fractional axis coordinates, candle-wick pixel alignment, and retained consecutive-segment overlap for odd and even border widths.
- [x] 12.2 Snap finite gap boundaries with the candle wick rule and account for odd-width rectangle stroke correction at ended segment boundaries.
- [x] 12.3 Run focused rendering tests, the full unit suite, type check, ESLint, build, and final OpenSpec validation.

## 13. Shared Bar Pixel Alignment

- [x] 13.1 Add shared bar pixel-snap utility tests and replace duplicate CandleBarView, IndicatorView, and GapView helpers.
- [x] 13.2 Document the shared utility as the single source for candle-aligned horizontal coordinates without changing rendered geometry.
- [x] 13.3 Run focused view tests, the full unit suite, type check, ESLint, build, and final OpenSpec validation.
