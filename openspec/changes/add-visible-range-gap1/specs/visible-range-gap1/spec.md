## ADDED Requirements

### Requirement: Independent Gap1 configuration
The chart SHALL expose `Options.gap1` as an optional `boolean | Gap1Options` setting that is disabled by default. `Gap1Options.maxGapCount` SHALL default to 15 and be normalized to an integer from 1 through 500. `Gap1Options.showValue` SHALL default to `false`. Passing an object SHALL enable Gap1 and merge it with the retained normalized configuration. Gap1 SHALL be enabled and disabled independently from `Options.gaps`, and SHALL reuse upward/downward appearance from `Styles.gap` without adding Gap1-specific styles.

#### Scenario: Enable Gap1
- **WHEN** a chart receives `setOptions({ gap1: true })`
- **THEN** Gap1 is calculated for the current visible range and rendered with `Styles.gap`

#### Scenario: Enable Gap1 with object options
- **WHEN** a chart receives `setOptions({ gap1: { maxGapCount: 20, showValue: true } })`
- **THEN** Gap1 is enabled with a maximum of 20 rendered gaps and value labels enabled

#### Scenario: Normalize maximum count
- **WHEN** `maxGapCount` is fractional or outside 1-500
- **THEN** it is rounded to an integer and clamped to the supported range

#### Scenario: Disable Gap1
- **WHEN** an enabled chart receives `setOptions({ gap1: false })`
- **THEN** Gap1 records are cleared and no Gap1 rectangles are rendered

#### Scenario: Enable both gap features
- **WHEN** `gaps` and `gap1` are both enabled
- **THEN** both features remain active and render independently

#### Scenario: Update shared appearance
- **WHEN** `Styles.gap` changes while Gap1 is enabled
- **THEN** existing Gap1 records are retained and redrawn with the updated appearance

#### Scenario: Update value visibility only
- **WHEN** only `showValue` changes while Gap1 is enabled
- **THEN** existing Gap1 records are retained and only label rendering changes

### Requirement: Visible-range full-gap detection
Gap1 SHALL detect full price gaps whose opening candle index is within the current visible range and whose original formation change is strictly greater than 0.02%. An upward gap SHALL require the opening candle low to exceed the preceding candle high and SHALL calculate its original increase as `(current.low - previous.high) / previous.high * 100`. A downward gap SHALL require the opening candle high to be below the preceding candle low and SHALL calculate its original decrease magnitude as `(previous.low - current.high) / previous.low * 100`. A formation change of exactly 0.02% SHALL be rejected. This threshold SHALL be evaluated only when the gap forms; later partial fills SHALL NOT remove an accepted gap merely because its remaining percentage becomes 0.02% or less. Gap1 SHALL NOT apply average-range deviation or trail-length filtering. After fill tracking, Gap1 SHALL sort retained gaps by opening timestamp descending and keep at most `maxGapCount`, so newer opening dates have priority.

#### Scenario: Detect upward and downward gaps
- **WHEN** visible adjacent candles form upward and downward full high/low gaps with original changes greater than 0.02%
- **THEN** Gap1 registers both gaps

#### Scenario: Reject the inclusive minimum boundary
- **WHEN** an upward or downward gap has an original formation change less than or equal to 0.02%
- **THEN** Gap1 does not create a record for that gap

#### Scenario: Retain a small partially filled remainder
- **WHEN** a gap forms with an original change greater than 0.02% and later visible candles shrink its remaining change to 0.02% or less without fully filling it
- **THEN** Gap1 retains the remaining region

#### Scenario: Keep the newest gaps under the count limit
- **WHEN** more unfilled gaps remain than `maxGapCount`
- **THEN** Gap1 keeps the gaps with the greatest opening timestamps

#### Scenario: Ignore open-close discontinuity
- **WHEN** adjacent candle high-low ranges overlap despite different close and open prices
- **THEN** Gap1 does not register a gap

#### Scenario: Read context before the first visible candle
- **WHEN** the first visible candle forms a full gap relative to the immediately preceding offscreen candle
- **THEN** Gap1 registers the gap because its opening candle is visible

#### Scenario: Exclude an opening candle left of the viewport
- **WHEN** a gap opened before the first visible candle and remains unfilled in the visible data
- **THEN** Gap1 does not register that gap

### Requirement: Viewport-relative fill tracking
Gap1 SHALL track partial fills only from each visible opening candle through the current visible range's exclusive right boundary. It SHALL retain only gaps with a positive remaining price range at that boundary. Later loaded candles outside the visible range SHALL NOT affect the current result.

#### Scenario: Shrink an upward gap
- **WHEN** an upward gap spans 100-110 and a later visible candle low becomes 106
- **THEN** the retained remaining Gap1 price range is 100-106

#### Scenario: Shrink a downward gap
- **WHEN** a downward gap spans 100-110 and a later visible candle high becomes 104
- **THEN** the retained remaining Gap1 price range is 104-110

