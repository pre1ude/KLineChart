## Why

Chart layout refreshes previously relied on direct calls to `adjustPaneViewport(...)` from chart, store, event, and widget code. The boolean argument combinations are difficult to read and make the layout dependency cycle between pane size, axis ticks, axis width, visible range, and repaint harder to reason about.

This change introduces semantic layout refresh entry points so callers describe what changed, while `Chart` remains the single owner of the low-level layout transaction and render pipeline.

## What Changes

- Add semantic chart-level methods for common layout refresh reasons such as viewport changes, pane layout changes, metric/style changes, and resize.
- Add internal layout stage flags and a shared layout transaction runner that translates refresh reasons into layout passes.
- Keep the existing synchronous behavior and remove the legacy `adjustPaneViewport(...)` boolean adapter.
- Move main-width convergence into the shared layout transaction so data, axis, pane, and resize refreshes use the same convergence behavior.
- Separate layout stages from render intent so panes repaint only after layout settles.
- Preserve current auto Y-axis width during viewport-only refreshes unless labels need more width; allow exact shrink only in full metric/layout refreshes.
- Replace non-`Chart` callers that pass magic boolean combinations with semantic methods.
- Keep internal refresh methods out of the exported `Chart` interface returned by `init()`.
- Preserve current rendering behavior, callback timing, and public chart APIs.
- Preserve synchronous full layout/data callback paths while layering frame-batched viewport refresh requests for high-frequency interaction and time-scale updates.

## Capabilities

### New Capabilities
- `layout-invalidation`: Defines how chart internals request layout refreshes without exposing low-level viewport recalculation flags to stores, events, or widgets.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/Chart.ts`, `src/store/*`, `src/Event.ts`, `src/widget/SeparatorWidget.ts`, and focused tests around layout refresh delegation.
- Public APIs: no intended breaking changes.
- Dependencies: no new runtime dependencies.
- Risk: low-to-medium; behavior should remain synchronous, but refresh routing touches several important data and interaction paths.
