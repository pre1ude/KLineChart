## ADDED Requirements

### Requirement: Built-in ASI registration
The system SHALL register an indicator template named `ASI` as a built-in indicator, with short name `ASI`, default calculation parameters `[26, 10]`, and line figures keyed `asi` and `asit`.

#### Scenario: Discover and create ASI
- **WHEN** a consumer queries the supported indicators or creates an indicator named `ASI`
- **THEN** the system includes and resolves the built-in ASI template without requiring consumer registration

### Requirement: Chinese-market Swing Index calculation
For every input bar after the first bar, the system SHALL calculate Swing Index using the commonly used Chinese-market formula below, where `H`, `L`, `O`, and `C` refer to the current bar and `PH`, `PL`, `PO`, and `PC` refer to the previous bar:

`A = ABS(H - PC)`

`B = ABS(L - PC)`

`C1 = ABS(H - PL)`

`D = ABS(PC - PO)`

`X = (C - PC) + (C - O) / 2 + (PC - PO)`

`K = MAX(A, B)`

`R = A + B / 2 + D / 4` when `A > B` and `A > C1`; otherwise `R = B + A / 2 + D / 4` when `B > A` and `B > C1`; otherwise `R = C1 + D / 4`.

`SI = 16 * X / R * K` when `R` is non-zero, and `SI = 0` when `R` is zero.

#### Scenario: Calculate one Swing Index value
- **WHEN** the current and previous OHLC bars produce a non-zero `R`
- **THEN** the system calculates `SI` from the specified `A`, `B`, `C1`, `D`, `X`, `K`, and conditional `R` formulas using the factor `16`

#### Scenario: Handle a zero denominator
- **WHEN** the current and previous OHLC bars produce `R = 0`
- **THEN** the system treats that bar's `SI` as zero and does not produce `NaN` or an infinite result

### Requirement: ASI and ASIT rolling outputs
The system SHALL interpret the first calculation parameter as the ASI period and the second calculation parameter as the ASIT period. `ASI` SHALL be the rolling sum of the most recent ASI-period `SI` values, and `ASIT` SHALL be the simple moving average of the most recent ASIT-period emitted `ASI` values.

#### Scenario: ASI warm-up
- **WHEN** fewer than the configured ASI-period calculable `SI` values are available
- **THEN** the corresponding result omits both `asi` and `asit`

#### Scenario: Emit the first ASI value
- **WHEN** the configured ASI-period number of calculable `SI` values becomes available
- **THEN** the result emits `asi` as the sum of exactly those `SI` values and continues with a fixed-size rolling window

#### Scenario: ASIT warm-up and output
- **WHEN** fewer than the configured ASIT-period emitted `ASI` values are available
- **THEN** the result omits `asit`, and once enough values are available it emits `asit` as their simple moving average using a fixed-size rolling window

#### Scenario: Override periods
- **WHEN** a consumer supplies two positive integer calculation parameters instead of `[26, 10]`
- **THEN** the system uses the supplied values as the ASI rolling-sum period and ASIT moving-average period without changing the formula or figure keys

### Requirement: Result alignment
The system SHALL return one result entry for every input K-line bar and SHALL not calculate `SI` for the first input bar because no previous OHLC bar exists.

#### Scenario: Preserve input alignment
- **WHEN** the indicator calculates any input sequence, including an empty or single-bar sequence
- **THEN** the result length equals the input length and the first result entry, when present, omits both `asi` and `asit`
