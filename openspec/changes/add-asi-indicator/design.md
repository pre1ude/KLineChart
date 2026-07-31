## Context

Built-in indicators are `IndicatorTemplate` objects under `src/extension/indicator/` and are made available through the shared template manager in `src/extension/indicator/index.ts`. ASI is a recursive-looking display indicator, but the domestic formula selected for this change can be calculated in one pass with two bounded rolling windows. The result must follow the repository convention of returning an input-aligned array whose entries omit values during warm-up.

## Goals / Non-Goals

**Goals:**

- Match the commonly used Chinese-market ASI formula with factor `16` and defaults `[26, 10]`.
- Provide the standard `ASI` and `ASIT` lines through the existing indicator APIs.
- Keep calculation linear in the number of bars and deterministic for flat data.
- Verify both registration and calculation independently of chart rendering.

**Non-Goals:**

- Implement Wilder's original limit-move `T` input or factor `50` variant.
- Add market-specific price-limit configuration.
- Add a bespoke renderer, pane behavior, public calculation function, demo page, or new runtime dependency.
- Normalize or validate calculation parameters beyond the positive-integer contract used by this indicator.

## Decisions

### Use the domestic two-line ASI convention

The template will be named `ASI`, use calculation parameters `[26, 10]`, and expose line figures `{ key: 'asi' }` and `{ key: 'asit' }`. This matches the naming and default periods consumers expect from common Chinese market-data applications. The Wilder variant was rejected because it requires a limit-move input that is not represented in `KLineData` and would produce incompatible values.

### Preserve the formula's strict conditional branches

The implementation will calculate `A`, `B`, `C1`, `D`, `X`, `K`, and `R` directly from adjacent OHLC bars. The `R` branches will use the formula's strict greater-than comparisons; ties fall through to the `C1 + D / 4` branch. Writing the branches explicitly keeps the result auditable against the published domestic formula.

### Treat an undefined swing as zero only when the denominator is zero

The first bar has no predecessor, so it contributes no `SI` and returns an empty result entry. For later bars where `R` is zero, `SI` will be `0`; this keeps flat-price inputs finite and includes a neutral value in rolling windows. Reusing the current bar as its own predecessor was rejected because it can manufacture a non-zero first swing from the current open and close.

### Use bounded rolling accumulators

The calculation will keep a rolling sum of `SI` values for `ASI`, then a rolling sum of emitted `ASI` values for `ASIT`. Each output is emitted only after its full period is available. This gives O(n) time and O(period) retained values while matching existing indicator warm-up behavior. Re-summing slices on every bar was rejected because it adds avoidable O(n * period) work.

### Test the template through the existing Indicator abstraction

Focused tests will instantiate the template with the existing `Indicator` class so defaults and parameter overrides exercise the same callback contract used at runtime. Registration will be asserted through `getSupportedIndicators()`. Hand-computed fixtures will cover each `R` branch, window transitions, first-bar alignment, and `R = 0` behavior.

## Risks / Trade-offs

- **Formula variants can have the same ASI name but different results** -> Document the exact formula in the specification and tests, including factor `16`, strict branch comparisons, and the absence of Wilder's `T`.
- **Warm-up behavior may differ from platforms that show partial windows** -> Require full ASI and ASIT windows, consistent with this repository's built-in moving-window indicators.
- **Floating-point fixtures can be brittle** -> Assert calculated values with numeric tolerances and use exact assertions only for zero and structural behavior.
- **Invalid periods could yield unintuitive results** -> Limit the contract and tests to positive integer periods; broader parameter validation remains outside this change.
