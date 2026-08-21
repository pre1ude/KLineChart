## ADDED Requirements

### Requirement: Fixed-thickness OHLC strokes
The chart SHALL render the OHLC center line, open tick, and close tick as filled rectangles that are each exactly 1 CSS pixel thick regardless of candle width or device pixel ratio. The three rectangles SHALL be adjacent and SHALL NOT overlap. Main-chart OHLC mode and indicator-pane OHLC rendering SHALL use the same geometry.

#### Scenario: Zoom into a wide OHLC bar
- **WHEN** center-to-center bar spacing increases
- **THEN** the center-line width and open/close tick heights remain exactly 1 CSS pixel

#### Scenario: Render OHLC in an indicator pane
- **WHEN** a visible indicator requests OHLC rendering in its pane
- **THEN** its center line and open/close ticks use the same one-pixel geometry as main-chart OHLC mode

### Requirement: Lightweight Charts tick length
The chart SHALL calculate each visible open/close tick length from center-to-center bar spacing using the Lightweight Charts thin-bar steps. It SHALL calculate `barWidth` as `max(1, floor(barSpacing * 0.3))`, decrement an even `barWidth` of at least 2 so it has the same odd parity as the one-pixel center line, and calculate `tickLength` as `ceil(barWidth * 1.5)`. The open tick SHALL extend left from immediately outside the center line and the close tick SHALL extend right from immediately outside the center line.

#### Scenario: Render the default spacing step
- **WHEN** center-to-center bar spacing is 8 CSS pixels
- **THEN** each open/close tick has 2 visible CSS pixels outside the center line

#### Scenario: Cross the five-pixel tick threshold
- **WHEN** center-to-center bar spacing is 10 CSS pixels
- **THEN** each open/close tick has 5 visible CSS pixels outside the center line

#### Scenario: Cross the eight-pixel tick threshold
- **WHEN** center-to-center bar spacing is 17 CSS pixels
- **THEN** each open/close tick has 8 visible CSS pixels outside the center line

### Requirement: Narrow OHLC degradation
The chart SHALL omit the open and close ticks when the candle entity width is exactly 1 CSS pixel and SHALL still render the one-pixel center line. For every entity width greater than 1 CSS pixel, the chart SHALL render both ticks using the stepped length even when the resulting OHLC bar extends outside the entity width.

#### Scenario: Render a one-pixel entity
- **WHEN** `gapBar` is 1 CSS pixel
- **THEN** only the one-pixel center line is rendered

#### Scenario: Render a three-pixel entity
- **WHEN** `gapBar` is 3 CSS pixels and the stepped tick length is 2 CSS pixels
- **THEN** both ticks are rendered at their full two-pixel length even though the complete OHLC geometry is 5 CSS pixels wide

### Requirement: Flat and extreme-price OHLC visibility
The chart SHALL render the center line with a minimum height of 1 CSS pixel. It SHALL place open and close ticks on rows occupied by the center line, including when either price equals high or low.

#### Scenario: Render a flat OHLC bar
- **WHEN** high and low convert to the same Y coordinate
- **THEN** the chart renders at least a 1×1 CSS pixel center mark and attaches both visible ticks to that row

#### Scenario: Render ticks at high and low
- **WHEN** open or close converts to the center line's top or bottom boundary
- **THEN** the corresponding tick remains within the center line's occupied pixel span
