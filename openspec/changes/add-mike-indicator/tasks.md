## 1. Calculation and template coverage

- [x] 1.1 Add focused MIKE template tests for built-in registration, `[12]` defaults, price-series and OHLC settings, six line figures, and distinct default line colors.
- [x] 1.2 Add hand-calculated formula tests for all six outputs at the first complete window and after a rolling-window eviction.
- [x] 1.3 Add calculation tests for input alignment, complete-window warm-up, positive period overrides, and flat-price data.

## 2. Built-in indicator implementation

- [x] 2.1 Implement the MIKE indicator template with the standard six-line formulas and the existing rolling `HHV`/`LLV` utility.
- [x] 2.2 Register the MIKE template in the built-in indicator index so existing discovery and creation APIs resolve it.

## 3. Verification

- [x] 3.1 Run the focused MIKE unit tests and correct any formula, warm-up, rolling-window, or presentation discrepancies.
- [x] 3.2 Run the repository type check and full unit-test suite to confirm the new built-in indicator does not regress existing behavior.

## 4. Shared indicator line palette

- [x] 4.1 Add focused coverage for six distinct shared default indicator line colors and verify MIKE has no template-level color override.
- [x] 4.2 Append a sixth shared default indicator line color and remove the MIKE-specific `ss` style.

## 5. Updated verification

- [x] 5.1 Run the focused default-style and MIKE unit tests after the palette change.
- [x] 5.2 Run the repository type check, full unit-test suite, strict OpenSpec validation, and diff checks.
