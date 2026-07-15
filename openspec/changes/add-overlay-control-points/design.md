## Context

The overlay model stores construction points and the overlay view currently renders exactly one default control point for each stored point. This couples persistence, geometry, and interaction topology. A rectangle demonstrates the mismatch: two opposite data anchors are sufficient to serialize and draw it, while users expect all four derived corners to be draggable.

Control-point visibility is also coupled to drawing, hover, and selection state. Measurement overlays need to keep handles visible while related statistics remain active, even when transient interaction state changes.

## Goals / Non-Goals

**Goals:**

- Allow an overlay template to derive a stable list of control points from its geometry.
- Preserve the existing one-control-point-per-stored-point behavior as the default.
- Keep control-point drawing, styling, hit testing, visibility, and drag lifecycle centralized in the overlay framework.
- Pass custom control-point identity to the overlay when a handle is dragged.
- Give the built-in rectangle four draggable corner handles without changing its two-anchor serialization or two-step drawing flow.
- Allow an individual overlay to choose automatic or persistent control-point visibility.

**Non-Goals:**

- Store derived rectangle corners in `overlay.points`.
- Add edge-midpoint, rotation, or arbitrary custom-shaped handles.
- Change body dragging, overlay locking, selection, or drawing-step semantics.
- Change the visual style of existing default control points.

## Decisions

### Overlay templates define control-point descriptors

Add an optional `createControlPoints` template callback. It receives the overlay and its already converted pixel coordinates and returns ordered descriptors containing a stable `key` and a `coordinate`.

When the callback is absent, the overlay framework derives descriptors directly from the stored coordinates and uses the existing generated point figure keys. This keeps existing templates and event metadata unchanged.

Descriptors contain interaction geometry rather than extra persisted data. This avoids redundant rectangle vertices and lets future composite overlays expose handles that do not correspond one-for-one with stored points.

Alternative considered: add control-point circles through `createFigures`. Rejected because normal figures are body interactions and would duplicate framework styling and hit-testing behavior.

Alternative considered: store four rectangle points. Rejected because it introduces redundant state, requires continuously enforcing axis-alignment constraints, and changes serialization and drawing semantics.

### Reuse figure keys as stable control-point identity

The descriptor key is written to the existing control-point `figureKey` metadata. Drag dispatch passes that key as an additional optional argument to `onControlPointUpdate`, while retaining the rendered handle index and the existing first three callback arguments.

Existing callbacks remain source compatible because JavaScript functions may ignore the additional argument. Default handles retain their current figure keys and indices.

### Keep interaction infrastructure in OverlayView and OverlayLayer

`OverlayView` remains responsible for visibility checks, visual styles, transparent hit figures, hover decoration, and event-tree registration. `OverlayLayer` continues to own pressed and dragging state and forwards the selected descriptor index and key to the overlay update method.

This separates shape-specific handle topology from consistent chart-wide interaction behavior.

### Visual-only redraws do not bind control-point events

The hovered overlay is drawn a second time to keep its visuals above later overlays. The existing `bindEvent: false` flag already makes regular overlay figures static on this second pass. Propagate the same flag through default-figure drawing so control points still render visually but skip their transparent hit figures and event-tree registration.

The first normal pass remains event-bound, so control points retain one canonical hit target. This removes duplicate transient figures without changing the overlay's visual stacking.

### Add per-overlay control-point visibility policy

Add `controlPointVisibility: 'auto' | 'always'` with a default of `auto`.

- `auto` preserves the current behavior: completed handles render only while hovered or selected.
- `always` renders handles for a completed visible overlay regardless of hover or selection.

The property participates in overlay update detection so `overrideOverlay` can switch the policy and trigger a redraw.

### Rectangle uses four virtual corner handles

The rectangle keeps opposite anchors `p0 = (x0, y0)` and `p1 = (x1, y1)`. It derives four stable handles:

- `corner_00 = (x0, y0)` updates both components of `p0`.
- `corner_10 = (x1, y0)` updates `p1.dataIndex` and `p0.value`.
- `corner_11 = (x1, y1)` updates both components of `p1`.
- `corner_01 = (x0, y1)` updates `p0.dataIndex` and `p1.value`.

Keys describe anchor-component ownership rather than visual names such as `topLeft`, so identity remains stable when corners cross during dragging.

## Risks / Trade-offs

- [Custom callbacks return duplicate keys] → Treat descriptor order as the drag index and document keys as overlay-owned stable identifiers; built-in overlays use unique constants.
- [Custom handles change order between frames] → Require templates to return a stable order; rectangle order is fixed.
- [Always-visible handles add event targets] → Make persistence opt-in per overlay and preserve `auto` as the default.
- [Drawing previews have derived handles] → Draw custom handles during progress but do not register them as draggable until the overlay is completed; default preview behavior remains unchanged.
- [Additional callback argument affects typings] → Append an optional argument rather than replacing existing arguments.
- [Visual-only hover redraw loses control-point interaction] → Keep the first normal draw event-bound and cover the second-pass behavior with a regression test that verifies visuals remain while no children are registered.

## Migration Plan

No migration is required. Existing overlay templates omit both new properties and retain current behavior. Rollback consists of removing the optional callback and visibility property and restoring the rectangle's default two handles.

## Open Questions

None for this change. Additional handle shapes and edge/rotation handles can be designed separately if needed.
