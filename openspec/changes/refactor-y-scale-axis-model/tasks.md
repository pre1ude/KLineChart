## 1. Scale and Axis Model

- [x] 1.1 Add public Y-scale types and a pane-owned Y-scale host/component registry
- [x] 1.2 Redefine Y-axis options and widgets as visual references to `yScaleId`
- [x] 1.3 Seed each drawable pane with stable `default` scale/axis resources and remove left/right compatibility identities

## 2. Public API and Binding

- [x] 2.1 Add create/query/override/remove Y-scale APIs with dependency protection
- [x] 2.2 Update Y-axis lifecycle APIs to require an existing scale and manage visual axes independently
- [x] 2.3 Replace indicator `yAxisId`/`yAxisPosition` with stable creation-time `yScaleId` binding
- [x] 2.4 Replace conversion finder axis fields with `yScaleId`

## 3. Rendering, Layout, and Interaction

- [x] 3.1 Calculate automatic range and ticks once per scale and bind candle/default data explicitly
- [x] 3.2 Route indicator drawing, labels, tooltips, grids, candle views, and overlays through scales
- [x] 3.3 Lay out every visible visual axis by its own position while reusing its referenced scale size/ticks
- [x] 3.4 Make drag, wheel zoom, reset, and main-area pan mutate unique scales without synchronization fan-out
- [x] 3.5 Remove global Y-axis position/main-position style behavior

## 4. Migration and Verification

- [x] 4.1 Update exports, built-in callbacks, the multi-asset demo, and affected documentation to the breaking API
- [x] 4.2 Add focused tests for shared-scale axes, independent scales, stable default binding, validation, and interaction
- [x] 4.3 Run focused tests and type checking, then lint and build; fix all regressions

## 5. Architecture Cleanup

- [x] 5.1 Rename the scale implementation, extension namespace, helpers, tests, and public transform enum to consistent Y-scale terminology
- [x] 5.2 Enforce default, axis, and indicator dependency protection inside the pane-owned scale removal operation
- [x] 5.3 Run stale-name scans, focused and full tests, type checking, lint, browser tests, build, and strict OpenSpec validation

## 6. Axis Label Projection

- [x] 6.1 Restrict `YScaleType` to coordinate transforms and add public per-axis `YAxisLabelDisplay` options
- [x] 6.2 Project shared scale ticks and value labels per visual axis while preserving one range and interaction state
- [x] 6.3 Update migration documentation and examples for shared price/percentage axes
- [x] 6.4 Add focused coverage and run type checking, tests, lint, build, and strict OpenSpec validation
