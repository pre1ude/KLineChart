## 1. Axis Model and Public Types

- [x] 1.1 Add stable Y-axis IDs, visibility/pane metadata, and indicator `yAxisId` typing while preserving side-based compatibility fields
- [x] 1.2 Replace the pane's fixed left/right storage with an ordered Y-axis registry and compatibility/default-axis resolvers
- [x] 1.3 Add chart-level create, query, override, hide/show, remove, and orphan-cleanup behavior for Y axes

## 2. Layout, Range, and Rendering

- [x] 2.1 Measure and lay out every visible outside/inside axis column by side and creation order
- [x] 2.2 Calculate automatic ranges per resolved axis while keeping candle data and grid ticks on the default axis
- [x] 2.3 Render indicator figures, last-value labels, crosshair labels, and custom tooltip values with each indicator's resolved axis
- [x] 2.4 Route coordinate conversion and image/widget updates through an explicit `yAxisId` with `yAxisPosition` fallback

## 3. Axis Interaction and Lifecycle

- [x] 3.1 Hit-test all visible axes and make axis drag/zoom/double-click affect only the targeted axis
- [x] 3.2 Preserve main-area vertical pan behavior across visible axes and retain manual ranges during indicator recalculation
- [x] 3.3 Support removing an indicator instance by ID and clean up its unused implicitly created axis without affecting other axes
- [x] 3.4 Preserve caller ownership of explicitly created axes and auto-remove only implicitly created orphan axes
- [x] 3.5 Require `paneId` for object-form indicator removal, with exact-ID and pane-local same-name semantics

## 4. External Asset Demo

- [x] 4.1 Add a demo-local external close-line indicator using lightweight `{ symbol, revision, getDataList }` `extendData`
- [x] 4.2 Add fail-fast length/timestamp validation and demo-owned aligned AAPL/NVDA/MSFT caches
- [x] 4.3 Add runtime controls for add, hide/show, and remove with three-axis placement and orphan-axis cleanup
- [x] 4.4 Add continuous last-close timers, hidden-cache updates, latest-revision restore, and unload/removal cleanup
- [x] 4.5 Update the demo to let indicator bindings implicitly create chart-owned comparison axes

## 5. Verification

- [x] 5.1 Run type checking and the narrowest relevant existing automated checks without adding new test cases
- [x] 5.2 Build the library/demo assets and document the agreed manual acceptance checklist
- [x] 5.3 Re-run type checking, unit tests, lint, build, and diff validation after the ownership/API review fixes
