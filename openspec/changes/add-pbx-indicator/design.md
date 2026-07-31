## Context

Built-in indicators are `IndicatorTemplate` objects under `src/extension/indicator/` and are registered through the shared template manager in `src/extension/indicator/index.ts`. The indicator abstraction supports price-series precision, dynamic figures, and per-figure styles. PBX combines three close-based averages for each configured period and can expose a different warm-up boundary for every line. The existing MA implementation has the needed complete-window behavior, but the existing standalone EMA template uses a simple-average seed at index `M - 1`; that seed differs from the first-close EMA convention used by common domestic formula engines.

## Goals / Non-Goals

**Goals:**

- Implement the conventional six-line PBX formula with default periods `[4, 6, 9, 13, 18, 24]`.
- Preserve the conventional position-based `PBX1`, `PBX2`, and subsequent line names while the existing indicator parameter display shows configured periods.
- Preserve one result per input bar and emit each line only after its `4*M` close window is complete.
- Keep calculation linear in the number of input bars and configured periods.
- Give the six conventional lines distinct default colors through the existing shared six-color indicator palette.

**Non-Goals:**

- Add alternate PBX formulas, high/low/open-based variants, or partial-window output.
- Add validation or normalization behavior for non-positive or non-integer parameters beyond the existing indicator parameter contract.
- Force PBX into the main candle pane or add a bespoke renderer.
- Refactor the existing MA or EMA templates into shared calculation helpers.

## Decisions

### Use the domestic first-close EMA convention

PBX will seed every EMA component from the first close, then apply `(2 * close + (M - 1) * previousEMA) / (M + 1)` from the next bar onward. This matches the `EMA(CLOSE, M)` semantics expected in common domestic formula languages. Reusing `exponentialMovingAverage.ts` is rejected because that template waits for `M` values and seeds with their simple average, which changes PBX values even when the first PBX output is delayed until the `4*M` moving average exists. The MA components retain complete-window arithmetic consistent with `movingAverage.ts`.

### Calculate each configured period in one aligned pass

The implementation will maintain per-period close sums and EMA state, updating each period while iterating over the input list. It will emit `pbxN` only when the `M`, `2*M`, and `4*M` requirements are all satisfied, which is equivalent to index `4*M - 1`. Recomputing sliced windows for every bar is rejected because it makes the common six-line case unnecessarily expensive.

### Use conventional position-based line names

The template will define six default figures and a `regenerateFigures` callback that creates `pbx1`, `pbx2`, and so on with titles `PBX1: `, `PBX2: `, and so on. Domestic PBX convention uses the numeric suffix as a line position, while the indicator's calculation-parameter text separately presents `(4,6,9,13,18,24)` or any overrides. Period-derived titles such as `PBX4` and `PBX6` are rejected because they can be mistaken for conventional line names and would label the default set as `PBX4`, `PBX6`, `PBX9`, and so on instead of `PBX1` through `PBX6`.

### Reuse the shared six-color line palette

The shared palette already supplies six indicator line colors, so PBX will define no template-level figure color overrides. Its six default figures resolve to the six palette entries by index, preserving theme and consumer style precedence. An indicator-local `pbx6` color is rejected because it would override chart-level line colors and duplicate a capability the shared palette now provides.

## Risks / Trade-offs

- **Long warm-up for the 24-period line** → Document and test the exact `4*M - 1` boundary; shorter lines remain available earlier.
- **PBX EMA values differ from this repository's standalone EMA template** → Specify and test the intentional first-close seed because domestic formula compatibility takes priority for this indicator.
- **Duplicate periods produce duplicate calculations and labels** → Accept them as caller-supplied parameters and keep position-based figure keys; parameter validation is outside this change.
- **Six price lines can visually crowd a pane** → Keep each line independently addressable through existing figure visibility and style overrides.
- **A future palette reduction could repeat a PBX line color** → Assert the six resolved default colors in PBX registration tests so the presentation contract fails visibly.

## Migration Plan

No migration is required. Registering PBX is additive; existing indicator names, templates, and calculation results remain unchanged. Removing the PBX registration cleanly rolls back the feature.

## Open Questions

None for the initial implementation.
