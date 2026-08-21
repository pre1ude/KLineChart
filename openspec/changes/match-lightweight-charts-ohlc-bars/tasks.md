## 1. Focused Rendering Tests

- [x] 1.1 Add failing tests for fixed one-pixel stroke thickness and Lightweight Charts tick-length thresholds at bar spacings 8, 10, and 17.
- [x] 1.2 Add failing tests for one-pixel entity degradation, three-pixel entity overflow, flat bars, extreme-price tick clamping, and shared indicator-pane geometry.

## 2. OHLC Geometry Implementation

- [x] 2.1 Replace zoom-dependent OHLC stroke sizing with one-pixel center and tick thickness.
- [x] 2.2 Implement stepped tick-length calculation from `barSpace.bar`, adjacent non-overlapping rectangles, narrow-entity suppression, and flat/extreme price bounds.

## 3. Verification

- [x] 3.1 Run the focused `CandleBarView` unit tests and fix any failures.
- [x] 3.2 Run the relevant broader test or type-check command and record the result.

## 4. Interactive Demo

- [x] 4.1 Add a focused OHLC demo with controls for the narrow-entity cases and Lightweight Charts tick-length thresholds.
- [x] 4.2 Register the demo in the test-case index and verify it loads with the development build.
