## ADDED Requirements

### Requirement: Six-color default indicator line palette
The system SHALL provide six distinct colors in the shared default indicator line palette and SHALL preserve the order and values of the existing first five colors.

#### Scenario: Read default indicator line styles
- **WHEN** a consumer reads the default indicator styles
- **THEN** the `lines` array contains six entries with six distinct colors

#### Scenario: Preserve existing line colors
- **WHEN** the shared default indicator line palette is extended
- **THEN** its first five colors remain `#FDD75D`, `#FF9379`, `#0BE6CE`, `#CF8FFF`, and `#23B6FF` in that order

#### Scenario: Resolve six line figures
- **WHEN** an indicator renders six line figures using the shared default styles
- **THEN** each figure resolves to a different palette entry without requiring an indicator-specific color override
