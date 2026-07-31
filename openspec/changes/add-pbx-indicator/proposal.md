## Why

KLineChart does not provide a built-in Waterfall Lines (PBX) indicator, so consumers must implement and register this common trend indicator themselves. Adding PBX alongside the existing MA and EMA indicators gives consumers a standard multi-period view of medium- and long-term price trends through the built-in indicator API.

## What Changes

- Add a built-in `PBX` price indicator using the domestic formula `(EMA(CLOSE, M) + MA(CLOSE, 2M) + MA(CLOSE, 4M)) / 3` for each configured period.
- Use the conventional default periods `[4, 6, 9, 13, 18, 24]` and expose position-named `PBX1` through `PBX6` line figures.
- Emit each line after its own required moving-average history is complete, preserve input alignment, and resolve the six default lines through the shared six-color indicator palette.
- Add focused tests for registration, defaults, formulas, warm-up boundaries, rolling calculations, parameter overrides, and flat-price data.

## Capabilities

### New Capabilities

- `pbx-indicator`: Defines registration, calculation, output, configurable periods, warm-up behavior, and presentation for the built-in PBX indicator.

### Modified Capabilities

None.

## Impact

- Adds one built-in indicator template and its tests under `src/extension/indicator/`.
- Registers `PBX` in the indicator template index, extending `getSupportedIndicators()` without changing existing API signatures.
- Uses the existing indicator calculation, rendering contracts, and six-color line palette and introduces no runtime dependencies.
