## ADDED Requirements

### Requirement: Semantic layout refresh entry points
Chart internals SHALL provide semantic layout refresh entry points for callers that need to refresh after viewport, pane layout, metric/style, or resize changes.

#### Scenario: Caller requests viewport refresh
- **WHEN** data, time scale state, or axis interaction changes without changing pane height or exact layout metrics
- **THEN** the caller SHALL use a semantic viewport refresh entry point instead of passing low-level viewport recalculation booleans

#### Scenario: Caller requests pane layout refresh
- **WHEN** pane count, pane height, separator drag state, or pane layout options change
- **THEN** the caller SHALL use a semantic pane layout refresh entry point instead of passing low-level viewport recalculation booleans

#### Scenario: Caller requests metric layout refresh
- **WHEN** style, option, locale, or custom metric-affecting state changes
- **THEN** the caller SHALL use a semantic metric layout refresh entry point instead of passing low-level viewport recalculation booleans

### Requirement: Low-level viewport flags are owned by Chart
Stores, event handlers, and widgets MUST NOT directly choose low-level boolean combinations for normal layout refreshes.

#### Scenario: Non-Chart component refreshes layout
- **WHEN** a store, event handler, or widget needs a normal layout refresh
- **THEN** it SHALL call a semantic chart refresh method that maps to the correct low-level pipeline internally

### Requirement: Layout invalidation pipeline
Chart internals SHALL translate semantic refresh reasons and legacy viewport arguments into layout invalidation flags before flushing layout stages.

#### Scenario: Semantic refresh is requested
- **WHEN** a semantic chart refresh method is invoked
- **THEN** the chart SHALL submit a layout invalidation mask through the shared invalidation path

#### Scenario: Chart internals need a specialized refresh
- **WHEN** Chart internals need a refresh that is more specific than a public semantic refresh entry point
- **THEN** the chart SHALL use a narrowly named private intent helper or submit a layout invalidation mask through the shared invalidation path

#### Scenario: Multiple invalidations are pending
- **WHEN** layout invalidation is requested while another invalidation mask is pending
- **THEN** the chart SHALL merge the masks before flushing layout

#### Scenario: Invalidation is requested during layout flush
- **WHEN** a layout stage requests another layout invalidation while a layout flush is already in progress
- **THEN** the chart SHALL merge the new mask into the pending mask and drain it after the current pass without recursively entering another flush

### Requirement: Public chart contract remains narrow
The public chart type returned by `init()` SHALL use the exported `Chart` interface rather than the concrete implementation class.

#### Scenario: Chart is initialized
- **WHEN** a caller initializes a chart through the package entry point
- **THEN** the returned value SHALL be typed as the public `Chart` interface without internal layout refresh methods

### Requirement: Synchronous behavior is preserved
The semantic layout refresh entry points for data callbacks, resize, pane layout, metric layout, and direct refreshes SHALL preserve synchronous refresh behavior.

#### Scenario: Data callback after refresh
- **WHEN** data replacement or update completes through a path that refreshes layout before invoking a callback
- **THEN** the callback SHALL still be invoked after the synchronous layout refresh

#### Scenario: Resize refresh
- **WHEN** chart resize is requested
- **THEN** the resize path SHALL continue to complete its layout refresh synchronously

### Requirement: Viewport refresh requests can be frame-batched
Chart internals SHALL provide a viewport-only layout refresh request path that coalesces with other viewport requests in the same animation frame.

#### Scenario: Multiple viewport requests happen before the next frame
- **WHEN** viewport layout refresh is requested multiple times before the scheduled frame runs
- **THEN** the chart SHALL merge the invalidation masks and perform at most one layout drain for those requests

#### Scenario: Synchronous refresh arrives while viewport request is pending
- **WHEN** a synchronous layout refresh is requested while a frame-batched viewport refresh is pending
- **THEN** the chart SHALL cancel the scheduled frame and flush the merged invalidation synchronously

### Requirement: Invalidation-driven layout convergence
The viewport refresh pipeline SHALL converge layout through pending invalidation masks when axis ticks and axis width measurement can affect visible range.

#### Scenario: Axis width changes main width
- **WHEN** a viewport refresh measures pane width and the resulting `mainWidth` changes
- **THEN** the pipeline SHALL enqueue a follow-up axis-tick invalidation and continue draining pending invalidations until the layout settles or the safety limit is reached

#### Scenario: Pane repaint is requested before convergence settles
- **WHEN** a layout pass that includes pane repaint also enqueues follow-up layout invalidation
- **THEN** pane repaint SHALL be deferred and carried forward until the follow-up layout invalidations have drained

#### Scenario: Initial auto alignment depends on stable layout width
- **WHEN** initial data loading needs automatic time-scale alignment
- **THEN** the chart SHALL run the automatic alignment after layout invalidations have drained and before the final pane repaint

#### Scenario: Layout-settled callback enqueues more layout
- **WHEN** a layout-settled callback submits another viewport invalidation
- **THEN** the chart SHALL skip the current pane repaint and continue draining the new invalidation before repainting

### Requirement: Viewport refresh preserves current auto axis width unless widening is required
Viewport-only refreshes SHALL NOT shrink auto Y-axis width when labels become shorter, while full metric/layout refreshes SHALL be allowed to shrink auto Y-axis width to the exact measured size.

#### Scenario: Viewport refresh measures a smaller auto axis width
- **WHEN** `yAxis.size` is `auto` and a viewport refresh measures an axis label width smaller than the current axis width
- **THEN** the horizontal layout SHALL keep the current axis width instead of shrinking it

#### Scenario: Viewport refresh measures a larger auto axis width
- **WHEN** `yAxis.size` is `auto` and a viewport refresh measures an axis label width larger than the current axis width
- **THEN** the horizontal layout SHALL allow the axis width to grow and SHALL enqueue follow-up layout invalidation if `mainWidth` changes

#### Scenario: Full metric layout measures a smaller auto axis width
- **WHEN** `yAxis.size` is `auto` and a full metric, pane, or resize layout measures an axis label width smaller than the current axis width
- **THEN** the horizontal layout SHALL shrink the axis width to the measured size
