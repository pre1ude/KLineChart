## Context

Built-in indicators are `IndicatorTemplate` objects under `src/extension/indicator/` and are registered through the shared template manager in `src/extension/indicator/index.ts`. MIKE produces six price-level lines from the current typical price and rolling high/low values. The repository already provides `calcHhvLlv`, which calculates complete-window rolling extrema in linear time and is used by KDJ and WR.

The shared indicator palette contains five line colors, so a six-line indicator would otherwise render its sixth line with the same color as its first line. Extending the shared palette allows MIKE and other six-line indicators to follow the normal line-style cycle without template-specific presentation rules.

## Goals / Non-Goals

**Goals:**

- Match the standard domestic MIKE formulas with default period `[12]`.
- Expose the six standard `WR`, `MR`, `SR`, `WS`, `MS`, and `SS` lines as price-series output.
- Follow the repository's complete-window warm-up and input-alignment conventions.
- Keep calculation O(n) and give all six lines distinct default colors.
- Preserve the order and values of the existing five default indicator line colors while appending a sixth.
- Verify registration, formulas, rolling-window transitions, parameter overrides, alignment, and flat-price behavior.

**Non-Goals:**

- Add alternative MIKE formula variants or partial-window output.
- Add parameter normalization or validation beyond the positive-integer period contract.
- Force MIKE into the candle pane, add a bespoke renderer, or add a demo page.
- Change any existing public API or retheme the first five default indicator lines.

## Decisions

### Use the standard six-line domestic formula

The indicator will calculate the current typical price as `(high + low + close) / 3`, then derive its three resistance and three support lines from the current complete-window `HHV(high, period)` and `LLV(low, period)`. The template will use lowercase result keys with uppercase tooltip titles to match existing built-in indicator conventions. Alternative MIKE variants were rejected because they would produce incompatible values under the same indicator name.

### Model MIKE as a price-series indicator

The template will set `series: IndicatorSeries.Price` so its precision follows the chart's price precision, and `shouldOhlc: true` so an indicator pane containing MIKE can include candle OHLC values in its visible range. Placement remains controlled by the existing `createIndicator` pane options; the template will not force a main-pane overlay.

### Reuse the rolling-extrema utility

The calculation will call `calcHhvLlv` once for the configured period and calculate all six lines in a single aligned pass. This keeps the implementation O(n) and matches the complete-window warm-up used by KDJ and WR. Repeatedly applying `Math.max` and `Math.min` to sliced windows was rejected because it would make calculation O(n * period).

### Emit all six values only for complete windows

Entries before index `period - 1` will be empty objects. Starting at index `period - 1`, every entry will contain all six values. Partial-window values were rejected because existing rolling-extrema indicators omit output until a full window exists and mixed warm-up behavior would make comparisons less predictable.

### Extend the shared default line palette to six colors

The default indicator line palette will append `#A7E163` after the existing five colors. MIKE will not define any figure-level color override; its six figures will receive the six shared colors by index. This preserves theme and consumer style precedence because callers can override the sixth shared line style through the existing `styles.indicator.lines` API. A MIKE-specific `ss` color was rejected because figure-level styles override chart-level line colors and couple a general presentation need to one indicator.

### Test through the existing Indicator abstraction

Focused tests will resolve the registered template and calculate through `Indicator`, exercising the same defaults and parameter override contract used at runtime. Small hand-calculated fixtures will cover the first complete window, a rolling-window eviction, flat data, and input alignment. Presentation coverage will assert that the shared palette contains six distinct colors and that MIKE uses them without a template-level figure color override.

## Risks / Trade-offs

- **Six simultaneous lines can make the chart visually dense** -> Keep all lines individually addressable through existing figure style and visibility overrides.
- **Platforms can emit MIKE values during a partial initial window** -> Specify and test complete-window warm-up to match this repository's KDJ and WR behavior.
- **The sixth default color changes existing custom indicators with six or more line figures** -> Preserve the first five colors and document the intentional six-color cycle; consumer-supplied line styles continue to take precedence.
- **Invalid periods can produce unintuitive calculation behavior** -> Define the supported contract as positive integers and keep broader parameter validation outside this focused change.
