## 1. Semantic Refresh API

- [x] 1.1 Add semantic layout refresh methods to `ChartImp`.
- [x] 1.2 Add internal layout stage flags and a shared synchronous layout transaction runner.
- [x] 1.3 Remove `adjustPaneViewport(...)` and route specialized internal cases through private intent helpers.
- [x] 1.4 Keep `init()` typed to the public `Chart` interface instead of the concrete implementation class.
- [x] 1.5 Move main-width convergence into the shared viewport refresh pipeline.
- [x] 1.6 Merge data and axis refresh semantics into a single viewport refresh entry point.
- [x] 1.7 Keep viewport-only auto Y-axis width grow-only and reserve shrink for full metric/layout refreshes.
- [x] 1.8 Replace fixed-pass stabilization with transaction-driven layout convergence.

## 2. Call-Site Migration

- [x] 2.1 Replace store-level direct `adjustPaneViewport(...)` calls with semantic refresh methods.
- [x] 2.2 Replace event and separator widget direct `adjustPaneViewport(...)` calls with semantic refresh methods.
- [x] 2.3 Replace `Chart` internal direct boolean refresh calls with semantic methods or private intent helpers.

## 3. Tests And Verification

- [x] 3.1 Update focused tests and mocks for the new semantic refresh methods.
- [x] 3.2 Verify no source files still call `adjustPaneViewport(...)` directly.
- [x] 3.3 Run targeted tests and type-check.
- [x] 3.4 Cover viewport grow-only auto Y-axis width behavior with focused tests.
- [x] 3.5 Cover re-entrant layout transactions and deferred pane repaint behavior with focused tests.

## 4. Frame-Batched Viewport Requests

- [x] 4.1 Add a frame-batched viewport layout request path that schedules a viewport transaction.
- [x] 4.2 Route high-frequency time-scale and axis interaction refreshes through the request path while preserving synchronous data, pane, metric, and resize refreshes.
- [x] 4.3 Cover request batching and synchronous flush preemption with focused tests.
- [x] 4.4 Coalesce repeated viewport requests queued during an active transaction.

## 5. Layout-Settled Initial Alignment

- [x] 5.1 Add a layout-settled callback phase before final pane repaint.
- [x] 5.2 Move initial `autoInitialAlignment()` into the layout-settled phase.
- [x] 5.3 Cover layout-settled callback draining and init data alignment timing with focused tests.

## 6. Layout And Render Separation

- [x] 6.1 Represent layout stages separately from render intent in layout transactions.
- [x] 6.2 Keep pane repaint behind an explicit render boundary after layout settles.
- [x] 6.3 Update focused tests to assert layout stages and render intent independently.
