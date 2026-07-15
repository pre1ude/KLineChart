## 1. Overlay Control-Point Model

- [x] 1.1 Add custom control-point descriptors, callback types, stable key propagation, and backward-compatible default descriptor generation to the overlay model
- [x] 1.2 Add the per-overlay `auto`/`always` control-point visibility policy and redraw change detection

## 2. Rendering and Interaction

- [x] 2.1 Update OverlayView to render and hit-test default or overlay-defined control-point descriptors using the shared control-point styles
- [x] 2.2 Update OverlayLayer drag dispatch to pass the active control-point key to overlay update logic

## 3. Built-in Rectangle

- [x] 3.1 Define four stable derived rectangle corner handles and map each handle drag back to the two stored anchors

## 4. Verification

- [x] 4.1 Add focused unit tests for default descriptor compatibility, persistent visibility update detection, stable drag key propagation, and all rectangle corner mappings
- [x] 4.2 Run focused overlay tests, the full unit test suite, type checking, and linting as supported by the project

## 5. Hover Redraw Performance

- [x] 5.1 Propagate the event-binding flag through default control-point drawing and skip transparent hit figures and event nodes on visual-only redraws
- [x] 5.2 Add a regression test proving visual-only control-point redraws render visuals without registering event children
- [x] 5.3 Run focused and full verification and validate the updated OpenSpec change

## 6. Selected Overlay Interaction Priority

- [x] 6.1 Draw the selected main-view overlay once after normal and hover-only overlays with event binding enabled
- [x] 6.2 Add focused regression tests for selected ordering, hover/selection coexistence, and deselection
- [x] 6.3 Run focused and full verification and validate the updated OpenSpec change
