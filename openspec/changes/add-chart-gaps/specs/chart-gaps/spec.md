## ADDED Requirements

### Requirement: Gap feature configuration
The chart SHALL expose an optional `gaps` setting through initialization options and `chart.setOptions()`. The feature SHALL be disabled by default. The behavior configuration SHALL include partial closing, maximum retained gap count, minimum deviation percentage, and optional maximum trail length. Upward and downward appearance SHALL be configured through `Styles.gap`, either within `Options.styles` or through `chart.setStyles()`.

#### Scenario: Enable with defaults
- **WHEN** a chart is configured with `gaps: true`
- **THEN** gap detection and rendering are enabled with partial closing disabled, a maximum of 15 retained gaps, a 30% minimum deviation, trail limiting disabled, and a stored trail length of 300 bars

#### Scenario: Disable gaps
- **WHEN** a chart with gaps enabled receives `setOptions({ gaps: false })`
- **THEN** calculated gap regions are cleared and no gaps are rendered while the last normalized configuration is retained

#### Scenario: Partially update configuration
- **WHEN** a chart receives a `gaps` object containing only a subset of behavior settings
- **THEN** those fields are merged with the current gap behavior configuration and the feature is enabled

#### Scenario: Partially update appearance
- **WHEN** a chart receives `styles.gap` containing only a subset of upward or downward style fields
- **THEN** those fields are deep-merged with the global chart styles without changing calculated gap records

#### Scenario: Normalize numeric configuration
- **WHEN** gap settings contain out-of-range numeric values
- **THEN** maximum gap count is constrained to 1-500, minimum deviation percentage is constrained to 1-100, and maximum trail length is normalized to a positive integer

### Requirement: Full candlestick gap detection
The system SHALL detect only full price gaps between adjacent candles using their high and low values. An upward gap SHALL require the current low to be greater than the previous high. A downward gap SHALL require the current high to be less than the previous low.

#### Scenario: Detect upward gap
- **WHEN** the previous candle high is 100 and the current candle low is 103
- **THEN** an upward gap with price bounds 100-103 is created

#### Scenario: Detect downward gap
- **WHEN** the previous candle low is 100 and the current candle high is 97
- **THEN** a downward gap with price bounds 97-100 is created

#### Scenario: Ignore open-close discontinuity without full gap
- **WHEN** the current open differs from the previous close but the two candles' high-low ranges overlap
- **THEN** no gap is created

### Requirement: Minimum deviation filter
The system SHALL require gap width to be at least the configured percentage of the 14-bar simple average of `high - low` at the current bar. The current bar SHALL be included in the 14-bar average. Before 14 bars are available, the effective minimum width SHALL be zero to match the reference behavior.

#### Scenario: Gap exactly meets threshold
- **WHEN** the 14-bar average range is 10, minimum deviation is 30%, and the full gap width is 3
- **THEN** the gap is created

#### Scenario: Gap is below threshold
- **WHEN** the 14-bar average range is 10, minimum deviation is 30%, and the full gap width is less than 3
- **THEN** no gap is created

#### Scenario: Warm-up bars
- **WHEN** fewer than 14 bars are available and two adjacent bars form a positive-width full gap
- **THEN** the gap is not rejected by the minimum deviation filter

### Requirement: Gap region rendering
The system SHALL render detected gaps as non-interactive rectangular regions on the candle pane's main canvas using `Styles.gap`. Gap regions SHALL be drawn above the grid and below candles, indicators, user overlays, crosshairs, and tooltips. Gaps SHALL use the configured main price axis and SHALL NOT alter Y-axis range calculation.

#### Scenario: Render active upward gap
- **WHEN** an upward gap remains active in the current data
- **THEN** its red-bordered, red-filled region starts at the previous candle index and extends to the right edge of the visible candle widget

#### Scenario: Render active downward gap
- **WHEN** a downward gap remains active in the current data
- **THEN** its green-bordered, green-filled region starts at the previous candle index and extends to the right edge of the visible candle widget

#### Scenario: Render on configured main axis
- **WHEN** the right Y axis is configured as the candle pane's main price axis
- **THEN** gap price bounds are converted with the right main axis

#### Scenario: Clip invisible region
- **WHEN** a gap segment is fully outside the visible horizontal or vertical widget bounds
- **THEN** that segment is skipped during drawing

#### Scenario: Preserve a very thin gap border
- **WHEN** a visible gap converts to a positive rectangle height that is no greater than twice its border width
- **THEN** the configured fill and border are both drawn instead of dropping the border

#### Scenario: Align consecutive segment borders
- **WHEN** consecutive partial-close segments of one gap share a data index and use an odd-width border
- **THEN** their shared vertical borders occupy the same pixel line instead of adjacent pixel lines

#### Scenario: Align vertical borders with candle wicks
- **WHEN** a one-pixel gap border is anchored to a candle data index whose converted X coordinate is fractional after scrolling or zooming
- **THEN** the vertical border occupies the same pixel column as that candle's wick

### Requirement: Touch-close behavior
When partial closing is disabled, the system SHALL stop tracking the entire gap when a later candle first enters the gap region. Merely equaling the outer boundary without covering positive gap width SHALL NOT close the gap.

#### Scenario: Close upward gap on entry
- **WHEN** an upward gap spans 100-110 and a later candle low becomes 109
- **THEN** the gap closes at that candle with close reason `entered` and its full region stops extending there

#### Scenario: Do not close upward gap at outer boundary
- **WHEN** an upward gap spans 100-110 and a later candle low equals 110
- **THEN** the gap remains active

#### Scenario: Close downward gap on entry
- **WHEN** a downward gap spans 100-110 and a later candle high becomes 101
- **THEN** the gap closes at that candle with close reason `entered`

