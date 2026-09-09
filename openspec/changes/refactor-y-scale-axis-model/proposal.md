## Why

The current multi-Y-axis implementation makes every rendered axis widget own an independent value transform, then special-cases the built-in left/right pair with event-level synchronization. That model cannot cleanly express one coordinate system rendered at multiple positions and leaves binding, placement, scale mode, and compatibility behavior coupled together.

## What Changes

- **BREAKING** Introduce pane-scoped `YScale` resources that exclusively own range, transform mode, tick coordinates, automatic scaling, and value conversion.
- **BREAKING** Redefine `YAxis` as a visual axis that references one `yScaleId`; multiple axes may reference the same scale and therefore share state without synchronization.
- **BREAKING** Move percentage and minute-percentage presentation from `YScaleType` to per-axis `labelDisplay`, so axes sharing one scale may render price and percentage labels without duplicating coordinate state.
- **BREAKING** Replace indicator `yAxisId`/`yAxisPosition` binding with `yScaleId`, resolved to the pane default once when the indicator is created.
- **BREAKING** Remove `styles.yAxis.position` and `styles.yAxis.mainPosition`; axis placement is configured on each `YAxis`.
- **BREAKING** Rename the public transform enum from `YAxisType` to `YScaleType` and move custom transform registration under the Y-scale extension namespace.
- Add public lifecycle APIs for Y scales and update Y-axis lifecycle APIs so scales and rendered axes are managed independently.
- Route range calculation, drawing, grids, coordinate conversion, and interaction through the selected Y scale while projecting tick and value-label text through each visual axis.
- Require referenced scales to exist instead of implicitly creating axes or scales from an indicator binding.
- Update the multi-asset demo and automated coverage to the new API.

## Capabilities

### New Capabilities

- `y-scale-axis-model`: Pane-scoped value scales, independently managed visual axes, scale-based series/indicator binding, layout, rendering, conversion, interaction, and lifecycle behavior.

### Modified Capabilities

None.

## Impact

- Public chart types and methods for indicators, coordinate conversion, Y-axis management, Y-axis label display, and new Y-scale management change incompatibly.
- Pane, Y-axis widget/component, layout, event routing, indicator rendering, labels, tooltips, grid rendering, and demos are affected.
- Existing callers using `yAxisId`, `yAxisPosition`, `YAxisType`, `styles.yAxis.position`, `styles.yAxis.mainPosition`, or implicit axis creation must migrate.
- No new runtime dependency or data-source abstraction is introduced.
