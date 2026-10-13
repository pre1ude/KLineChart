## Context

TimeIndex supplies logical coordinates, but TimeScaleStore stores pixel distance from the array end and drawing drags cache array indices. Persisted drawings use timestamps and integer offsets. The user requested one internal point representation with no data-index field.

## Goals / Non-Goals

**Goals:** Make viewport and temporary drawing geometry use logical coordinates; retain visual behavior and public contracts across history loading, refresh, corrections, mode changes, and resizing.

**Non-Goals:** Changing indicator indexing, serialized points, percentage zoom policy, or time-share calendar semantics.

## Decisions

- Store the viewport's right boundary in logical units; derive pixel offsets and public array-index ranges at boundaries. Modes produce logical ranges. Percentage and time-share policies remain specialized inputs to that common geometry contract.
- Use the existing exported IPoint name for `{ logicalIndex, value }`. Drawing geometry, drag snapshots, point conversion, and custom-template projection use the same representation. Remove separate logical-point wrappers; convert to array indices only at data access or explicit index APIs.
- Track TimeIndex reset revisions separately from ordinary data revisions. Prepend and timeline-extending snapshots retain logical drag anchors. Structural replacements reproject original timestamp snapshots; dataset replacement cancels old interaction through the existing dataset epoch.
- Keep timestamp anchors as the recovery mechanism when a timeline is rebased. Viewport replacement anchors only retain timestamp and distance; do not duplicate logical coordinates and revision fields in that snapshot. Preserve existing missing-anchor offset fallback and append behavior.
- Reuse the exact timestamp-sequence comparison for both indicator invalidation and logical-origin retention. Price-only snapshots skip the extension scan; changed sequences still follow the existing extension/reset rules, including empty datasets.
- Use direct changes to the existing mode/context interfaces and paired adapters, rather than adding a generic coordinate framework.
- Pass complete IPoint values through pointer picking and body-drag arithmetic. Convert to timestamp points only for drawing commits, callbacks, or snapshots that must survive rebasing. A drag starts only with a complete projection; failed reprojection keeps the old snapshot without applying movement until its timestamp anchors can be resolved again.
- Use the existing data-change context to decide whether to finish a data update; do not maintain a duplicate boolean update flag. Keep the current projection cache policy.
- Centralize integer bar picking in TimeScaleStore. Continuous logical conversion remains separate; public index picking, drawing, and public point conversion share the same nearest-bar rule with right-side midpoint ties. Use a tolerance scaled to the logical viewport to absorb affine interpolation round-off. Detect initial alignment by comparing logical boundaries with that tolerance, without adding another mutable alignment flag.
- Derive integer visible-data bounds with a tolerance covering both logical viewport and data-index magnitudes, including cancellation when setting a pixel offset. Preserve continuous domains and pixel geometry; only floor/ceil iteration bounds absorb round-off so offscreen bars do not affect visible extrema.

## Risks / Trade-offs

- Confusing logical values with array offsets → distinct point/range names and conversion only at explicit boundaries; exercise nonzero origins in tests.
- Resetting an origin without invalidating interaction state → reset revisions and replacement-during-drag regression tests.
- Percentage/time-share mode regressions → retain their current percentage/calendar policy and verify conversions after prepend.
- Zoom/resize rounding and inset regressions → run existing behavior tests alongside focused logical anchor tests.

## Migration Plan

Refactor viewport, then drawing geometry and drag state. Update consumers of IPoint and point conversion helpers to logicalIndex, including the example that displays array indices. Preserve explicit data-index APIs. Validate focused tests, full unit suite, type checks, lint, and browser tests.

## Open Questions

None; preserve existing public behavior.
