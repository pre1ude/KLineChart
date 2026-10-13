## ADDED Requirements

### Requirement: One internal point representation
The exported IPoint SHALL contain logicalIndex and value, and SHALL NOT contain dataIndex. Point conversion helpers and drawing projection SHALL use this same representation.

#### Scenario: Convert a point after history loading
- **WHEN** a persisted point is converted to IPoint before and after history is prepended
- **THEN** its logicalIndex is unchanged, no dataIndex field is returned, and converting that IPoint back recovers the same timestamp

#### Scenario: Read an array from internal geometry
- **WHEN** a caller needs a K-line or indicator array element for an IPoint
- **THEN** it converts logicalIndex through TimeIndex at that data-access boundary

### Requirement: Logical viewport state
The chart SHALL maintain internal horizontal viewport state in logical coordinates and derive public array-index ranges at the boundary.

#### Scenario: History is prepended
- **WHEN** eight historical bars are loaded before ten existing bars
- **THEN** an existing logical coordinate 9 remains 9, its array index becomes 17, and the K-line viewport retains its logical range and pixels

#### Scenario: Zoom and resize after loading
- **WHEN** the user scrolls, zooms, or resizes after history loading
- **THEN** coordinate conversion, configured resize anchors, and public visible ranges remain consistent

#### Scenario: Pixel at a bar boundary
- **WHEN** a pixel lies halfway between two bars, including after history loading or with fractional spacing
- **THEN** drawing picking, public pixel conversion, and crosshair picking select the same bar on the right, accounting for floating-point interpolation error

#### Scenario: Initial left alignment with fractional spacing
- **WHEN** the initial K-line viewport is left aligned at fractional bar spacing, history is loaded, and the view is reset
- **THEN** the viewport aligns to the first currently loaded bar instead of retaining the old array start

#### Scenario: Integer visible boundary affected by floating-point round-off
- **WHEN** viewport arithmetic produces a value within floating-point tolerance of an integer boundary, including after history loading
- **THEN** the integer visible-data range excludes bars outside that boundary, and their prices do not enter visible extrema

#### Scenario: Real fractional visible boundary
- **WHEN** the viewport boundary differs from an integer by more than floating-point tolerance
- **THEN** the visible-data range retains normal floor/ceil behavior and continuous coordinate conversion preserves the displacement

### Requirement: Logical drawing interaction
Drawing projection and drag snapshots SHALL use logical coordinates while persisted points and public callbacks retain timestamps and offsets.

#### Scenario: Loading during a drag
- **WHEN** history is prepended or an extending snapshot arrives during a drawing drag
- **THEN** the original logical drag anchors remain valid and movement applies the intended bar displacement without an index-origin jump

#### Scenario: Timeline correction during a drag
- **WHEN** replacement inserts or deletes bars inside the sequence
- **THEN** the drag reprojects its original timestamp anchors into the new logical timeline before applying movement

#### Scenario: Unresolvable drag projection
- **WHEN** a pointer press cannot resolve every drawing anchor
- **THEN** no incomplete drag state is established

#### Scenario: Temporary loss of anchors during a drag
- **WHEN** a timeline replacement makes the original drag anchors unavailable
- **THEN** movement does not modify the drawing, and a later replacement restoring those anchors allows the original drag to continue

#### Scenario: Ordinary pointer movement
- **WHEN** the pointer moves during a drag without a timeline correction
- **THEN** displacement is calculated directly from logical pointer coordinates without converting the pointer to a timestamp and looking it up again

### Requirement: Compatible boundaries and mode policies
Array access, indicator indexing, public data-index APIs, DataZoom percentages, and time-share slot policies SHALL retain their established contracts.

#### Scenario: Mode-specific updates
- **WHEN** data changes in percentage or time-share mode
- **THEN** the mode retains its percentage or calendar policy and logical-to-pixel conversion agrees with public data-index conversion

#### Scenario: Zero-width DataZoom viewport after history loading
- **WHEN** history has been prepended and the DataZoom viewport width becomes zero
- **THEN** its empty logical range uses the current first logical index, its public array-index bounds remain zero, and restoring the width restores the retained percentage range

#### Scenario: Dataset reset
- **WHEN** a new dataset is applied or data is cleared
- **THEN** old drag state is invalidated and logical geometry starts in the new timeline
