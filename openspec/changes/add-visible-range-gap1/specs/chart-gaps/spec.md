## MODIFIED Requirements

### Requirement: Gap feature configuration
The chart SHALL expose optional `gaps?: GapOptions` behavior configuration and an independent `gapShow?: boolean` visibility switch through initialization options and `chart.setOptions()`. Gap SHALL be hidden by default. Updating `gaps` SHALL merge and retain partial closing, maximum retained count, minimum deviation percentage, and optional maximum trail length without changing visibility. Setting `gapShow: true` SHALL calculate and render Gap using the retained configuration. Setting `gapShow: false` SHALL clear calculated records without discarding configuration. The legacy boolean form `gaps: true/false` SHALL NOT be accepted. Upward and downward appearance SHALL remain configured through `Styles.gap`, either within `Options.styles` or through `chart.setStyles()`.

#### Scenario: Configure while hidden
- **WHEN** a hidden chart receives `setOptions({ gaps: { maxGapCount: 20 } })`
- **THEN** the normalized maximum count is retained and no Gap records are calculated or rendered

#### Scenario: Show with defaults or retained configuration
- **WHEN** a chart receives `setOptions({ gapShow: true })`
- **THEN** gap detection and rendering are enabled using the currently retained behavior configuration

#### Scenario: Hide while retaining configuration
- **WHEN** a visible chart receives `setOptions({ gapShow: false })`
- **THEN** calculated gap regions are cleared and no gaps are rendered while the normalized behavior configuration is retained

#### Scenario: Partially update configuration while visible
- **WHEN** a visible chart receives a `gaps` object containing only a subset of behavior settings
- **THEN** those fields are merged with the current configuration and detection-affecting changes trigger a silent recalculation without changing visibility

#### Scenario: Update configuration and visibility together
- **WHEN** one `setOptions` call contains both `gaps` and `gapShow: true`
- **THEN** the configuration is merged before Gap is enabled so records are calculated exactly once with the latest values

#### Scenario: Partially update appearance
- **WHEN** a chart receives `styles.gap` containing only a subset of upward or downward style fields
- **THEN** those fields are deep-merged with the global chart styles without changing calculated gap records

#### Scenario: Normalize numeric configuration
- **WHEN** gap settings contain out-of-range numeric values
- **THEN** maximum gap count is constrained to 1-500, minimum deviation percentage is constrained to 1-100, and maximum trail length is normalized to a positive integer
