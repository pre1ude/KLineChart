## Why

The current OHLC (American bar) renderer scales stroke thickness with candle width, so zooming in turns the chart into thick blocks instead of preserving the 1 CSS pixel appearance used by TradingView Lightweight Charts. The renderer also loses completely flat bars because a zero high-low range produces a zero-height center line.

## What Changes

- Keep the OHLC center line and open/close ticks at a constant thickness of 1 CSS pixel at every bar width.
- Size open/close ticks with the Lightweight Charts stepped-length formula based on center-to-center bar spacing.
- Draw the center line and ticks as adjacent, non-overlapping rectangles.
- Suppress open/close ticks when the rendered candle entity width is 1 pixel, while allowing ticks to extend beyond wider narrow entities.
- Preserve a visible 1×1 pixel center mark for flat OHLC bars.
- Apply the same geometry to main-chart OHLC bars and indicator-pane OHLC bars.

## Capabilities

### New Capabilities

- `ohlc-bar-rendering`: Defines pixel geometry, zoom behavior, narrow-bar degradation, and flat-bar visibility for OHLC/American bars.

### Modified Capabilities

None.

## Impact

- Affects OHLC rectangle construction in `src/view/CandleBarView.ts` and its focused unit tests.
- Changes rendered output for both main-chart OHLC mode and indicators that request OHLC rendering.
- Does not add or change public styles, options, data formats, or dependencies.
