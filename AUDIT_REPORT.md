# Text-Analysis — Comprehensive Product Audit

**Date:** 2026-09-20 · **Branch:** `arena/01a0bf2a-text-analysis` · **Baseline:** `60eba80` (main, v2.2.0)
**Scope:** every core module, view, component, dialog, table, form, chart, setting, theme, a11y path, RTL behavior, persistence layer, and Electron surface. Local-first by design — no cloud, no telemetry UI; that boundary was verified intact.

**Method:** per-function source review (≈34.8K LOC, 82 non-test TS/TSX files, 15 test files), EN+AR locale diff, light/dark/high-contrast token trace, keyboard & responsive pass, DOM-level assertions (jsdom), SSR smoke of all 21 pre-existing + 11 newly-added render targets, and the full release gate (`check`, `build`, `smoke:dom`).

**Outcome:** all gates green (134/134 tests, 32/32 SSR smoke targets, DOM check pass, typecheck 0, build ✓). 36 issues identified across the session; 34 fixed and verified, 2 recorded as intentional non-issues with evidence (§Q). 51 files changed, +2,666/−869.

---

## A. Interface inventory (all reviewed, EN + AR)

### Views (9 workspaces)
| View | Surface |
|---|---|
| `DashboardView` | overview band (sparklines, donut mix, deltas), latest activity, workspace health |
| `SourcesView` | table workspace + add/edit form, statistics, advanced search, bulk ops, import/export |
| `ContentsView` | table workspace, preview dialog, attachments, link-to-analysis |
| `AnalysisView` | table workspace, auto-extract, map hand-off, compare, summary |
| `AllDataView` | unified read-only view, type filter, print, generate-report |
| `TimelineView` | event cards, 4 chart modes (type/monthly/weekday/classification), date+text+people+place+class filters, export |
| `ReportsView` | SQL + visual query builder, 14 localized query templates, chart designer, paginated results, HTML report preview, save/load |
| `ActivityView` | audit trail, field-level diffs, undo/redo, CSV export, filter by action/entity/date/text |
| `DictionaryView` | gazetteer CRUD, taxonomy editor, extraction test bench, vocabulary rename/merge |

### Components (28)
AppShell (nav, command bar, global search, quick add, theme/language controls), DataTable, ui (primitives: Btn, Input, Select, Field, InfoModal/ConfirmModal, EmptyState, Badge, Kbd, Callout, ProgressBar, SearchInput, ComboField host, DateTimeInput, Checkbox, RadioGroup, Spinner…), AdvancedSearch, FilterBuilder, BulkOperations, FormModal (+ useFormEngine), FormLayoutEditor, ContentPreviewDialog, ComparisonDialog, SummaryDialog, AttachmentManager, AttachmentField, MetadataField, ComboField, ExportDialog, ImportWizard, BackupDialog, SettingsDialog, ResetDialog, HelpDialog, PerformanceMonitor, PrintHeaderSettings, TimelineExportDialog, Charts (Recharts wrappers), ErrorBoundary, icons (lucide wrappers).

### Electron
`electron/main.cjs` (288 lines), `electron/preload.cjs` (12 lines), `scripts/electron-dev.mjs`, electron-builder config.

## B. Function inventory (all reviewed)

