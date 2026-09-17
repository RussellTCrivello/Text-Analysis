# Text Analysis

A local-first workspace for structured text analysis: track **Sources**, capture **Contents**, record **Analysis** against them, and explore it all through dashboards, timelines, reports and a live audit trail. Built as a single-page React application — every record stays on your machine.

## What it does

| Area | Highlights |
|---|---|
| **Dashboard** (landing) | Record KPIs with real 30-day sparklines, stacked creation-momentum chart, source-mix donut, coverage & data-quality panels (linked / attached / analyzed, orphan detector), most-used sources, live audit feed. Every panel action navigates into the owning workspace. |
| **Sources** | Registry of origin documents with type vocabulary, importance, provenance fields, duplicate detection, per-record attachments reference and a full-text preview strip. |
| **Contents** | The text payloads themselves — JSON wrapper-aware import (`.json`, `.txt`, `.md`, `.csv`, `.docx`, legacy `.xls` rejected fast with guidance), attachment manager (open/download via IndexedDB), per-column filters, global search over displayed values. |
| **Analysis** | Findings linked to Contents with derived, read-only Source columns; classification vocabulary; names flow into exports and print. |
| **All Data** | Cross-record search & grid over everything, saved advanced search, bulk operations. |
| **Timeline** | Chronological reconstruction across record kinds. |
| **Reports** | Filtered queries with SQL translation and chart summaries; Advanced Search hand-off. |
| **Activity** | Append-only audit trail of every mutation (create / update / delete / import / export / undo / redo / backup / restore) with keyboard undo/redo. |
| **Dictionary** | Managed vocabularies behind every free-text classification field (types, classifications, …) with adoption prompts for orphan values. |
| **Settings** | Density, export/print preferences, color-blind-safe palette, high-contrast mode, backup & restore. |

Export includes a structured, table-free **Word (.docx)** report, CSV and JSON; the whole workspace round-trips through a JSON **backup file**.

## Desktop app (Windows installer)

The app can be packaged as a native desktop application with Electron — `npm run dist:win` produces an NSIS `.exe` installer, and the `Desktop (Windows installer)` GitHub Actions workflow builds one for every `v*` tag. See [docs/DESKTOP.md](docs/DESKTOP.md).

## Getting started

```bash
npm install
npm run dev        # Vite dev server (default http://localhost:8443)
```

### Quality gates

Every change is expected to pass all of these (they are wired as the repo's definition of done):

```bash
npm run check          # typecheck + unit tests + SSR smoke
npm run typecheck      # tsc --noEmit, zero errors
npm run test           # node:test suite over src/core/**
npm run smoke          # SSR-renders every view through jsdom — catches hydration/SSR crashes
npm run smoke:dom      # behavioral DOM harness: rails, filters, selection, i18n/RTL, icon purity
npm run build          # production build (dist/)
```

## Architecture

```
src/
  core/          framework-free domain layer (persist, repository, schema,
                 search, validation, vocabulary, audit, backup, charts maths,
                 attachments (IndexedDB), export/ (docx, zip, print), import/
                 (byte-sniffing parser), sql/, stats/, timeline/, extract/)
  views/         one file per workspace section (Dashboard, Sources, …)
  components/    shared UI kit (ui.tsx), DataTable, AppShell, dialogs,
                 icons.tsx (authoritative Lucide re-exports), Charts.tsx
  i18n/          dictionaries (English + Arabic), RTL-aware layout throughout
  store/         app context (data + settings)
scripts/         smoke.tsx + dom-check.tsx harnesses (run through vite SSR build)
```

- **Data flow:** views mutate through `repository.ts` (validation + audit entry in one step) and persist via the `StorageAdapter` abstraction (`localStorage` in the browser; memory adapter in tests). Attachment blobs live in **IndexedDB** (`src/core/attachments.ts`).
- **UI stack:** React 19 + Tailwind v4 + a custom token system ("Graphite & Iris", see [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)). Icons are exclusively [Lucide](https://lucide.dev) components — never glyphs or emoji. Charts: recharts + small pure SVG helpers, all derived from real records.
- **Import detection** reads actual file bytes (content wins over extension), including docx/zip sniffing and JSON wrapper keys.

## Accessibility & internationalization

- Full keyboard operation of dialogs, grids, menus and date controls; every icon-only control carries an `aria-label` + tooltip and a visible focus ring.
- All UI text flows through the i18n dictionary (English + Arabic); Arabic switches the whole shell to RTL.
- High-contrast and color-blind-safe palettes in Settings; motion is fully suppressed under `prefers-reduced-motion`.

## Status

Active development happens on Arena agent branches; see [CHANGELOG.md](CHANGELOG.md) for the modernization history and merged PRs for detail.
