## Why

The chart needs a TradingView-aligned way to detect and track full candlestick gaps as price regions that extend until they are covered. Gaps do not fit the existing per-bar indicator result model or the user-managed overlay lifecycle, so they need a dedicated main-chart capability.

## What Changes

- Add an opt-in `gaps` chart option for detection, partial-close, retention, and trail-length behavior, plus `styles.gap` for upward/downward appearance.
- Detect upward and downward full price gaps from adjacent candle high/low ranges, filtered by 30% of the 14-bar average high-low range by default.
- Track each gap as one or more rectangular segments that extend right until the gap is entered, fully filled, or visually truncated by the configured trail limit.
- Render gap regions on the main chart above the grid and below candles, indicators, user overlays, crosshairs, and tooltips.
- Recalculate gap state deterministically for initial, prepended, appended, updated, replaced, and cleared candle data.
- Emit development logs for newly appeared and price-closed gaps without replaying historical events; remain silent when no gaps exist.
- Keep gap results separate from indicator values, indicator tooltips, crosshair indicator data, and user overlay persistence or interaction.

## Capabilities

### New Capabilities

- `chart-gaps`: Configurable detection, lifecycle tracking, rendering, and diagnostic logging for candlestick gap regions on the main chart.

### Modified Capabilities

None.

## Impact

- Public API: add `GapOptions` and `Options.gaps` for behavior plus `GapStyle`, `GapDirectionStyle`, and `Styles.gap` for appearance; existing `chart.setOptions()` and `chart.setStyles()` update their respective configuration domains.
- Chart state: add a dedicated gap store and data-change context handling in the chart store.
- Rendering: add a non-interactive main-canvas gap view/layer to the candle widget.
- Logging: add a development-only informational logger for structured gap lifecycle messages.
- No new runtime dependencies and no changes to indicator, overlay, tooltip, crosshair, or Y-axis range contracts.
