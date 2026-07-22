## Why

Domestic-market chart users need an unfilled-gap view whose meaning is tied to the current viewport rather than the complete loaded history. The existing TradingView-style Gap feature preserves historical segments and recalculates from all data, so it cannot provide this viewport-relative interpretation without changing its established behavior.

## What Changes

- Add explicit `gapShow` and `gap1Show` switches so Gap/Gap1 visibility is independent from their retained configuration objects.
- Detect full high/low gaps whose opening candle is visible, including a gap on the first visible candle by reading one preceding context candle.
- Ignore gaps whose original formation increase/decrease is at most 0.02%; once accepted, retain later partially filled remnants regardless of their remaining percentage.
- Recalculate Gap1 whenever the visible range or candle data changes; determine fill state only through the current viewport right boundary, ignoring later offscreen fills.
- Keep only gaps that remain at least partially unfilled at the viewport right boundary.
- Limit retained Gap1 records to the newest opening timestamps, with a default maximum of 15 and a configurable range of 1-500.
- Render one current-state rectangle per retained gap, spanning from its original formation boundary to the viewport right edge and using only its remaining unfilled price range.
- Optionally render a precision-aware, direction-signed value label below upward gaps and above downward gaps, using the current X-axis text color for prices and direction-colored percentage/width text; shift the complete label left when needed to keep it within the widget's right edge.
- Reuse `Styles.gap` for upward/downward appearance and allow `gapShow` and `gap1Show` to be enabled simultaneously.
- Keep each gap direction's `borderColor` mandatory; the fill-only demo preset disables rectangle strokes with `borderSize: 0` instead of using a transparent border color.
- Update the AAPL daily Gaps demo with independent Gap and Gap1 controls, coexistence, and visible-range recalculation guidance.
- Keep Gap1 silent and separate from indicators, overlays, price-axis range calculation, and the existing Gap lifecycle/logging behavior.

## Capabilities

### New Capabilities

- `visible-range-gap1`: Viewport-relative detection, partial-fill tracking, rendering, and independent enablement of domestic-style unfilled gaps.

### Modified Capabilities

- `chart-gaps`: Separate the retained `gaps` behavior configuration from the explicit `gapShow` visibility switch.

## Impact

- Public API: make `Options.gaps?: GapOptions` and `Options.gap1?: Gap1Options` configuration-only fields, and add disabled-by-default `Options.gapShow?: boolean` and `Options.gap1Show?: boolean` switches; reuse the existing `Styles.gap` appearance contract.
- Chart state: add dedicated Gap1 calculation/state that derives records from the current visible range.
- Viewport integration: visible-data adjustment becomes the deterministic trigger for Gap1 recalculation after scrolling, zooming, resizing, data changes, and alignment operations.
- Rendering: extend the existing gap main-canvas layer to draw Gap1 after TradingView-style gaps, with both gap modes above candles and below indicators and interactive layers.
- This is a clean-break API change for the unreleased Gap/Gap1 options: `gaps: true/false` and `gap1: true/false` are no longer accepted. There are no new dependencies and no changes to indicator, overlay, tooltip, crosshair, logging, or Y-axis range contracts.
