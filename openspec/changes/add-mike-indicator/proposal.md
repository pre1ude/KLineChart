## Why

KLineChart does not provide a built-in Mike Base (MIKE) indicator, so consumers must register and maintain their own implementation. Adding the standard six-line price-channel variant provides consistent support and resistance values through the existing built-in indicator API.

## What Changes

- Add a built-in `MIKE` price indicator using the standard `TYP`, rolling `HHV`, and rolling `LLV` formulas.
- Use the default calculation parameter `[12]` and expose the six `WR`, `MR`, `SR`, `WS`, `MS`, and `SS` line figures.
- Require a complete rolling window before emitting values and give all six lines distinct default colors.
- Extend the shared default indicator line palette from five to six colors so MIKE and other six-line indicators do not need template-specific color overrides.
- Add focused tests for registration, formulas, rolling-window behavior, parameter overrides, alignment, and flat-price data.

## Capabilities

### New Capabilities

- `mike-indicator`: Defines registration, calculation, output, defaults, warm-up behavior, and presentation for the built-in MIKE indicator.
- `indicator-line-palette`: Defines the six-color shared default palette used by indicator line figures.

### Modified Capabilities

None.

## Impact

- Adds one built-in indicator template and its tests under `src/extension/indicator/`.
- Registers `MIKE` in the indicator template index, extending `getSupportedIndicators()` without changing existing API signatures.
- Appends one color to the shared default indicator line palette, changing the default color cycle for the sixth and later line figures while preserving the existing first five colors.
- Reuses the existing rolling high/low utility and introduces no runtime dependencies.
