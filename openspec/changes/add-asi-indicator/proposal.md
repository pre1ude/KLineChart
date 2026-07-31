## Why

KLineChart does not provide a built-in Accumulative Swing Index (ASI), so consumers must register and maintain their own implementation. Adding ASI with the formula and defaults commonly used by Chinese market-data applications provides consistent results through the existing built-in indicator API.

## What Changes

- Add a built-in `ASI` indicator using the commonly used Chinese-market Swing Index formula.
- Use default calculation parameters `[26, 10]` and expose `ASI` and `ASIT` line figures.
- Define deterministic warm-up and zero-denominator behavior for incomplete or flat price data.
- Add focused tests for registration, formula output, rolling windows, parameter overrides, and edge cases.

## Capabilities

### New Capabilities

- `asi-indicator`: Defines registration, calculation, output, defaults, and edge-case behavior for the built-in ASI indicator.

### Modified Capabilities

None.

## Impact

- Adds one built-in indicator template under `src/extension/indicator/` and registers it in the indicator template index.
- Extends the names returned by `getSupportedIndicators()` with `ASI`; no existing API signatures change.
- Adds indicator-specific unit tests and introduces no runtime dependencies.
