## 1. Calculation coverage

- [x] 1.1 Add focused ASI tests with hand-calculated fixtures for the three conditional `R` branches, factor `16`, first-bar alignment, and zero-denominator behavior.
- [x] 1.2 Add rolling-window tests using small overridden positive periods to verify ASI/ASIT warm-up, fixed-size window updates, and output length.
- [x] 1.3 Add template and registration assertions for the `ASI` name, `[26, 10]` defaults, and `asi`/`asit` line figures.

## 2. Built-in indicator implementation

- [x] 2.1 Implement the ASI indicator template with the specified domestic Swing Index formula and O(n) rolling ASI/ASIT accumulators.
- [x] 2.2 Register the ASI template in the built-in indicator index so existing discovery and creation APIs resolve it.

## 3. Verification

- [x] 3.1 Run the focused ASI unit tests and correct any formula or boundary discrepancies.
- [x] 3.2 Run the repository type check and full unit-test suite to confirm the new built-in indicator does not regress existing behavior.
