## ADDED Requirements

### Requirement: Global tooltip render type

The chart SHALL expose an optional initialization-time `tooltip.renderType` setting accepting `canvas` or `dom`. The default effective value SHALL be `canvas`, and the selected renderer SHALL remain fixed for the chart lifetime.

#### Scenario: Canvas remains the default

- **WHEN** a chart is created without `tooltip.renderType`
- **THEN** tooltip content is rendered by the existing Canvas route
- **AND** existing Canvas behavior remains unchanged

#### Scenario: DOM mode is selected at creation

- **WHEN** a chart is created with `tooltip.renderType` set to `dom`
- **THEN** each main widget uses a pane-local DOM tooltip renderer
- **AND** the Canvas tooltip is not displayed on screen

#### Scenario: Runtime option updates do not switch renderers

- **WHEN** `Chart.setOptions` includes a different `tooltip.renderType` after chart creation
- **THEN** the chart continues using the renderer selected at creation
- **AND** selecting another renderer requires recreating the chart

### Requirement: Shared tooltip semantics

The Canvas screen renderer, DOM screen renderer, and Canvas export renderer SHALL consume the same normalized tooltip model. The model SHALL preserve the existing tooltip content, order, visibility rules, custom formatters, indicator data sources, and main-pane standard/rect combinations.

#### Scenario: Candle and indicator content match

- **WHEN** the same crosshair state is rendered in Canvas and DOM modes
- **THEN** candle legends, indicator names/parameters, indicator values, colors, and icon identities are equivalent
- **AND** browser-specific text metrics MAY produce different wrapping or subpixel dimensions

#### Scenario: Main-pane mixed tooltip modes are preserved

- **WHEN** candle and indicator tooltip styles use different existing `showType` values
- **THEN** DOM mode follows the same block order and visibility decisions as the current `CandleTooltipView`

#### Scenario: Indicator pane behavior remains compatible

- **WHEN** an indicator pane is rendered
- **THEN** DOM mode preserves the current indicator-pane behavior, including its existing standard tooltip path
- **AND** DOM mode does not introduce new rect behavior for indicator panes in this change

### Requirement: Pane-local DOM rendering

The DOM renderer SHALL create at most one reusable tooltip root per main widget and SHALL position it using that widget's local coordinate system and clipping boundary.

#### Scenario: Multiple panes render independently

- **WHEN** a chart has a candle pane and one or more indicator panes
- **THEN** each main widget owns its own tooltip root
- **AND** content from one pane does not change the DOM content or coordinate origin of another pane

#### Scenario: DOM structure exposes stable hooks

- **WHEN** DOM mode is active
- **THEN** the root exposes the stable `.klinechart-tooltip` class
- **AND** namespaced `data-klinechart-tooltip-*` attributes identify tooltip kind, pane, block, and semantic roles

#### Scenario: DOM styles come from the public stylesheet

- **WHEN** a consumer enables DOM mode and globally imports `@dm/kchart/klinechart-tooltip.css`
- **THEN** the public stylesheet supplies the required structural tooltip styling
- **AND** the renderer does not inject a stylesheet or duplicate static layout rules through inline styles
- **AND** tooltip text is assigned through `textContent` rather than HTML parsing

#### Scenario: Canvas mode has no CSS requirement

- **WHEN** a consumer uses the default Canvas mode
- **THEN** the chart continues to work without importing the DOM tooltip stylesheet

### Requirement: Existing tooltip interaction is preserved

DOM tooltip controls SHALL preserve the existing tooltip icon hover and click behavior without blocking chart crosshair movement or gestures outside the controls.

#### Scenario: Icon hover updates active state

- **WHEN** the pointer enters or leaves a DOM tooltip icon
- **THEN** the owning pane's tooltip layer updates its hovered icon state
- **AND** only the affected DOM control needs to be patched

#### Scenario: Icon click dispatches the existing action

- **WHEN** a DOM tooltip icon is clicked
- **THEN** the chart dispatches `ActionType.OnTooltipIconClick` with the existing `TooltipIconClickEventData` payload
- **AND** the click does not start chart dragging or scrolling

#### Scenario: Pane hover state is isolated

- **WHEN** another pane hides or destroys its tooltip renderer
- **THEN** the current pane's hovered icon state remains unchanged
- **AND** no chart-wide tooltip interaction state is cleared

#### Scenario: Crosshair movement remains available

- **WHEN** the pointer moves across the chart or a non-control tooltip area
- **THEN** the existing chart event system continues to receive movement and update crosshair state

### Requirement: Renderer lifecycle is leak-free

The tooltip layer SHALL initialize only the renderer selected at chart creation, remove DOM listeners, and clean up DOM roots and Canvas hit targets when a pane or chart is destroyed.

#### Scenario: Destroy removes DOM resources

- **WHEN** a pane or chart is destroyed after DOM mode was active
- **THEN** its tooltip root and native event listeners are released
- **AND** no tooltip renderer retains a live chart or pane reference

### Requirement: DOM mode remains export-compatible

`Chart.getConvertPictureUrl(true)` SHALL include the last committed tooltip model when DOM mode is active, while `getConvertPictureUrl(false)` SHALL continue to omit overlay content.

#### Scenario: DOM tooltip is included in export

- **WHEN** DOM mode is active and `getConvertPictureUrl(true)` is called
- **THEN** the exported Canvas includes the last committed tooltip content
- **AND** the export path does not mutate live Canvas hit targets or DOM event state

#### Scenario: Export does not invoke formatters twice

- **WHEN** the last tooltip model has already been committed to screen
- **THEN** export consumes that model through a non-interactive Canvas renderer
- **AND** candle/indicator custom formatter callbacks are not invoked again solely because of export

### Requirement: Efficient DOM updates are measurable

The DOM renderer SHALL reuse nodes, avoid full subtree replacement, avoid synchronous layout reads in the crosshair hot path, and use the existing overlay scheduling rather than a second animation-frame loop.

#### Scenario: Stable content reuses the DOM tree

- **WHEN** successive tooltip updates have the same section and row shape
- **THEN** existing DOM nodes are reused
- **AND** unchanged text, attributes, and styles are not rewritten

#### Scenario: Benchmark captures end-to-end cost

- **WHEN** the approved browser benchmark runs with the fixed multi-pane fixture
- **THEN** it records model build time, renderer commit time, complete frame script/layout/paint cost, and post-warm-up node creation
- **AND** timing results are reported without making a browser-dependent percentage a release gate