#### Scenario: Remove a fully filled gap
- **WHEN** a visible candle reaches or crosses the opposite original gap boundary
- **THEN** the gap is absent from the Gap1 result

#### Scenario: Ignore a fill to the right of the viewport
- **WHEN** a gap opens in the visible range, remains unfilled at the visible right boundary, and is filled by later loaded offscreen data
- **THEN** Gap1 retains the gap for the current viewport

#### Scenario: Re-evaluate after panning right
- **WHEN** the viewport moves right so the previously offscreen filling candle enters the calculation horizon
- **THEN** Gap1 recalculates and removes the fully filled gap

### Requirement: Visible-range recalculation
The chart SHALL deterministically recalculate enabled Gap1 records whenever its effective visible range or candle data changes, including scrolling, zooming, resizing, alignment, data-zoom changes, initialization, append, update, prepend, replacement, and clear operations.

#### Scenario: Recalculate after zoom
- **WHEN** zooming changes the visible range
- **THEN** Gap1 results contain only gaps opened and still unfilled within the new range horizon

#### Scenario: Recalculate after pan
- **WHEN** scrolling changes the visible range
- **THEN** Gap1 results are recomputed for the new left and right boundaries

#### Scenario: Identical inputs are deterministic
- **WHEN** Gap1 is recalculated with identical candle data and visible range
- **THEN** it produces identical records

#### Scenario: Clear chart data
- **WHEN** candle data is cleared
- **THEN** all Gap1 records are cleared

### Requirement: Single current-state rectangle rendering
The chart SHALL render one non-interactive rectangle per retained Gap1 record on the candle pane's main canvas. Each rectangle SHALL start at the original gap formation boundary, extend to the current widget right edge, and use only the record's current remaining price range. Gap1 SHALL use the configured main price axis, shared bar pixel alignment, and `Styles.gap`, and SHALL render after existing Gap rectangles but before candles. When `showValue` is enabled, it SHALL render a left-aligned label following the gap direction. Upward labels SHALL use `lower-upper +percentage%(+width)`, with percentage equal to `width / lower * 100`. Downward labels SHALL use `upper-lower -percentage%(-width)`, with the signed change equal to `(lower - upper) / upper * 100`. Price values and signed width SHALL use chart price precision, while percentage SHALL use three decimal places. The price range SHALL use the current `Styles.xAxis.tickText.color`; only the percentage and parenthesized width SHALL use the direction's `Styles.gap.*.borderColor`. Upward labels SHALL appear below their rectangle and downward labels above it.

#### Scenario: Render a partially filled gap
- **WHEN** a retained Gap1 has been partially filled
- **THEN** one rectangle spans from its original formation boundary to the widget right edge using only its remaining vertical price range

#### Scenario: Do not render historical segments
- **WHEN** a Gap1 has undergone multiple partial fills
- **THEN** it still renders exactly one rectangle rather than one rectangle per historical fill interval

#### Scenario: Render on the main price axis
- **WHEN** the right Y axis is configured as the main price axis
- **THEN** Gap1 converts its remaining price bounds with the right main axis

#### Scenario: Clip an invisible rectangle
- **WHEN** a Gap1 rectangle is fully outside the widget's horizontal or vertical bounds
- **THEN** that rectangle is skipped

#### Scenario: Hide value labels by default
- **WHEN** `showValue` is omitted or false
- **THEN** Gap1 renders rectangles without value text

#### Scenario: Render an upward value label
- **WHEN** an upward gap has lower 105.955, upper 106.005, price precision 3, and `showValue` enabled
- **THEN** the label below the rectangle reads `105.955-106.005 +0.047%(+0.050)`, with only `+0.047%(+0.050)` using the upward border color

#### Scenario: Render a downward value label
- **WHEN** a downward gap has upper 109.450, lower 109.410, price precision 3, and `showValue` enabled
- **THEN** the label above the rectangle reads `109.450-109.410 -0.037%(-0.040)`, with only `-0.037%(-0.040)` using the downward border color

#### Scenario: Follow the X-axis text color
- **WHEN** the active theme or a style update changes `Styles.xAxis.tickText.color`
- **THEN** the Gap1 price-range text is redrawn with that color while the percentage and width retain the direction border color

### Requirement: Gap1 system isolation
Gap1 SHALL remain separate from indicator results, crosshair indicator data, tooltips, Y-axis range calculation, user overlays, persistence, selection, removal, and lifecycle logging. An empty Gap1 result SHALL be silent.

#### Scenario: Preserve indicator and overlay contracts
- **WHEN** Gap1 is enabled and produces records
- **THEN** indicator, tooltip, crosshair, axis-range, and overlay APIs contain no Gap1 data

#### Scenario: Emit no lifecycle logs
- **WHEN** viewport or data changes add, shrink, or remove Gap1 records
- **THEN** no `New Gap Appeared` or `Gap Closed` log is emitted for Gap1

#### Scenario: No Gap1 found
- **WHEN** the visible range contains no qualifying unfilled gap
- **THEN** no rectangle, message, warning, or log is produced
