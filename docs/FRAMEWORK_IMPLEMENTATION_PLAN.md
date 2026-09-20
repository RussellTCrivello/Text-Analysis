# Internal Frappe-style framework implementation

This project will implement an independent metadata-driven administrative framework. It will not depend on or copy Frappe.

## Completion definition

The work is complete only when the schema is the single source of truth for forms, tables, filters, exports, reports, relationships, workflows, settings, and validation, and the acceptance checks below pass.

## Phases

### 1. Metadata foundation — in progress
- [x] Schema registry for Sources, Contents, Analyses
- [x] Field metadata: type, label, required, searchable, sortable, list, form, filter, export
- [x] Relationship metadata
- [x] Metadata validation
- [x] Generated schema columns
- [ ] Localized labels from i18n rather than generated English labels
- [ ] Metadata tests for every schema field

### 2. Table/list engine
- [x] Column visibility
- [x] Column search
- [x] Column resizing
- [x] Horizontal and vertical scrolling
- [x] Density
- [x] Persistent layout preferences
- [ ] Ordered columns with drag and drop
- [ ] Frozen/pinned columns
- [ ] Multi-column sorting
- [ ] Filter builder with AND/OR groups
- [ ] Saved named list views
- [ ] Schema-driven relationship renderers
- [ ] Export-visible/export-all controls

### 3. Form engine
- [ ] Render field controls from metadata
- [ ] Sections, tabs, and collapsible groups
- [ ] Conditional visibility and required rules
- [ ] Read-only and system-field handling
- [ ] Unsaved-change protection
- [ ] Save-and-new/save-and-continue actions
- [ ] Link search, preview, open, and quick-create
- [ ] Form layout configuration

### 4. General Settings
- [ ] Persist table layouts in application settings
- [ ] Manage list/form/filter/export visibility separately
- [ ] Manage order, width, density, sorting, and default filters
- [ ] Import/export display profiles
- [ ] Reset one table or all layouts
- [ ] Restore settings through backup/restore

### 5. Relationships and actions
- [ ] Human-readable labels with stored IDs
- [ ] Search related records across configured fields
- [ ] Quick-create related record without losing parent form state
- [ ] Related-record preview and navigation
- [ ] Duplicate and conflict warnings
- [ ] Linked-record usage and dependency display

### 6. Workflow and permissions
- [ ] Draft/review/approved/archived states
- [ ] State transitions and validation
- [ ] Role and action permissions
- [ ] Permission-aware fields, records, exports, and reports
- [ ] Workflow audit history

### 7. Reports and workspace
- [ ] Metadata-aware report builder
- [ ] Grouping, aggregation, charts, and saved reports
- [ ] Dashboard cards and related-record summaries
- [ ] Print layouts and configurable report exports

### 8. Quality gates
- [ ] Schema contract tests
- [ ] Form/table/filter/export parity tests
- [ ] Relationship integrity tests
- [ ] Settings round-trip tests
- [ ] Accessibility keyboard tests
- [ ] Import/export round-trip tests
- [ ] Smoke test for every entity and every field

## Non-negotiable design rules

1. Stored IDs and user-facing labels are separate values.
2. Schema metadata is the source of truth; views must not silently invent fields.
3. Presentation settings never mutate records.
4. Every new schema field must be validated and automatically surfaced in applicable UI surfaces.
5. Any feature added to one entity must be tested against all three entities.
6. No feature is described as complete until its tests and reset/backup behavior are complete.
