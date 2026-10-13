## Why

The chart already assigns stable logical indices, but viewport and drawing interaction state still depend on array offsets. Make logical coordinates the internal geometry contract so loading history does not require rebasing ordinary interaction state.

## What Changes

- Store viewport position and calculate horizontal geometry in logical coordinates.
- Project drawings and retain drag snapshots in logical coordinates; re-anchor by timestamp when the timeline is structurally replaced.
- **BREAKING**: Keep one exported `IPoint` representation, `{ logicalIndex, value }`, removing its `dataIndex` field. Point conversion helpers and drawing projection use this representation directly.
- Keep array access, indicator results, public data-index APIs, percentage zoom, time-share slots, and serialized timestamp/offset points compatible.
- Verify loading, replacement, dragging, zooming, resizing, and public conversion boundaries.

## Capabilities

### New Capabilities

- `logical-coordinate-state`: Internal logical viewport and drawing state with explicit data-index and timestamp boundaries.

### Modified Capabilities

None.

## Impact

TimeIndex, TimeScaleStore and its modes, drawing projection and interaction, and focused unit/browser tests. No new dependency. Callers of internal point conversion helpers must migrate from `dataIndex` to `logicalIndex`; explicit array-index APIs and serialized timestamp points retain their contracts.