### Requirement: Partial-close behavior
When partial closing is enabled, the system SHALL end the current segment when price advances into the unfilled region and SHALL continue tracking only the remaining unfilled price range. Historical segments SHALL remain rendered. The gap SHALL close only when price reaches the opposite original boundary.

#### Scenario: Partially fill upward gap
- **WHEN** an upward gap spans 100-110 and a later candle low becomes 106
- **THEN** the 100-110 segment ends at that candle and a new 100-106 segment starts there and continues right

#### Scenario: Ignore non-advancing partial fill
- **WHEN** the remaining upward gap spans 100-106 and a later candle low is 108
- **THEN** no new segment is created and the remaining gap stays 100-106

#### Scenario: Completely fill upward gap
- **WHEN** the remaining upward gap has original lower boundary 100 and a later candle low reaches 100 or lower
- **THEN** the current segment ends, no zero-height successor is created, and the gap closes with close reason `filled`

#### Scenario: Partially and completely fill downward gap
- **WHEN** a downward gap is entered by successively higher candle highs and later reaches its original upper boundary
- **THEN** each advancing boundary creates a smaller remaining segment and the final boundary reach closes the gap with reason `filled`

### Requirement: Retained gap count
The system SHALL retain at most the configured number of most recently created gap records. Count limiting SHALL apply to detected gaps rather than individual partial-fill segments.

#### Scenario: Evict oldest gap
- **WHEN** the retained count is 2 and gaps A, B, and C are created in that order
- **THEN** gap A and all its segments are removed while B and C remain

#### Scenario: Evict active gap
- **WHEN** the oldest gap exceeds the configured count while still active
- **THEN** it is removed from both retained and active tracking without emitting `Gap Closed`

### Requirement: Maximum trail length
When trail limiting is enabled, the system SHALL stop a still-active gap after `currentIndex - openIndex` reaches the configured maximum trail length. Truncation SHALL stop visual tracking but SHALL NOT represent financial gap closure.

#### Scenario: Truncate at configured length
- **WHEN** a gap opens at index 10 with maximum trail length 3 and remains unfilled through index 13
- **THEN** its final segment ends at index 13 and the gap status becomes `truncated`

#### Scenario: Partial fill does not reset length
- **WHEN** an active gap is partially filled before reaching the trail limit
- **THEN** trail length continues to be measured from the original gap opening index

#### Scenario: Fill wins over truncation
- **WHEN** a gap reaches its price-closing condition on the same candle that reaches the trail limit
- **THEN** it closes as `entered` or `filled` rather than becoming `truncated`

### Requirement: Deterministic data updates
The system SHALL recalculate gap records from current candle data for initialization, prepend, append, latest-bar update, historical update, replacement, option changes, and clear operations. Identical data and normalized options SHALL produce identical records and segments.

#### Scenario: Latest candle invalidates new gap
- **WHEN** a latest candle initially forms a gap and a subsequent update changes its high-low range so the full-gap condition no longer holds
- **THEN** the gap disappears from the calculated and rendered results

#### Scenario: Prepend historical candles
- **WHEN** historical candles are prepended
- **THEN** all gap indices and lifecycle results are recalculated from the combined data without replaying historical logs

#### Scenario: Clear chart data
- **WHEN** chart data is cleared
- **THEN** all calculated gap records and log de-duplication state are cleared

#### Scenario: Change detection options
- **WHEN** a detection-affecting gap option changes
- **THEN** gaps are recalculated silently using the new normalized options

#### Scenario: Change only styles
- **WHEN** only upward or downward fields under `Styles.gap` change
- **THEN** existing gap records are retained and the chart redraws with the new styles

### Requirement: Development gap logs
The system SHALL emit structured development-only informational logs named `New Gap Appeared` and `Gap Closed` for new lifecycle events caused by appended data or latest-bar updates. The system SHALL de-duplicate repeated recalculations of the same event.

#### Scenario: Initial load remains silent
- **WHEN** gaps are calculated during initial data load or initial feature enablement
- **THEN** no historical lifecycle logs are emitted

#### Scenario: Log new gap
- **WHEN** appended or latest-bar data creates a new valid gap that has not previously been logged
- **THEN** one `New Gap Appeared` log is emitted with gap identity, direction, timestamp, price bounds, and size

#### Scenario: Log touch-close
- **WHEN** touch-close mode closes an active gap because price enters it
- **THEN** one `Gap Closed` log is emitted with close reason `entered`

#### Scenario: Log complete partial fill
- **WHEN** partial-close mode fully fills the remaining gap
- **THEN** one `Gap Closed` log is emitted with close reason `filled`

#### Scenario: Do not log partial progress
- **WHEN** partial-close mode only reduces the remaining gap
- **THEN** no `Gap Closed` log is emitted

#### Scenario: Do not log non-price removal
- **WHEN** a gap is truncated, evicted by count, removed by disabling the feature, or recalculated by historical or option changes
- **THEN** no `Gap Closed` log is emitted

### Requirement: Isolation from indicator and overlay systems
The gap feature SHALL remain separate from indicator values and user overlay objects. An empty gap result SHALL be treated as normal and SHALL produce no chart message or warning.

#### Scenario: Crosshair data remains unchanged
- **WHEN** gaps are enabled and the crosshair changes
- **THEN** gap records do not appear in indicator crosshair data or indicator tooltips

#### Scenario: Overlay persistence remains unchanged
- **WHEN** user overlays are exported, queried, selected, or removed
- **THEN** calculated gap regions are not included or affected

#### Scenario: No gaps found
- **WHEN** no candle pair passes full-gap detection and filtering
- **THEN** no gap rectangles, empty-state text, warning, or lifecycle log are produced
