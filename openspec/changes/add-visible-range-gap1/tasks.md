## 1. Public Option and Gap1 Model

- [x] 1.1 Add the disabled-by-default `Options.gap1?: boolean | Gap1Options` public option without changing `Options.gaps`.
- [x] 1.2 Add internal Gap1 direction/record types and a pure visible-range calculator contract.

## 2. Visible-Range Calculation

- [x] 2.1 Add tests for upward/downward full-gap detection, open-close overlap rejection, no deviation filtering, and first-visible-candle context lookup.
- [x] 2.2 Implement visible-opening detection while excluding gaps whose opening candle is left of the viewport.
- [x] 2.3 Add tests for upward/downward partial shrink, full fill removal, multiple fills producing one current range, and deterministic output.
- [x] 2.4 Implement remaining-region tracking through the exclusive visible right boundary.
- [x] 2.5 Add tests proving later offscreen fills are ignored until panning moves them into the calculation horizon.

## 3. Store and Viewport Integration

- [x] 3.1 Add Gap1Store enable/disable, current records, recalculation, and clear behavior with focused tests.
- [x] 3.2 Integrate Gap1Store into ChartStore options, getters, clear, and visible-data adjustment so every effective viewport/data change recalculates Gap1.
- [x] 3.3 Add ChartStore/TimeScaleStore tests for initial enablement, pan/zoom range changes, data changes, independent Gap coexistence, and style-only update stability.

## 4. Single-Rectangle Rendering

- [x] 4.1 Add Gap1View tests for one rectangle per active gap, original formation left boundary, widget-right extension, current remaining price range, clipping, direction batching, shared styles, pixel alignment, and main-axis use.
- [x] 4.2 Implement Gap1View with the existing rectangle primitive and shared `Styles.gap` appearance.
- [x] 4.3 Extend GapLayer to draw GapView followed by Gap1View and verify both remain above the grid and below candles.

## 5. Isolation and Verification

- [x] 5.1 Add regression tests confirming Gap1 produces no lifecycle logs and does not enter indicator, tooltip, crosshair, axis-range, or overlay contracts.
- [x] 5.2 Run focused Gap1 calculator/store/view/layer/integration tests and resolve all failures.
- [x] 5.3 Run the full unit suite, TypeScript type check, ESLint, build, diff check, and final OpenSpec validation.

## 6. Interactive Demo

- [x] 6.1 Add independent Gap and Gap1 switches, simultaneous enablement, visible-range status, and viewport-recalculation guidance to the AAPL daily demo.
- [x] 6.2 Update the test index metadata to advertise both gap modes.
- [x] 6.3 Verify the demo source, full tests, type check, ESLint, build, diff check, and final OpenSpec validation.
- [ ] 6.4 Verify Gap/Gap1 switches and viewport status updates in a local browser when the environment permits starting the Vite server.

## 7. Gap1 Count and Value Options

- [x] 7.1 Update the public option/spec contract and add focused tests for defaulting, merging, normalization, and newest-opening count retention.
- [x] 7.2 Implement Gap1 option state and precision-aware two-color value labels, with store and view tests proving `showValue` does not recalculate records.
- [x] 7.3 Put Gap1 demo settings on a separate toolbar row and add maximum-count/value controls plus updated guidance and status output.
- [x] 7.4 Run focused tests, the full unit suite, type check, ESLint, build, diff check, and final OpenSpec validation.

## 8. Direction-Signed Gap1 Values

- [x] 8.1 Add a view regression test proving upward gaps show positive changes while downward gaps reverse the range and show negative percentage/width values.
- [x] 8.2 Implement direction-aware Gap1 label formatting and run focused/full verification plus final OpenSpec validation.

## 9. Theme-Aware Gap1 Price Text

- [x] 9.1 Add a view regression test proving Gap1 price-range text uses the current X-axis tick text color while change text retains the direction border color.
- [x] 9.2 Replace the fixed Gap1 price color with `Styles.xAxis.tickText.color` and run focused/full verification plus final OpenSpec validation.

## 10. Gap1 Original-Change Threshold

- [x] 10.1 Add calculator regression tests for upward/downward rejection at or below 0.02%, acceptance above 0.02%, and retention after the remaining region shrinks below the threshold.
- [x] 10.2 Implement the fixed original-formation threshold before Gap1 record creation and run focused/full verification plus final OpenSpec validation.

## 11. Fill-Only Border Semantics

- [x] 11.1 Add style/view regression coverage for mandatory direction border colors and visible Gap1 statistics when `borderSize` is `0`.
- [x] 11.2 Make `GapDirectionStyle.borderColor` required and update the fill-only demo preset to use `borderSize: 0`; run focused/full verification and final OpenSpec validation.
