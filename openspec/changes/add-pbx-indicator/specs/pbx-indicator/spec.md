## ADDED Requirements

### Requirement: Built-in PBX registration and configuration
The system SHALL register an indicator template named `PBX` as a built-in price-series indicator, with short name `PBX`, default calculation parameters `[4, 6, 9, 13, 18, 24]`, `shouldOhlc: true`, and one line figure for each configured period.

#### Scenario: Discover and create PBX
- **WHEN** a consumer queries the supported indicators or creates an indicator named `PBX`
- **THEN** the system includes and resolves the built-in PBX template without requiring consumer registration

#### Scenario: Generate figures from configured periods
- **WHEN** PBX is created with the default periods or overridden with a list of positive integer periods
- **THEN** it exposes the same number of line figures, with stable keys `pbx1`, `pbx2`, and so on, and position-based titles `PBX1: `, `PBX2: `, and so on

#### Scenario: Present the conventional six-line names and periods
- **WHEN** PBX uses the default configuration
- **THEN** the indicator identifies its periods as `(4,6,9,13,18,24)` through the existing calculation-parameter presentation and identifies its figures as `PBX1` through `PBX6`

### Requirement: Standard PBX line calculation
For each configured positive integer period `M`, the system SHALL calculate the corresponding PBX line as `(EMA(CLOSE, M) + MA(CLOSE, 2*M) + MA(CLOSE, 4*M)) / 3`.

The EMA term SHALL use the domestic formula-language convention: the first close seeds EMA at the first input bar, and every later value is `(2 * CLOSE + (M - 1) * previousEMA) / (M + 1)`. Each MA term SHALL be the simple average of its complete close window.

#### Scenario: Seed EMA from the first close
- **WHEN** calculation begins for a non-empty input sequence
- **THEN** the EMA component for every configured period equals the first close at index `0` and recursively incorporates every subsequent close before PBX becomes emit-ready

#### Scenario: Calculate a PBX line after its required history exists
- **WHEN** a bar has at least `4*M` closes including the current close
- **THEN** the result for that period equals the average of the EMA(`M`), MA(`2*M`), and MA(`4*M`) values at that bar

#### Scenario: Calculate multiple configured lines independently
- **WHEN** PBX has multiple configured periods
- **THEN** each line uses its own period and does not reuse a value from another period's EMA or moving-average windows

#### Scenario: Keep rolling calculations finite for flat prices
- **WHEN** every close in the input sequence is the same finite number
- **THEN** every emitted PBX line equals that close and contains no `NaN` or infinite value

### Requirement: PBX warm-up and result alignment
The system SHALL return one result entry for every input K-line bar. For a period `M`, its `pbxN` value SHALL be omitted before index `4*M - 1` and SHALL be emitted at that index and thereafter. Warm-up for one line SHALL NOT suppress another line whose shorter period is already complete.

#### Scenario: Preserve input alignment
- **WHEN** the indicator calculates an empty, short, or multi-bar input sequence
- **THEN** the result length equals the input length and each result entry corresponds to the input bar at the same index

#### Scenario: Omit each line until a complete 4M window
- **WHEN** fewer than `4*M` closes are available for a configured period
- **THEN** that period's figure key is absent from every corresponding result entry

#### Scenario: Emit lines at independent boundaries
- **WHEN** a shorter configured period reaches index `4*M - 1` while a longer period is still warming up
- **THEN** the shorter line is present and the longer line remains absent until its own boundary

### Requirement: PBX parameter overrides and presentation
The system SHALL accept an overridden list of positive integer calculation periods without changing the PBX formula or result alignment contract. All configured PBX figures SHALL be price-series line figures, and their default presentation SHALL provide distinct colors for the six conventional default periods.

#### Scenario: Override periods
- **WHEN** a consumer supplies a positive integer period list instead of `[4, 6, 9, 13, 18, 24]`
- **THEN** the system calculates exactly one corresponding PBX line per supplied period while retaining position-based `PBX1`, `PBX2`, and subsequent line names

#### Scenario: Distinguish the six default lines through shared styles
- **WHEN** PBX is created with its six default periods
- **THEN** the resolved default figure colors for `pbx1` through `pbx6` use the six shared indicator line styles and are pairwise distinct while consumers can still override those styles through the existing indicator API