### Core (34 modules + 4 sub-packages)
- **schema.ts** — single registry driving forms, tables, validation, import targets, filters.
- **framework.ts / frameworkMigration.ts** — doc-type metadata, legacy table-preference migration, field sanitization.
- **repository.ts** — CRUD, audit log (capped 2,000, `maxEntries`), undo/redo stacks, integrity checksum, orphans detection.
- **persist.ts** — StorageAdapter abstraction (Memory/LocalStorage), quota-error channel.
- **validation.ts** — schema-driven rules (required, minLength, URL, range, percent reinterpretation, date, unique, FK existence, exact-duplicate).
- **formEngine.ts** — form layout (order/hidden/readOnly), field ranking, issue formatting hooks.
- **filterBuilder.ts** — AND/OR group conditions, 8 operators, validation.
- **search.ts** — cross-field text search incl. joined fields, date-range semantics.
- **sql/** — lexer, parser, executor, engine; 14 query templates with a `localize` hook.
- **timeline.ts** — series aggregation by type/month/weekday/classification.
- **charts.ts** — sparkline buckets, category counts, palettes (default + Okabe–Ito CVD).
- **stats.ts** — aggregates, latest activity, health metrics.
- **export/** — 13 formats (csv, tsv, json, jsonl, xml, html, markdown, xlsx, xls, docx, doc, pdf, txt), DOCX builder, minimal ZIP writer/reader, localized column labels.
- **import/** — RFC 4180 CSV/TSV, JSON, NDJSON, XML, XLSX parsers with line-level problem reporting; pipeline with name→id ref resolution, per-row validation, skip-on-error, single audited transaction.
- **extract/** — gazetteer (kind/country/coords/aliases, builtin protection), taxonomy, coordinates (decimal, DMS, decimal-minutes, hemispheric), dates, engine with confidence + winning classification.
- **print.ts** — document builder bound to user print config (header lines, logo, geometry, footer, doc-number sequence).
- **backup.ts / attachments.ts / audit.ts / appInfo.ts / text.ts / datetime / vocabulary / tableLayout / data / index** — backup envelopes (audit travels inside), IndexedDB attachment store, audit actions enum, version injection, text utilities.

## C. Per-issue findings (status per issue)

Format: **ID · area · finding · status · evidence.** "Fixed" means code changed **and** verified by the green gate in §P.

| ID | Area | Finding | Status |
|---|---|---|---|
| F-01 | core/timeline | Weekday series used `days.map` over a constant while the parameter was `dayNames` — chart labels desynced when the caller passed locale names | Fixed + verified (tests + TimelineView smoke) |
| F-02 | core/sql | `queryTemplates` returned English labels with no localization path | Fixed + verified (`localize?` hook, wired in ReportsView) |
| F-03 | i18n | Hardcoded `WEEKDAYS`/weekday names leaked into Timeline charts | Fixed + verified (`t.sections.timeline.weekdays` EN+AR) |
| F-04 | core/formEngine | `required` error message emitted raw English | Fixed + verified (display-layer formatting) |
| F-05 | core/validation | Validation messages embedded raw field keys (`importance …`) shown verbatim in AR sessions | Fixed + verified (code-based `formatValidationIssue`, 10 templates EN+AR) |
| F-06 | core/repository | `allRecords` typing + `resolveRef` folding gaps | Fixed + verified (tests) |
| F-07 | core/formEngine | `formFields` ordering non-deterministic across layouts | Fixed + verified (rank helper) |
| F-08 | framework | `labelFor` English-only fallback surfaced in tables/forms | Mitigated at DataTable + SourcesView labels; documented in §Q |
| F-09 | core/extract | `sentenceAround` window broke on non-ASCII boundaries | Fixed + verified |
| F-10 | components/FilterBuilder | Validation failed **silently** (`if (errors.length) return`); all labels/buttons/placeholder English | Fixed + verified (localized fields/operators/buttons; inline `role="alert"` row errors; stale markers cleared on edit) |
| F-11 | core/filterBuilder | `validateFilter` English messages unreachable from UI locale | Fixed + verified (optional message factory; EN fallback preserved; tests unchanged-green) |
| F-12 | components/ContentPreviewDialog | Entire dialog English (title, eyebrow, buttons, metadata labels, empty states, aria) | Fixed + verified |
| F-13 | components/AttachmentManager | Search placeholders, type/sort selects, "Files —", "(untitled)", legacy-referenced note, "refreshed" all English | Fixed + verified (14 new keys EN+AR) |
| F-14 | components/SummaryDialog | All labels English | Fixed + verified |
| F-15 | components/FormLayoutEditor | Hint, move buttons (aria+title), Show/Read-only, Reset English; framework labels unlocalized | Fixed + verified |
| F-16 | components/ComparisonDialog | Column headers, title, hint, empty text English | Fixed + verified |
| F-17 | components/HelpDialog | 11 topics of help documentation English-only, incl. placeholder interpolation of app name/version | Fixed + verified (full AR translation; `{app}`/`{version}` substitution asserted in a dedicated SSR probe — zero unsubstituted tokens in EN+AR) |
| F-18 | components/PerformanceMonitor | Entire diagnostics dialog English (stats, benchmark table, recommendations) | Fixed + verified (entity names mapped through `t.nav`) |
| F-19 | components/PrintHeaderSettings | Entire dialog + toasts English | Fixed + verified |
| F-20 | components/ResetDialog | Entire confirm dialog English | Fixed + verified |
| F-21 | components/ImportWizard | Stepper `aria-label="Import progress"`; success screen "N inserted / N issues" + transaction note English | Fixed + verified |
| F-22 | views/DictionaryView | Gazetteer/taxonomy/vocabulary placeholders ("Tikrit", "Iraq", "e.g. satellite feed", "comma, separated, keywords", "Filter gazetteer…"), "New category" default English | Fixed + verified |
| F-23 | components/ExportDialog | Format buttons rendered English `FORMAT_META` labels | Fixed + verified (`dialogs.exportDialog.formatNames` map, 13 formats EN+AR) |
| F-24 | components/BulkOperations | "Field to set", "New value", percent hint English | Fixed + verified |
| F-25 | components/ComboField | `aria-label` "Expand/Collapse options" English | Fixed + verified |
| F-26 | components/BackupDialog | Language-sniffing hack: `t.fields.name === "Name" ? "Sources" : t.nav.sources` | Fixed + verified (direct `t.nav.sources`) |
| F-27 | components/SettingsDialog | Language-sniffing hack for "Last saved " prefix | Fixed + verified (`t.backup.lastSaved`) |
| F-28 | 5 views | Print subtitles `type:` / `search:` prefixes English (AllData, Sources, Analysis, Contents) | Fixed + verified (`t.messages.printType/printSearch`) |
| F-29 | a11y/settings | **Color-blind mode was a dead setting**: `data-color-blind` set on `<html>` but zero CSS consumed it; charts used the default palette regardless | Fixed + verified (Okabe–Ito semantic remap for light+dark × deuteranopia/protanopia/tritanopia; CVD palette in `paletteFor(value, mode)` wired to all 3 call sites; new unit test) |
| F-30 | store/AppContext | `createBackup` audit entry used `action: "restore"` — polluted the audit trail | Fixed + verified |
| F-31 | components/AppShell | Theme ToggleChip rendered the raw setting value (`"dark"`/`"light"`); nav + breadcrumb aria English literals | Fixed + verified (harness still matches `aria-label="Main navigation"`) |
| F-32 | docs | README "Production — v2.1.0" stale vs package.json 2.2.0 (and CHANGELOG 2.2.0) | Fixed (README → v2.2.0) |
| F-33 | i18n/ar | Broken translation `resetDefaults: "إعادة لل defaults"` (mixed-language) | Fixed + verified |
| F-34 | components/ExportDialog | Browser-blocked-download error thrown as English literal | Fixed + verified |
| F-35 | scripts/dom-check | No-results expectation stale after F-series fix (harness pinned to old string) | Fixed (expectation updated to the corrected product string; assertion not relaxed) |
| F-36 | core/appInfo | Doc comment example pinned to v2.1.0 | Fixed |

## D. Design system
- Single token source of truth: `src/index.css` — ≈340 custom properties; light is default, `.dark` overrides the same names; `.high-contrast` (+ dark variant) re-maps borders/muted text. No view hard-codes a colour (verified by sweep; chart components consume `var(--*)`).
- Brand: "Graphite & Iris" — layered surfaces, iris→sky gradient signature, ambient washes, table micro-tokens, focus ring token.
- Typography: Plus Jakarta Sans (display) / Inter (body) / JetBrains Mono (data), Google Fonts with system-font degradation (documented; CSP allows only fonts.gstatic).
- Consistent primitives in `ui.tsx`; iconography via lucide wrappers only (DOM check asserts no text-glyph icons).
- **Change:** Okabe–Ito colour-blind-safe semantic palettes added to the token layer (F-29).

## E. Accessibility
- DOM harness asserts: **no unlabeled icon-only buttons**, no text-glyph icons, error-boundary recovery affordances, RTL switch.
- Keyboard: Ctrl+1–8 workspace nav, Ctrl+N quick add, Ctrl+K command search, F1 help, Escape closes all modals (verified per-component), focus-visible rings with an **enhanced** mode (`data-focus-indicator`).
- Screen reader: toast via live region (setting-gated); `role="alert"` on new FilterBuilder row errors; `aria-current="step"` on import stepper; all dialogs labelled.
- High-contrast mode: functional in light + dark.
- **Color-blind mode: now functional** (was dead — F-29). Red/green and blue-yellow alternatives per Okabe–Ito in both themes; charts follow.
- Remaining: §Q-1 (labelFor fallback).

## F. i18n (EN + AR)
- Architecture: `LanguageProvider` + `TranslationShape` (typed from `en`) — **AR key completeness is compile-enforced**; a structural diff (1,026 EN keys) shows zero missing AR keys.
- Conventions: `{n}`-style placeholders substituted at the display layer; core modules stay string-free except for stable English fallbacks (SQL identifiers, storage keys).
- Display-layer localizers: `formatValidationIssue` (code-based, 10 templates), `queryTemplates(db, localize)`, `validateFilter(entity, cond, messages)`, `t.fields` mapping for framework metadata labels, `dialogs.exportDialog.formatNames`.
- Sweeps after fixes: no uppercase-starting JSX text nodes, no multi-word attribute strings, no lowercase JSX text runs remain in `src/views` + `src/components` (grep-verified).
- Verified AR-specific: RTL sets `dir="rtl"` (DOM check), AR smoke targets render (dictionary:ar, activity:ar, attachments:ar, filterBuilder:ar, help:ar, performanceMonitor:ar, printHeader:ar), and the one broken AR string found (F-33) was fixed.

## G. RTL
- `html[dir]` set from language (SettingsContext effect); logical properties used for directional layout (`borderInlineStart/End`, `text-start`, `rounded-e`).
- CSS mirrors directional icons (`[dir="rtl"] .lucide-chevron-left/right, arrow-left/right`) and the nav active indicator radius.
- AR smoke + DOM "arabic sets RTL" check green; AR help/performance/print targets render at comparable size to EN (no overflow-truncation failures).

## H. Themes
- Light / Dark / High-contrast all driven by one token sheet; theme toggle in the shell is now translated (F-31).
- Color-blind remaps layer on top of both light and dark (F-29).
- Focus halo setting independent of theme; font scale (`--app-font-scale`) and base font size (`html { font-size }`) independent of theme.

## I. Responsive
- Breakpoint passes in all views (command search collapses to icon under `lg`, grids `grid-cols-2 sm:grid-cols-4`, tables scroll within fixed-height containers, dialogs `size` variants).
- Table density setting (comfortable/compact) global; compact reused in dialog tables (compare, performance).
- Mobile: touch targets ≥ 32px on primary controls; step labels hidden below `sm` in the import stepper (state remains visible via check/number).

## J. Persistence
- `tam_data` (records+audit), `tam.backups.v3`, `tam.knowledge.v3`, `tam.searches`, `tam_settings` in localStorage; attachment **bytes** in IndexedDB (never in localStorage).
- Quota failures reported to subscribers instead of thrown (3 dedicated tests); storage-full banner with actionable copy.
- Auto-save (immediate) + background flush interval (10–300 s, validated); undo/redo depth tracked and shown in Performance Monitor.
- Integrity checksum computed over the dataset; orphans surfaced as recommendations.
- Backups: create/restore with audit action distinction (F-30), envelope carries the audit trail, last-saved timestamp now localized (F-27).
- Desktop: `userData` pinned to `Text Analysis` so rebranding never orphans records; smoke probe asserts localStorage + IndexedDB persistence markers.

## K. Tables
- `DataTable`: sortable columns (localized `aria-sort`/`labelFor` mitigation), column filter inputs (searchable dropdown for refs), density, column resize (localized aria), persisted per-entity layout (order/hidden/widths) with legacy migration, compact mode for dialogs.
- RTL-safe header alignment; empty states and no-filter-match states localized (F-35 harness update reflects the corrected product string "No records match the current filters.").
- Bulk selection action bar with localized operations (F-24).

## L. Forms
- Schema-driven form engine: layout order/hidden/read-only persisted per entity (FormLayoutEditor now fully localized, F-15); field ranking deterministic (F-07).
- Validation display fully localized incl. percent-reinterpretation warnings (F-05); duplicate/FK/URL/required/minLength/duplicate all template-mapped.
- Controls: ComboField (aria fixed, F-25), MetadataField, DateTimeInput, AttachmentField — all localized and smoke-covered (EN+AR where content differs).
- Percent fields: raw ">1" input read as percentage with an explicit localized warning (no silent data change).

## M. Search
- Command bar global search feeds All Data live (real-time, section auto-switch).
- Per-workspace: text (case-insensitive, all fields incl. joined) + date range (default today−1y; undated rows kept — documented in Help).
- Advanced Search: 10+ operators, AND/OR, saved searches + history, SQL hand-off to Reports; localized (verified in smoke).
- FilterBuilder: multi-group AND/OR, 8 localized operators, inline localized validation (F-10/F-11).

## N. Import / Export
- Import: 6 parse formats with format auto-detection (content beats extension), RFC 4180 + BOM, line-level problem counts, column mapping, name→id FK resolution, per-row validation, skip-on-error checkbox, single audited transaction; success/partial copy localized (F-21).
- Export: 13 formats, column selection, ID/date inclusion toggles, live preview, localized format names (F-23) and field labels at export time (active language), filename/destination copy localized, browser-block handling localized (F-34).
- Backup/restore round-trip covered by tests; attachment bytes round-trip in the store (IndexedDB) — verified by smoke.

## O. Electron
- Security posture verified line-by-line: sandboxed renderer, `contextIsolation` on, `nodeIntegration` off (incl. workers/subframes), **no IPC** — preload exposes only `{isDesktop, platform, versions}`; CSP attached to every HTML response; navigation locked to `app://`; `window.open` deny-by-default (http(s)→OS browser, same-origin blob for previews); webview attach prevented; permission requests denied except `clipboard-sanitized-write`; single-instance lock; `userData` pinned.
- Production origin: custom privileged `app://` scheme (stable secure origin for localStorage/IndexedDB — the reason for `file://` abandonment documented in `docs/DESKTOP.md`).
- CI headless smoke (`--smoke-test`): asserts origin, React mount, CSS, **no Node-global leaks**, preload surface, secure context, localStorage + IndexedDB markers.
- Packaging: electron-builder config present (NSIS). **Not executed in this sandbox** (Electron binary download is network-blocked here; install uses `ELECTRON_SKIP_BINARY_DOWNLOAD=1`). Gate status for the Windows installer therefore remains "covered by CI, not re-verified in-session" — see §Q-3.

## P. Validation results (final gate, all after last code change)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit` | **0 errors** |
| Unit tests | `node --test src/core/**/*.test.ts` | **134/134 pass, 0 fail** (133 baseline + 1 new CVD palette test) |
| SSR smoke | `scripts/smoke.tsx` | **PASS — 32/32 targets** (21 baseline + 11 added: help±ar, performanceMonitor:ar, printHeader:ar, reset, summary, comparison, filterBuilder±ar) |
| DOM check | `scripts/dom-check.tsx` | **DOM CHECK PASS** (nav, tables, filters, a11y assertions, RTL, error boundary) |
| Build | `vite build` | **✓ 867 ms**, 6 chunks |
| Placeholder probe | ad-hoc SSR render of HelpDialog EN+AR | **0 unsubstituted tokens** (`{app}`/`{version}`/all 13 placeholder classes checked) |
| Electron packaging | `electron-builder` | not run in sandbox (network-blocked binary) — CI-gated, §Q-3 |

## Q. Remaining issues / documented non-issues

1. **`framework.labelFor` English fallback** (mitigated, not eliminated): framework metadata labels are English at the source; every *user-visible* consumer (DataTable, SourcesView, BulkOperations, FormLayoutEditor, FilterBuilder, ContentPreviewDialog, ComparisonDialog) now maps through `t.fields` first. A non-dictionary field key would still fall back to English. Residual risk: low (schema keys ⊂ `t.fields`), full fix requires making framework metadata locale-aware — flagged as a future hardening, not a current defect.
2. **`stats` coverage + timeline narrative strings** are dead, unrendered surfaces (no component consumes them). Left in place; documented so a future reviewer doesn't chase them.
3. **Electron directory packaging / Windows installer** is not re-verifiable in this sandbox (Electron binary download blocked). The code-level desktop smoke harness (`--smoke-test`) is intact and CI-gated.
4. **Legacy `importance/5` rescale** in migration code is *suspect* (odd scale) but predates this audit and has no user-visible defect evidence; deliberately **not changed** without a reproduction. Flagged for a targeted follow-up with a legacy-dataset sample.
5. **Intentionally untranslated (not defects):** format acronyms (CSV/JSON/XML/HTML/PDF/Excel/Word), `Ctrl K` key notation, coordinate sample values (`34.5983`), `DOC` prefix sample, `RESET` confirmation token, storage keys, SQL identifiers. Gazetter *example* placeholders are localized per locale ("Tikrit" EN / "تكريت" AR).
6. **Google Fonts** external dependency: documented degradation to system fonts when offline; CSP restricts to the two font hosts. Product decision, kept.

---

### Change summary (51 files, +2,666/−869)
- **i18n:** +≈420 new keys across EN and AR (filter builder, content preview, attachments, summary, layout editor, comparison, help×11 topics, performance monitor, print header, reset, import wizard, dictionary, export formats, bulk ops, validation templates, print subtitles, shared aria).
- **Core:** `timeline.ts`, `sql/engine.ts`, `filterBuilder.ts` (message factory), `charts.ts` (CVD palette + `ColorBlindMode`), `appInfo.ts` doc.
- **Components:** 16 files touched (FilterBuilder rewrite incl. inline errors, HelpDialog rewrite, PerformanceMonitor/PrintHeaderSettings/ResetDialog/SummaryDialog/ComparisonDialog/ContentPreviewDialog/FormLayoutEditor/AttachmentManager localization, ComboField/BackupDialog/SettingsDialog/BulkOperations/ExportDialog/ImportWizard fixes).
- **Views:** 5 views (print subtitles), 3 views (CVD palette wiring), DictionaryView (placeholders + new-category default).
- **Store:** AppContext audit action fix; SettingsContext unchanged (already correct).
- **Styles:** index.css +≈45 lines (color-blind semantic remaps, light+dark).
- **Tests/harness:** charts.test.ts +1 test; smoke.tsx +11 targets; dom-check.tsx expectation corrected.
- **Docs:** README version synced to v2.2.0.
