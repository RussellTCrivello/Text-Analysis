# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] — 2026-09-18 — Front-end modernization (PR #2)

A presentation-layer program of work: the entire UI was rebuilt onto a
cohesive design system, a new Dashboard section was added, and three
functional bugs were fixed along the way. No data model, validation rule
or workflow was changed.

### Added
- **Dashboard section** as the new landing view: record KPIs with 30-day
  sparklines and weekly deltas, stacked creation-momentum area chart,
  source-mix donut with share legend, data-coverage & quality panels
  (linked / attached / analyzed coverage, orphaned-analysis detector),
  most-used-sources ranking, and a live audit-trail feed — every number
  derived from real workspace records, every action navigating to real
  state, with an honest first-run empty state.
- **Per-column filter rows** on the Contents and Analysis grids; filters
  match displayed values and compose with global search, type and date
  filters; cleared by the shared *Clear Filters* action.
- Analysis workspace now **leads with the owning Source and Content
  titles** (derived, read-only), and exports/print carry the names.
- Import: **byte-sniffed format detection** (content over extension),
  JSON wrapper-key support (`records` / `data` / `items` / `rows`), and a
  fast, explained failure for legacy `.xls`.
- `docs/DESIGN_SYSTEM.md` — the component & token system spec; thin
  `charts.ts` test suite; expanded SSR smoke + behavioral DOM harness
  (42 checks) wired as repo gates (`npm run check`, `npm run smoke:dom`).

### Fixed
- **Attachments could not be opened or downloaded** — the IndexedDB store
  read the wrong record field.
- **Exported .docx files did not open in Word** — OOXML packaging fixed
  (DEFLATE zip write-back, duplicate-field mapping), and the Word export
  reworked into a structured, table-free document.
- Hard-coded English strings in several controls (advanced-search clear,
  preview labels, "Now") routed through the i18n dictionaries (EN + AR).

### Changed
- **Authoritative Lucide icon system** application-wide; every icon-only
  control gained aria-label, tooltip, keyboard access, focus ring and a
  ≥28px hit area; no text glyphs used as interface icons anywhere.
- **Redesigned workflows:** Export, Backup/Restore, Settings, Import
  Wizard, Advanced Search, Help.
- **Design language "Graphite & Iris":** abyss-navy dark theme, one
  controlled brand gradient, layered surfaces, refined motion cadence
  (reduced-motion honored), 13.5px typographic base.
- **Premium card composition for the table workspaces** (Sources,
  Contents, Analysis, All Data): command rail + filter rail + grid +
  preview + pagination on one framed workspace card floating on the
  canvas, replacing stacked full-bleed bands.
- **Unified control system** as CSS component classes (`.ctrl`,
  `.fgroup`, `.row-cb`, …): one 32px height/radius/border/state scale for
  inputs, selects, search boxes, date groups, per-column filters and
  combo boxes; real hover/focus/disabled/error treatment everywhere.
- Modern 18px checkboxes with a true indeterminate header state; calm
  semantic badge chips; refined importance bars and a grouped
  number + slider + readout control in forms.
- Sentence-case grid typography on a deliberate scale; 12px gutter
  alignment between rails and cells; segmented pagination cluster with
  filled active-page pill and borderless page-size select.
- **Add Source & entity dialogs:** dedicated 760px form canvas with
  captioned field sections, cohesive grouped date/time control with
  inline "Now" utility, restrained secondary Cancel vs primary Save.
- Color communicates weight: soft-tinted destructive actions in
  toolbars; solid red reserved for confirmation CTAs; theme-aware
  warning banners; thin scrollbars, brand-tinted selection, primary caret.

## [1.0.0] — 2026-08 (baseline)

- Local-first text-analysis workspace: Sources / Contents / Analysis
  grids with search, vocabularies, audit trail, timeline, reports with
  SQL translation, Word/CSV/JSON export, JSON backup round-trip,
  undo/redo, English + Arabic (RTL), density & accessibility settings.
