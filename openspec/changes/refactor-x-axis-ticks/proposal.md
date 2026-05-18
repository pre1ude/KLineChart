# Refactor X Axis Ticks

## What

Refactor X axis tick generation and layout out of `XAxisImp` into smaller behavior-preserving modules.

## Why

`XAxisImp` currently mixes axis state, time-scale conversion, regular K-line tick selection, time-share tick selection, boundary label rules, text measurement, overlap filtering, and extension delegation. This makes the X axis hard to reason about and risky to change.

The current implementation also uses `AxisTick.value` for different meanings at different points in the pipeline: data index before formatting and timestamp after formatting. That weakens the contract between tick generation, layout, view rendering, and custom axis extensions.

## Scope

- Preserve existing public APIs and current tick behavior.
- Extract regular K-line tick creation into a dedicated module.
- Extract time-share tick index selection and label creation into a dedicated module.
- Extract boundary-label merge and overlap filtering into a dedicated layout module.
- Keep `XAxisImp` responsible for range caching, choosing the active tick strategy, calling custom `createTicks`, and coordinate conversion.
- Keep `XAxisView` rendering behavior unchanged except where needed to share a single layout calculation.
- Do not add new X axis features in this change.
- Do not rewrite the time scale store in this change.
