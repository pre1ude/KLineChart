## Why

Domestic-market chart users need an unfilled-gap view whose meaning is tied to the current viewport rather than the complete loaded history. The existing TradingView-style Gap feature preserves historical segments and recalculates from all data, so it cannot provide this viewport-relative interpretation without changing its established behavior.

## What Changes

- Add an independent, opt-in `gap1` chart option for domestic-style visible-range gaps, supporting both a boolean switch and object options.
- Detect full high/low gaps whose opening candle is visible, including a gap on the first visible candle by reading one preceding context candle.
- Recalculate Gap1 whenever the visible range or candle data changes; determine fill state only through the current viewport right boundary, ignoring later offscreen fills.
- Keep only gaps that remain at least partially unfilled at the viewport right boundary.
- Limit retained Gap1 records to the newest opening timestamps, with a default maximum of 15 and a configurable range of 1-500.
- Render one current-state rectangle per retained gap, spanning from its original formation boundary to the viewport right edge and using only its remaining unfilled price range.
- Optionally render a precision-aware, direction-signed value label below upward gaps and above downward gaps, using the current X-axis text color for prices and direction-colored percentage/width text.
- Reuse `Styles.gap` for upward/downward appearance and allow `gaps` and `gap1` to be enabled simultaneously.
- Update the AAPL daily Gaps demo with independent Gap and Gap1 controls, coexistence, and visible-range recalculation guidance.
- Keep Gap1 silent and separate from indicators, overlays, price-axis range calculation, and the existing Gap lifecycle/logging behavior.

## Capabilities

### New Capabilities

- `visible-range-gap1`: Viewport-relative detection, partial-fill tracking, rendering, and independent enablement of domestic-style unfilled gaps.

### Modified Capabilities

None.

## Impact

- Public API: add `Options.gap1?: boolean | Gap1Options`, disabled by default, with `maxGapCount` and `showValue` options; reuse the existing `Styles.gap` appearance contract.
- Chart state: add dedicated Gap1 calculation/state that derives records from the current visible range.
- Viewport integration: visible-data adjustment becomes the deterministic trigger for Gap1 recalculation after scrolling, zooming, resizing, data changes, and alignment operations.
- Rendering: extend the existing gap main-canvas layer to draw Gap1 after TradingView-style gaps and before candles.
- No new dependencies and no changes to existing `Options.gaps`, indicator, overlay, tooltip, crosshair, logging, or Y-axis range contracts.
