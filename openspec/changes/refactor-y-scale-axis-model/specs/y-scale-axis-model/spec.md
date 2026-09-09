## ADDED Requirements

### Requirement: Pane-scoped Y scales
Each drawable pane SHALL own ID-addressable Y scales that exclusively manage value range, scale mode, ticks, automatic scaling, and value/pixel conversion.

#### Scenario: Create independent scales
- **WHEN** a caller creates `price` and `volume` scales in one pane
- **THEN** each scale retains independent range, mode, ticks, and interaction state

#### Scenario: Keep a scale without an axis
- **WHEN** a scale has a bound indicator but no visual axis references it
- **THEN** the indicator continues rendering with that scale and no Y-axis widget is displayed

### Requirement: Visual axes reference scales
Each visual Y axis SHALL reference exactly one existing Y scale, and any number of visual axes in the same pane SHALL be allowed to reference that scale.

#### Scenario: Render one scale on both sides
- **WHEN** left and right Y axes both reference the `price` scale
- **THEN** both axes render the same scale mode, range, and tick coordinates at their configured positions

#### Scenario: Reject a missing scale
- **WHEN** a caller creates a Y axis with a `yScaleId` that does not exist in its pane
- **THEN** creation fails without implicitly creating a scale

### Requirement: Scale-based indicator binding
Each indicator SHALL bind to exactly one Y scale through `yScaleId`, with an omitted binding resolved and stored from the pane default scale when the indicator is created.

#### Scenario: Bind explicitly
- **WHEN** an indicator is created with `yScaleId: "volume"`
- **THEN** its range contribution, drawing, labels, and tooltip callbacks use the `volume` scale

#### Scenario: Resolve the default once
- **WHEN** an indicator omits `yScaleId`
- **THEN** the pane default scale ID is stored on the indicator and later axis placement changes do not migrate it

#### Scenario: Reject an unknown binding
- **WHEN** an indicator explicitly references a missing scale
- **THEN** indicator creation fails without creating an axis or scale

### Requirement: Shared scale interaction
Dragging, wheel-zooming, or resetting a visual Y axis SHALL mutate only its referenced scale, and every other axis referencing that scale SHALL reflect the resulting state.

#### Scenario: Drag either shared axis
- **WHEN** left and right axes reference `price` and the user drags either one
- **THEN** `price` is changed once and both visual axes redraw from the same resulting range

#### Scenario: Preserve independent scales
- **WHEN** a different axis references `volume`
- **THEN** interacting with a `price` axis does not change `volume`

### Requirement: Scale-specific automatic range
Each Y scale SHALL calculate its automatic range from visible indicators bound to that scale, with canonical candle data contributing only to the pane default candle scale.

#### Scenario: Isolate comparison assets
- **WHEN** AAPL candles, NVDA, and MSFT indicators bind to three scales
- **THEN** each scale derives its range only from its assigned data in the visible X range

#### Scenario: Build shared ticks once
- **WHEN** multiple visible axes reference the same scale during layout
- **THEN** the scale range and ticks are calculated once and reused by all referencing axes

### Requirement: Independent scale and axis lifecycle
The chart SHALL expose separate lifecycle APIs for Y scales and visual Y axes.

#### Scenario: Remove one visual position
- **WHEN** one of two axes referencing `price` is removed
- **THEN** the `price` scale, its bound indicators, and the remaining axis are unaffected

#### Scenario: Protect an in-use scale
- **WHEN** scale removal targets the pane default scale, a scale referenced by an axis, or a scale bound by an indicator
- **THEN** removal is refused

#### Scenario: Preserve removal constraints through internal entry points
- **WHEN** scale removal is invoked directly on the pane that owns the scale
- **THEN** the same default, axis-reference, and indicator-binding protections are enforced

### Requirement: Scale-explicit conversion
Coordinate conversion SHALL select a Y scale by `yScaleId` and SHALL use the pane default scale when the field is omitted.

#### Scenario: Convert with a scale ID
- **WHEN** a caller converts a value with `paneId` and `yScaleId: "price-log"`
- **THEN** the `price-log` transform and range determine the pixel coordinate

### Requirement: Axis topology is not style state
Y-axis position SHALL be configured on each visual Y axis, and global Y-axis styles SHALL NOT select left, right, both, or a main axis.

#### Scenario: Move a visual axis
- **WHEN** a caller changes an axis position from left to right
- **THEN** the same axis continues referencing the same scale and no indicator binding changes

### Requirement: Scale semantics use scale terminology
Public transform types, custom transform registration, and internal transform implementations SHALL use Y-scale terminology, while Y-axis terminology SHALL be reserved for visual rulers.

#### Scenario: Select a transform type
- **WHEN** a caller creates a normal or logarithmic Y scale
- **THEN** the caller selects the mode through `YScaleType` rather than a visual-axis type

### Requirement: Axis-specific label projection
Each visual Y axis SHALL project the canonical real values of its referenced scale through its own `labelDisplay` without changing scale range, tick coordinates, conversion, or interaction state.

#### Scenario: Show price and percentage for one scale
- **WHEN** left and right axes reference the same normal price scale, the left axis uses value display, and the right axis uses percentage display
- **THEN** both axes share identical tick coordinates and interaction state while the left labels show prices and the right labels show changes from the visible first close

#### Scenario: Show minute percentage for one scale
- **WHEN** an axis uses minute-percentage display
- **THEN** its labels use the chart's minute percentage basis while its referenced scale retains its own transform and range

#### Scenario: Share drag state across different displays
- **WHEN** two axes with different label displays reference one scale and either axis is dragged, wheel-zoomed, or reset
- **THEN** the scale is mutated once and both axes redraw their respective labels from the resulting shared state

#### Scenario: Default to canonical values
- **WHEN** an axis is created without `labelDisplay`
- **THEN** it displays canonical values
