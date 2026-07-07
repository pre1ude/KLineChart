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
- **THEN** it SHALL call a semantic chart refresh method that maps to the correct internal layout request

### Requirement: Layout request scheduler
Chart internals SHALL translate semantic refresh reasons into coalesced layout requests before running layout stages.

#### Scenario: Semantic refresh is requested
- **WHEN** a semantic chart refresh method is invoked
- **THEN** the chart SHALL merge a layout request with layout stages and render intent into the pending scheduler state

#### Scenario: Chart internals need a specialized refresh
- **WHEN** Chart internals need a refresh that is more specific than a public semantic refresh entry point
- **THEN** the chart SHALL use a narrowly named private intent helper or merge a layout request directly

#### Scenario: Request is submitted during layout flush
- **WHEN** layout refresh is requested while a layout flush is already running
- **THEN** the chart SHALL merge the request into pending scheduler state and continue flushing after the current pass reaches a safe handoff point

#### Scenario: Layout pass requests follow-up work
- **WHEN** a layout pass detects that geometry changed in a way that requires another axis/tick pass
- **THEN** the pass SHALL return follow-up layout stages instead of recursively starting another refresh

### Requirement: Layout and render are separate request concerns
Layout stages SHALL describe geometry and tick work only, while pane repaint SHALL be represented by render intent on the layout request.

#### Scenario: Layout request settles
- **WHEN** a layout request has no follow-up stages and no pending request supersedes its render
- **THEN** the chart SHALL render panes only if the request render intent is set

#### Scenario: Pure pane repaint is needed
- **WHEN** Chart internals need to repaint panes without layout work
- **THEN** the chart SHALL render through the render boundary without submitting layout stages

### Requirement: Public chart contract remains narrow
The public chart type returned by `init()` SHALL use the exported `Chart` interface rather than the concrete implementation class.

#### Scenario: Chart is initialized
- **WHEN** a caller initializes a chart through the package entry point
- **THEN** the returned value SHALL be typed as the public `Chart` interface without internal layout refresh methods

### Requirement: Synchronous behavior is preserved
The semantic layout refresh entry points for data callbacks, resize, pane layout, metric layout, and direct refreshes SHALL preserve synchronous layout behavior.

#### Scenario: Data callback after refresh
- **WHEN** data replacement or update completes through a path that refreshes layout before invoking a callback
- **THEN** the callback SHALL still be invoked after the synchronous layout request flush

#### Scenario: Resize refresh
- **WHEN** chart resize is requested
- **THEN** the resize path SHALL continue to complete its layout request flush synchronously

### Requirement: Viewport refresh requests can be frame-batched
Chart internals SHALL provide a viewport-only layout refresh request path that coalesces repeated viewport requests in the same animation frame.

#### Scenario: Multiple viewport requests happen before the next frame
- **WHEN** viewport layout refresh is requested multiple times before the scheduled frame runs
- **THEN** the chart SHALL schedule at most one viewport layout request flush for the next frame

#### Scenario: Multiple viewport requests happen during layout flush
- **WHEN** viewport layout refresh is requested multiple times while a layout flush is already running
- **THEN** the chart SHALL coalesce them into the pending layout request for the next safe handoff

#### Scenario: Synchronous refresh arrives while viewport request is pending
- **WHEN** a synchronous layout refresh is requested while a frame-batched viewport refresh is pending
- **THEN** the chart SHALL cancel the scheduled frame and flush the merged layout request synchronously

### Requirement: Request-driven layout convergence
The viewport refresh pipeline SHALL converge layout through follow-up layout passes when axis ticks and axis width measurement can affect visible range.

#### Scenario: Axis width changes main width
- **WHEN** a viewport layout request measures pane width and the resulting `mainWidth` changes
- **THEN** the layout pass SHALL return follow-up axis/tick stages and the request flush SHALL continue until layout settles or the safety limit is reached

#### Scenario: Pane repaint is requested before convergence settles
- **WHEN** a layout request has render intent but a layout pass returns follow-up stages
- **THEN** pane repaint SHALL be deferred until follow-up layout passes have settled

#### Scenario: Initial auto alignment depends on stable layout width
- **WHEN** initial data loading needs automatic time-scale alignment
- **THEN** the chart SHALL run the automatic alignment after layout passes settle and before the request renders

#### Scenario: Layout-settled callback requests more layout
- **WHEN** a layout-settled callback submits another viewport layout request
- **THEN** the chart SHALL skip the current render and flush the merged pending request before repainting

### Requirement: Viewport refresh preserves current auto axis width unless widening is required
Viewport-only refreshes SHALL NOT shrink auto Y-axis width when labels become shorter, while full metric/layout refreshes SHALL be allowed to shrink auto Y-axis width to the exact measured size.

#### Scenario: Viewport refresh measures a smaller auto axis width
- **WHEN** `yAxis.size` is `auto` and a viewport refresh measures an axis label width smaller than the current axis width
- **THEN** the horizontal layout SHALL keep the current axis width instead of shrinking it

#### Scenario: Viewport refresh measures a larger auto axis width
- **WHEN** `yAxis.size` is `auto` and a viewport refresh measures an axis label width larger than the current axis width
- **THEN** the horizontal layout SHALL allow the axis width to grow and SHALL return follow-up layout stages if `mainWidth` changes

#### Scenario: Full metric layout measures a smaller auto axis width
- **WHEN** `yAxis.size` is `auto` and a full metric, pane, or resize layout measures an axis label width smaller than the current axis width
- **THEN** the horizontal layout SHALL shrink the axis width to the measured size
