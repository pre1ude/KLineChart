## Why

Overlay control points are currently inferred one-for-one from the stored drawing points. That works for simple lines, but composite shapes such as rectangles have derived vertices that users reasonably expect to drag even though those vertices are not independent data anchors.

## What Changes

- Let an overlay optionally define its own control-point descriptors independently of its stored points.
- Keep default overlays backward compatible by deriving one control point per stored point when no custom descriptors are provided.
- Add a per-overlay `auto`/`always` control-point visibility policy so an active measurement region can keep its handles visible without depending on transient hover or selection state.
- Route control-point drag updates back to the overlay with a stable control-point key as well as its rendered index.
- Update the built-in rectangle overlay to expose all four corners as draggable control points while retaining its two-point data model and two-step drawing flow.
- Keep visual-only hover redraws from duplicating transparent control-point hit figures or event-tree nodes.
- Add focused tests for default control points, custom control-point rendering metadata, and all four rectangle drag mappings.

## Capabilities

### New Capabilities

- `overlay-control-points`: Overlay-defined interaction handles, default compatibility behavior, and derived rectangle corner handles.

### Modified Capabilities

None.

## Impact

- Overlay type definitions and overlay template callbacks.
- Overlay view control-point construction and event metadata.
- Overlay drag dispatch in the overlay widget layer.
- Built-in rectangle overlay behavior.
- Unit tests for overlay interaction and rectangle geometry.
- No new runtime dependencies and no intended breaking changes for existing overlay templates.
