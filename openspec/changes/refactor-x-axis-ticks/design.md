# Design

## Overview

The refactor keeps the runtime behavior of X axis ticks stable while moving implementation details behind explicit functions.

`XAxisImp` should become an orchestrator:

- refresh range when auto-calculation is enabled
- choose regular or time-share tick generation
- pass default ticks through the registered axis template
- expose existing conversion APIs

Tick selection and layout should be handled by pure or near-pure helpers that receive the needed inputs directly.

## Proposed Modules

### `src/component/x-axis/tickLayout.ts`

Owns display-level tick layout rules:

- resolve `showMinLabel` and `showMaxLabel`
- merge boundary ticks
- measure tick label widths from a supplied font or width callback
- filter overlapped ticks using priority
- calculate the rendered X center used by both filtering and drawing

This module should keep the current priority behavior:

- max boundary label wins over min boundary label when both cannot fit
- min boundary label wins over regular labels
- day-start time-share labels win over regular labels

### `src/component/x-axis/regularTicks.ts`

Owns regular K-line X axis ticks:

- convert scale ticks to data indexes
- thin ticks based on label width and pixel spacing
- format labels by comparing adjacent timestamps
- create optional visible-range boundary ticks

The module should make the internal value meaning explicit. Internally use data indexes for coordinate lookup and timestamps for final label identity, instead of relying on `parseInt` against `AxisTick.value`.

### `src/component/x-axis/timeShareTicks.ts`

Owns time-share ticks:

- select tick indexes from configured intraday ticks and day count
- support `preferXTicks`
- preserve day-start ticks for multi-day views
- preserve boundary labels when configured
- format day-start labels as full date or month-day based on year changes

Existing exported helpers can either remain re-exported from `XAxis.ts` for compatibility with current tests, or tests can be moved to the new module paths.

## XAxisImp Flow

The intended shape is:

```text
buildTicks()
  range = auto ? timeScale.visibleRange : manual range
  defaultTicks =
    isTimeShare
      ? createTimeShareXAxisTicks(...)
      : createRegularXAxisTicks(...)
  ticks = template.createTicks({ range, bounding, defaultTicks })
```

`XAxisImp` should not contain the actual session detection, nice-step selection, timestamp label comparison, or overlap-removal algorithm.

## Rendering Contract

`XAxisView` currently clamps the first and last label inside the axis width. The overlap filter performs a similar calculation before rendering. This change should avoid keeping two independent versions of that logic.

The preferred path is to expose a shared rendered-center helper from `tickLayout.ts` and use it from both layout filtering and `XAxisView`.

## Compatibility

Behavior must remain compatible with the existing `src/component/XAxis.test.ts` expectations:

- dataZoom forces both boundary labels
- style-level `showMinLabel` and `showMaxLabel` work outside dataZoom
- overlapping ticks respect min, max, and day-start priorities
- time-share charts prefer session boundaries and rounded intraday times
- multi-day time-share charts keep day-start ticks

No public chart API should change.

## Risks

- Accidentally changing the exact tick labels for sparse or multi-day time-share data.
- Breaking custom X axis templates if default tick identity changes.
- Introducing extra text measurement during draw or rebuild.

Mitigation: keep the existing unit tests, add targeted tests around extracted modules, and run type-check after implementation.
