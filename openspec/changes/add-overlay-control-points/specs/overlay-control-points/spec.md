## ADDED Requirements

### Requirement: Default control points remain compatible
The system SHALL derive one control point per stored overlay point when an overlay does not define custom control points, and SHALL preserve the existing control-point order and figure keys.

#### Scenario: Existing overlay omits custom control points
- **WHEN** an overlay with stored points is rendered without a `createControlPoints` callback
- **THEN** the system renders one control point for each stored point in the same order and with the existing generated figure key

### Requirement: Overlays can define derived control points
The system SHALL allow an overlay template to return ordered control-point descriptors containing stable keys and coordinates independently of its stored points.

#### Scenario: Composite overlay returns more handles than anchors
- **WHEN** an overlay with two stored points returns four custom control-point descriptors
- **THEN** the system renders and hit-tests all four descriptors without requiring `needDefaultPointFigure` or adding derived points to `overlay.points`

#### Scenario: Derived handle is dragged
- **WHEN** a user drags a custom control point
- **THEN** the system passes the handle index, pointer-derived point, and stable descriptor key to the overlay control-point update logic

### Requirement: Control-point interaction remains framework managed
The system SHALL apply the standard control-point styles, hover decoration, hit testing, and drag lifecycle to both default and custom control points.

#### Scenario: Custom handle is rendered
- **WHEN** an overlay returns a custom control-point descriptor
- **THEN** the handle uses the same framework-managed visual and interaction behavior as a default control point

#### Scenario: Hovered overlay receives a visual-only redraw
- **WHEN** an overlay's control points are redrawn with event binding disabled for visual stacking
- **THEN** the system renders the visible control-point circles without drawing transparent hit figures or registering duplicate event-tree nodes

### Requirement: Per-overlay persistent visibility
The system SHALL support `auto` and `always` control-point visibility policies and SHALL use `auto` when no policy is specified.

#### Scenario: Automatic visibility
- **WHEN** a completed overlay uses `auto` visibility and is neither hovered nor selected
- **THEN** its control points are not rendered or registered for hit testing

#### Scenario: Persistent visibility
- **WHEN** a completed visible overlay uses `always` visibility and is neither hovered nor selected
- **THEN** its control points remain rendered and registered for hit testing

#### Scenario: Visibility policy is overridden
- **WHEN** an overlay's control-point visibility policy is changed through `overrideOverlay`
- **THEN** the affected overlay pane is redrawn using the new policy

### Requirement: Rectangle exposes four draggable corners
The built-in rectangle overlay SHALL retain two stored opposite anchors and SHALL expose all four rectangle corners as stable draggable control points.

#### Scenario: Rectangle is completed
- **WHEN** a rectangle has two completed data anchors
- **THEN** it exposes four corner control points while retaining exactly two stored points

#### Scenario: First anchor corner is dragged
- **WHEN** the `corner_00` handle is dragged
- **THEN** both the data index and value of the first stored anchor are updated

#### Scenario: Opposite anchor corner is dragged
- **WHEN** the `corner_11` handle is dragged
- **THEN** both the data index and value of the second stored anchor are updated

#### Scenario: First derived corner is dragged
- **WHEN** the `corner_10` handle is dragged
- **THEN** the second anchor data index and first anchor value are updated

#### Scenario: Second derived corner is dragged
- **WHEN** the `corner_01` handle is dragged
- **THEN** the first anchor data index and second anchor value are updated

### Requirement: Selected overlay remains interactively accessible
The system SHALL render a selected overlay once after other completed main-view overlays and SHALL bind its interaction figures after theirs without changing its persisted order.

#### Scenario: Selected overlay is covered in the base order
- **WHEN** a selected overlay's body or control point overlaps an overlay that follows it in the persisted order
- **THEN** the selected overlay is drawn above that overlay and its interaction figure receives hit-test priority

#### Scenario: A different overlay is hovered
- **WHEN** one overlay is selected and another overlay is hovered
- **THEN** the hovered overlay receives only its visual redraw and the selected overlay remains visually and interactively above it

#### Scenario: Selected overlay is also hovered
- **WHEN** the hovered overlay and selected overlay are the same overlay
- **THEN** the system draws and event-binds that overlay exactly once in the promoted position

#### Scenario: Selection is cleared
- **WHEN** no overlay is selected
- **THEN** completed overlays return to their persisted draw and hit-test order while hover remains visual-only
