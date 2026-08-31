## ADDED Requirements

### Requirement: Pane-owned ID-addressable Y axes
Each drawable pane SHALL manage Y axes by stable unique ID and SHALL support more than one visible axis on the same side.

#### Scenario: Create two right-side axes
- **WHEN** a caller creates `nvda_axis` and `msft_axis` in the candle pane with position `right`
- **THEN** both axes exist simultaneously and are returned by axis queries in creation order

#### Scenario: Preserve compatibility axes
- **WHEN** a caller does not specify `yAxisId`
- **THEN** the pane resolves the existing left/right/default axis behavior from current styles and `yAxisPosition`

### Requirement: Y-axis lifecycle API
The chart SHALL expose additive APIs to create, query, override, hide/show, and remove Y axes by pane and ID.

#### Scenario: Hide and show an axis widget
- **WHEN** `overrideYAxis` sets `needWidget` to `false` and later to `true`
- **THEN** the axis is respectively excluded from and restored to layout/rendering without changing its ID or insertion order

#### Scenario: Protect a used axis
- **WHEN** `removeYAxis` targets a default candle axis or an axis still bound by an indicator
- **THEN** the chart refuses to remove that axis

#### Scenario: Remove an unused non-default axis
- **WHEN** `removeYAxis` targets a non-default axis with no indicator binding
- **THEN** the widget is destroyed and subsequent queries no longer return it

#### Scenario: Preserve an explicitly created axis
- **WHEN** an indicator binds to an axis created through `createYAxis` and is later removed
- **THEN** the axis remains until the caller explicitly removes it with `removeYAxis`

### Requirement: Indicator-to-axis binding
An indicator SHALL bind to one Y axis through `yAxisId`, with `yAxisPosition` retained as a compatibility fallback.

#### Scenario: Render indicators on independent axes
- **WHEN** NVDA and MSFT indicators in the candle pane bind to different right-side axis IDs
- **THEN** each indicator uses its bound axis for all value-to-pixel conversion

#### Scenario: Rebind an indicator
- **WHEN** `overrideIndicator` changes an indicator's `yAxisId`
- **THEN** subsequent range calculation, drawing, latest-value labels, and custom tooltip callbacks use the new axis

### Requirement: Axis-specific automatic range
Each Y axis SHALL calculate its automatic range only from the candle/default data assigned to that axis and visible figures of indicators resolved to that axis.

#### Scenario: Three price ranges remain isolated
- **WHEN** AAPL candles, an NVDA line, and an MSFT line use three distinct axes
- **THEN** each axis range is derived from only its associated asset values in the visible X range

#### Scenario: Default grid follows the main asset
- **WHEN** additional indicator axes exist in the candle pane
- **THEN** horizontal grid lines continue to use the pane's main/default AAPL axis ticks

### Requirement: Multiple-axis layout
The chart SHALL lay out visible Y-axis columns on each side in creation order and SHALL reserve the sum of outside-axis widths from the main drawing area.

#### Scenario: Left main axis and two right axes
- **WHEN** the AAPL default axis is on the left and NVDA/MSFT axes are visible on the right
- **THEN** AAPL occupies the left column while NVDA and MSFT occupy consecutive right columns and the main area does not overlap them

#### Scenario: Hidden axis releases width
- **WHEN** one right-side axis is hidden with `needWidget: false`
- **THEN** its column is removed and the main drawing area expands accordingly

### Requirement: Axis-aware labels, tooltips, conversion, and interaction
Axis-dependent views and interactions SHALL operate on the exact Y-axis widget or ID being rendered or manipulated.

#### Scenario: Latest-value labels stay on their axes
- **WHEN** NVDA and MSFT have different latest values and colors
- **THEN** each latest-value label is rendered only on its bound axis using its indicator figure color

#### Scenario: Convert with an axis ID
- **WHEN** a caller converts a value with a `paneId` and `yAxisId`
- **THEN** the chart uses that axis range for pixel conversion while continuing to accept `yAxisPosition` for compatibility

#### Scenario: Manipulate one ID-addressed axis
- **WHEN** a user drags, zooms, or double-clicks an additional non-compatibility axis
- **THEN** only that targeted axis is scaled or reset and live indicator updates do not reset its manual range

#### Scenario: Manipulate either compatibility axis
- **WHEN** both built-in compatibility axes are visible and the user drags, wheel-zooms, or double-clicks either side
- **THEN** both compatibility ranges stay synchronized and the main series responds as if its configured main axis had been manipulated

#### Scenario: Resize with manual ranges
- **WHEN** the chart is resized after one or more Y axes have been manually manipulated
- **THEN** every manual axis retains its numeric range while automatic axes continue recalculating for the new bounds

### Requirement: Orphan-axis cleanup
The chart SHALL remove a non-default axis that it created implicitly for an indicator after that axis loses its last binding, while preserving axes explicitly created by callers.

#### Scenario: Remove a comparison indicator
- **WHEN** the only indicator bound to `nvda_axis` is removed
- **THEN** `nvda_axis` is removed while the default AAPL axis and other comparison axes remain

### Requirement: Pane-scoped indicator removal
The object form of indicator removal SHALL require a pane ID and SHALL select indicators by either exact ID or name within that pane.

#### Scenario: Remove by indicator ID
- **WHEN** `removeIndicator` receives `{ paneId, id }`
- **THEN** only the indicator with that ID in the specified pane is removed

#### Scenario: Remove by indicator name
- **WHEN** `removeIndicator` receives `{ paneId, name }`
- **THEN** every indicator with that name in the specified pane is removed without affecting other panes
