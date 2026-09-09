## Context

The existing pane registry is keyed by Y-axis widget ID. Each widget constructs its own `YAxis` component, so range, transform, ticks, and interaction state are duplicated for every rendered axis. The built-in left/right pair is made to look shared by broadcasting drag, wheel, and reset events to two components. Indicators bind to widget identity through `yAxisId`, or are dynamically resolved through side-based compatibility fields and global style topology.

The new invariant is that a coordinate system is independent from its visual rulers. A pane may contain a scale with no rendered axis, one rendered axis, or many rendered axes. Every rendered axis referencing a scale observes and mutates the same state.

## Goals / Non-Goals

**Goals:**

- Represent value transforms as pane-scoped `YScale` resources with stable IDs.
- Let zero or more `YAxis` widgets reference one `YScale` through `yScaleId`.
- Bind every indicator to exactly one scale and keep that binding stable after creation.
- Make range calculation, conversion, rendering geometry, grids, and interaction scale-based while keeping label projection axis-specific.
- Allow visual axes sharing one scale to present canonical values as either values or percentages without duplicating scale state.
- Remove side-based compatibility binding and global style-driven axis topology.
- Preserve independently scaled overlays and the external-asset demo through explicit scale/axis creation.

**Non-Goals:**

- A general reusable data-series store or multiple time domains.
- Cross-pane scale sharing; scale IDs are scoped by pane.
- Automatic migration shims for the removed API.

## Decisions

### Normalize scales and axes as separate pane resources

Each drawable pane owns two registries:

```text
Map<yScaleId, YScale>
Map<yAxisId, YAxisWidget>
```

`YScale` owns the component that calculates range and canonical tick coordinates/values and performs value conversion. `YAxisWidget` owns placement, visibility, visual rendering, hit testing, a `yScaleId` reference, and label projection. Axis widgets never own or copy scale state.

Keeping range state on each widget plus synchronization was rejected because it permits drift and contradictory scale modes.

### Use a stable default scale and one initial visual axis

Every drawable pane starts with scale ID `default` and axis ID `default`, with the axis initially placed on the left and displaying canonical values. Candle data, grid lines, overlays, and indicators without an explicit binding use the pane's default scale. Additional visual positions are created by adding axes that reference that same scale.

The default IDs do not encode a side, so moving the initial axis does not change any data binding.

### Resolve omitted indicator bindings once

Indicators expose `yScaleId`; `yAxisId` and `yAxisPosition` are removed. During creation, an omitted `yScaleId` is materialized as the pane's current default scale ID and stored on the indicator instance. Changing pane topology later cannot migrate an existing indicator implicitly.

An explicit missing scale is rejected. Implicit axis/scale creation and orphan cleanup are removed because lifecycle and placement cannot be inferred from a scale reference.

### Separate coordinate transforms from label projections

`YScaleOptions` contains the custom scale implementation name, scale type, nice-range behavior, interaction enablement, and semantic title/formatting configuration. `YScaleType` contains only coordinate transforms (`Normal` and `Log`).

`YAxisOptions` contains `id`, `paneId`, `yScaleId`, `position`, visibility, order, and `labelDisplay`. `YAxisLabelDisplay` selects canonical value, visible-first-close percentage, or minute-basis percentage text. A visual axis cannot override range or scale type; label display changes text only and never changes tick coordinates, conversion, automatic range, or interaction state.

Percentage projection uses the scale's canonical real value rather than its internal transformed value. This keeps the projection correct for any scale transform and lets one normal price scale render a value axis on the left and a percentage axis on the right.

### Build and mutate each scale once

Automatic extents aggregate candle data only for the default candle scale and indicator figures whose `yScaleId` matches the scale. Layout builds canonical tick coordinates and values once per scale, even when several visible axes reference it. Every referencing widget reuses that geometry and projects only its own label text. Axis auto-width is measured from the projected text, so axes sharing a scale may have different widths.

Dragging, wheel-zooming, or resetting an axis resolves its `yScaleId` and mutates that one scale. All views referencing it redraw naturally; no event fan-out exists. Main-area vertical pan visits unique scales rather than widgets.

### Keep scale and axis lifecycle independent

Public APIs add `createYScale`, `getYScales`, `overrideYScale`, and `removeYScale`. Existing Y-axis APIs become visual-axis APIs and `createYAxis` requires an existing `yScaleId`.

An axis may be removed while its scale remains in use. A scale cannot be removed while it is the pane default, referenced by an axis, or bound by an indicator.

The pane is the scale ownership boundary, so its removal operation enforces all three constraints itself. Public chart APIs delegate to that operation instead of duplicating dependency checks that an internal caller could bypass.

### Align implementation and extension names with the model

The value transform implementation is named `YScale`, its internal pane adapter is named `YScaleHost`, and custom implementations live under the Y-scale extension namespace. The public transform enum is `YScaleType`; percentage display modes live in `YAxisLabelDisplay`. `YAxis` naming is reserved for visual rulers, their widgets, styles, placement, and label projection.

Compatibility aliases are intentionally not retained because the change already permits a clean breaking API and aliases would preserve the old conceptual coupling in new integrations.

### Make coordinate conversion scale-explicit

`ConvertFinder` uses `yScaleId`. Omission resolves to the pane default scale; side-based lookup is removed. This preserves a concise single-scale call while making multi-scale conversion deterministic.

## Risks / Trade-offs

- **[Risk] Broad API and test breakage** → Update exported types, demos, and focused tests in the same change and rely on TypeScript to expose every stale field.
- **[Risk] Existing custom Y-axis extensions assume a widget parent** → Introduce a scale host with pane/bounding/options access and adapt the extension constructor contract without changing tick-template behavior.
- **[Risk] Duplicate work when several axes share a scale** → Build ticks by unique scale ID and let widgets only draw cached ticks.
- **[Risk] Different axis projections require different widths** → Reuse scale tick geometry but project text and measure auto-width per visual axis.
- **[Risk] Existing staged compatibility-event changes overlap** → Preserve the staged patch until the new event implementation replaces synchronization with direct shared-scale mutation.
- **[Risk] Removing implicit creation makes the demo more verbose** → Create its comparison scales and axes explicitly; this is intentional lifecycle clarity.

## Migration Plan

1. Add Y-scale types, registry, lifecycle API, and shared component ownership.
2. Convert visual Y-axis options to reference `yScaleId` and update layout/rendering.
3. Replace indicator binding and conversion fields with `yScaleId`.
4. Remove compatibility-axis event synchronization and operate on unique scales.
5. Remove global axis position/main-position style fields and update demos/tests.
6. Run focused unit tests, type checking, lint, and builds.
7. Remove remaining internal and public Y-axis names from scale semantics and centralize scale dependency protection in the owning pane.
8. Move percentage modes to per-axis label projection and keep scale types limited to actual coordinate transforms.

Rollback requires reverting the complete change because old and new public binding models are intentionally incompatible.

## Open Questions

None. The requested model explicitly chooses normalized `YScale` and visual `YAxis` resources and permits breaking API changes.
