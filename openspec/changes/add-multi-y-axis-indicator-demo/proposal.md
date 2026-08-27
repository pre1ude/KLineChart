## Why

The chart currently materializes one fixed left and one fixed right Y axis per drawable pane, so it cannot display several independently scaled indicators in the same pane. Adding ID-addressable Y axes lets applications overlay externally supplied, time-aligned asset prices without introducing a general multi-data-source subsystem.

## What Changes

- Replace the fixed two-axis pane model with a per-pane collection of ID-addressable Y-axis components and widgets while preserving the existing default-axis behavior.
- Add chart APIs to create, query, override, hide/show, and remove non-default Y axes.
- Allow indicators to bind to a Y axis by `yAxisId`; retain `yAxisPosition` as a compatibility fallback for existing integrations.
- Calculate each Y axis range from the candle/default data and indicators bound to that axis, and lay out multiple outside axes on the same side in creation order.
- Route rendering, coordinate conversion, crosshair labels, last-value labels, and Y-axis interaction through the selected Y-axis ID.
- Add a manual HTML demo that starts with AAPL candles, dynamically adds NVDA and MSFT close-line indicators on separate right-side axes, updates their external data through lightweight `extendData` getters and revisions, and supports hide/show/remove lifecycle operations.
- Keep external asset loading, timestamp validation, caches, timers, and compare-asset helpers in the demo; no general DataSeries or indicator-data API is added.

## Capabilities

### New Capabilities
- `multi-y-axis`: ID-addressable multiple Y axes per pane, indicator-to-axis binding, layout, range calculation, interaction, and lifecycle APIs.
- `external-asset-indicator-demo`: A manual three-asset demo using externally managed aligned arrays through indicator `extendData`, with runtime add, update, hide/show, and remove behavior.

### Modified Capabilities

None.

## Impact

- Core pane, Y-axis widget/component, chart layout, event routing, indicator rendering, tooltip/label rendering, coordinate conversion, and exported chart types are affected.
- Existing left/right style configuration and `indicator.yAxisPosition` remain supported through compatibility mapping to default side axes.
- The demo is added under the existing `tests/html` manual-demo structure and introduces no runtime dependency.
- No independent symbol loader, multiple time scale, timestamp union, new built-in indicator, or new indicator data setter is introduced.
