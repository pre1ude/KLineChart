## ADDED Requirements

### Requirement: Built-in MIKE registration
The system SHALL register an indicator template named `MIKE` as a built-in price-series indicator, with short name `MIKE`, default calculation parameters `[12]`, OHLC range participation enabled, and line figures keyed `wr`, `mr`, `sr`, `ws`, `ms`, and `ss`.

#### Scenario: Discover and create MIKE
- **WHEN** a consumer queries the supported indicators or creates an indicator named `MIKE`
- **THEN** the system includes and resolves the built-in MIKE template without requiring consumer registration

#### Scenario: Use price-series behavior
- **WHEN** the chart creates MIKE in either the candle pane or an indicator pane
- **THEN** MIKE uses chart price precision and includes OHLC values when determining an indicator pane's visible range

### Requirement: Standard MIKE calculation
For each input bar with a complete calculation window, the system SHALL calculate `TYP = (HIGH + LOW + CLOSE) / 3`, `HHV` as the highest `HIGH` in the window, and `LLV` as the lowest `LOW` in the window. The window SHALL include the current bar and the configured number of bars.

The system SHALL calculate the six outputs as follows:

`WR = TYP + (TYP - LLV)`

`MR = TYP + (HHV - LLV)`

`SR = 2 * HHV - LLV`

`WS = TYP - (HHV - TYP)`

`MS = TYP - (HHV - LLV)`

`SS = 2 * LLV - HHV`

#### Scenario: Calculate all six lines
- **WHEN** a complete calculation window is available
- **THEN** the result at that input index contains `wr`, `mr`, `sr`, `ws`, `ms`, and `ss` calculated from the specified formulas

#### Scenario: Slide the rolling window
- **WHEN** a new input bar arrives after the first complete window
- **THEN** `HHV` and `LLV` exclude bars that have left the configured fixed-size window

#### Scenario: Calculate flat-price data
- **WHEN** all OHLC prices in a complete window are the same finite value
- **THEN** all six MIKE outputs equal that value and none is `NaN` or infinite

### Requirement: MIKE period and result alignment
The system SHALL interpret the first calculation parameter as a positive integer rolling period, SHALL default it to `12`, and SHALL return one result entry for every input K-line bar.

#### Scenario: Warm up a default-period calculation
- **WHEN** fewer than 12 input bars are available
- **THEN** each corresponding result entry omits all six MIKE output values

#### Scenario: Emit the first complete result
- **WHEN** the configured number of input bars becomes available
- **THEN** the result at that input index emits all six MIKE output values

#### Scenario: Override the period
- **WHEN** a consumer supplies a positive integer first calculation parameter instead of `12`
- **THEN** the system uses that value as the complete-window period without changing the formulas or figure keys

#### Scenario: Preserve input alignment
- **WHEN** MIKE calculates an empty, partial-window, or complete-window input sequence
- **THEN** the result length equals the input length

### Requirement: Distinct default MIKE line presentation
The system SHALL render the six MIKE figures as lines using the first six entries of the shared default indicator line palette and SHALL NOT require a MIKE template-level figure color override.

#### Scenario: Resolve default line colors
- **WHEN** MIKE uses the default indicator styles
- **THEN** `wr`, `mr`, `sr`, `ws`, `ms`, and `ss` resolve to six different line colors

#### Scenario: Override shared line styles
- **WHEN** a consumer customizes the shared indicator line styles
- **THEN** MIKE resolves each figure color from those shared styles without a template-level color taking precedence
