## 1. Tests and behavioral fixtures

- [x] 1.1 Add PBX tests covering built-in registration, price-series/OHLC metadata, default periods, position-based `PBX1` through `PBX6` figure keys/titles, and six distinct default line colors.
- [x] 1.2 Add hand-calculated formula tests for one configured period, including the domestic first-close EMA seed, recursive EMA updates, complete MA windows, and the first emitted PBX value.
- [x] 1.3 Add multi-period tests for independent warm-up boundaries, input/result alignment, rolling updates, positive period overrides, and flat-price finite outputs.

## 2. Built-in indicator implementation

- [x] 2.1 Implement the PBX template with default periods `[4, 6, 9, 13, 18, 24]`, position-based `pbxN` line figures, and the standard EMA/MA combination using a first-close EMA seed.
- [x] 2.2 Emit each PBX line only after its `4*M` close history is complete while preserving one result entry per input bar.
- [x] 2.3 Resolve the six default PBX figures through the existing shared six-color line palette without adding template-level color overrides.
- [x] 2.4 Register PBX in `src/extension/indicator/index.ts` and verify overridden period lists regenerate matching figures.

## 3. Verification

- [x] 3.1 Run the focused PBX unit tests and correct any formula, warm-up, alignment, parameter, or style discrepancies.
- [x] 3.2 Run the repository type check and full unit-test suite to confirm the new built-in indicator does not regress existing behavior.
