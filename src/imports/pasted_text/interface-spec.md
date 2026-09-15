# Text Analysis Manager — Existing Interface Specification

**Repository:** `RussellTCrivello/Text-Analysis-Manager` (version 2.1.0)
**Application type:** Single-window desktop application (Python 3.8+, PyQt5), SQLite database, no network/server component.
**Purpose of this document:** A complete descriptive specification of the existing, finished interface — every screen, dialog, and control as it currently exists. It documents behavior and layout only; it proposes no changes.

---

## 1. Application Overview

- **Product name (window title):** "Text Analysis Management System"
- **Workspaces (tabs):** Sources, Contents, Analysis, All Data, Timeline, Reports.
- **Languages:** English and Arabic (full right-to-left layout when Arabic is active). The UI text catalog ships only these two languages.
- **Themes:** Light (default) and Dark, switchable live from Settings.
- **Fonts/scale:** default font size 10 pt (configurable 8–16); an accessibility font scale of 100–200% can be applied.
- **Data storage locations (installed/EXE mode):**
  - Database file: `%APPDATA%\TextAnalysisManager\research_db.sqlite` (Windows; `~/.TextAnalysisManager/research_db.sqlite` on Linux/macOS). In script mode the database sits in the project directory.
  - Configuration: `config.ini` + mirrored `config.json` (`[Application]` language/theme/font size/page size/auto-save, `[Window]`, `[Timeline] density_mode`, `[Logging]`, `[Backup]`, `[Search]` sections).
  - Backups: `%APPDATA%\TextAnalysisManager\backups\backup_manual_YYYYMMDD_HHMMSS_ffffff.sqlite` files (optionally encrypted; metadata with size, checksum, tables, status is recorded per backup).
  - Attachments: `%APPDATA%\TextAnalysisManager\Source\<sanitized source name>\<file>` — one folder per source.
  - Saved reports: `saved_reports/<name>_<timestamp>.json` next to the application code.
  - Logs: `logs/` folder (info, error, and user-action logs; a query/error/user-action log toggle exists in configuration).
- **Audit trail:** every add/update/delete/import/bulk operation is written to the user-action log with the acting user and timestamp.
- **Lazy loading:** each data tab queries the database the first time it is shown (or after Refresh); tabs are not queried while hidden.
- **Default window size:** 1400 × 900 (configuration `[Window]`).

### 1.1 Database Schema and Relationships (source of truth)

The database contains exactly **three tables**. All table interfaces below draw their columns from these tables and their joins.

**Table `sources`** (research sources / publications)

| Field | Type / constraint | Meaning |
|---|---|---|
| `id` | INTEGER, PRIMARY KEY, AUTOINCREMENT | Source identifier |
| `name` | TEXT, UNIQUE, NOT NULL | Source title (e.g. document/publication name) |
| `type` | TEXT, NOT NULL | Source type (free text with autocomplete from existing values) |
| `link_sources` | TEXT, NOT NULL | URL/link to the source (validated as URL on entry) |
| `importance` | REAL, CHECK 0.0–1.0, default 0 | Importance score 0.0–1.0 (displayed as a percentage) |
| `country` | TEXT, NOT NULL | Country of origin |
| `city` | TEXT, nullable | City of origin |
| `description` | TEXT, nullable | Free-text description |
| `accounts` | TEXT, nullable | Account names/URLs, semicolon-separated |
| `note` | TEXT, nullable | Free-text note |
| `ownership` | TEXT, nullable | Ownership (autocomplete from existing values) |
| `date_entry` | TIMESTAMP, nullable | Entry date chosen by the user |
| `date_creation` | TIMESTAMP, NOT NULL, default CURRENT_TIMESTAMP | Record creation time (system) |
| `date_modified` | TIMESTAMP, nullable, default CURRENT_TIMESTAMP | Last modification time (system, maintained by a trigger) |

**Table `contents`** (documents/extracts belonging to a source)

| Field | Type / constraint | Meaning |
|---|---|---|
| `id` | INTEGER, PRIMARY KEY, AUTOINCREMENT | Content identifier |
| `title` | TEXT, nullable | Title of the content |
| `content_data` | TEXT, NOT NULL | The full text / data of the content |
| `attachments` | TEXT, nullable | Semicolon-separated list of attachment file paths (files live under `Source/<source name>/`) |
| `note` | TEXT, nullable | Free-text note |
| `importance` | REAL, CHECK 0.0–1.0, default 0 | Importance score 0.0–1.0 |
| `date_content` | TIMESTAMP, nullable | The date *of the content itself* (e.g. publication date) |
| `date_creation` | TIMESTAMP, NOT NULL, default CURRENT_TIMESTAMP | Record creation time (system) |
| `date_modified` | TIMESTAMP, nullable, default CURRENT_TIMESTAMP | Last modification time (system, trigger) |
| `sources_id` | INTEGER, NOT NULL, FOREIGN KEY → `sources.id` ON DELETE CASCADE | The source this content belongs to |

**Table `content_analysis`** (structured analysis of a content)

| Field | Type / constraint | Meaning |
|---|---|---|
| `id` | INTEGER, PRIMARY KEY, AUTOINCREMENT | Analysis identifier |
| `content_id` | INTEGER, NOT NULL, FOREIGN KEY → `contents.id` ON DELETE CASCADE | The content being analyzed |
| `list_names_people` | TEXT, nullable | Comma-separated list of people names |
| `list_names_places` | TEXT, nullable | Comma-separated list of place names |
| `list_coordinates` | TEXT, nullable | Comma-separated coordinate pairs ("lat,lon") |
| `classification` | TEXT, nullable | Free-text classification (comma list) |
| `list_sides` | TEXT, nullable | Comma-separated sides/parties involved |
| `date_analysis` | TIMESTAMP, nullable, default CURRENT_TIMESTAMP | Date the analysis was made |
| `date_creation` | TIMESTAMP, NOT NULL, default CURRENT_TIMESTAMP | Record creation time (system) |
| `date_modified` | TIMESTAMP, nullable, default CURRENT_TIMESTAMP | Last modification time (system, trigger) |

**Relationships**

- `sources` 1 ── N `contents`, via `contents.sources_id` (FK, cascade delete).
- `contents` 1 ── N `content_analysis`, via `content_analysis.content_id` (FK, cascade delete).
- Transitive: `sources` 1 ── N `content_analysis` (reached through `contents`).
- Deleting a source deletes its contents and, through cascade, their analyses. Deleting a content deletes its analyses.

**Derived (join/computed) fields used by interfaces**

- `source_name` — `sources.name` joined onto `contents` (`LEFT JOIN sources ON contents.sources_id = sources.id`) and onto `content_analysis` (two-hop join through `contents`).
- `coordinates` — alias of `content_analysis.list_coordinates` (in some queries; e.g. the advanced-search whitelist and All Data export).
- `record_type` — `CASE` expression: 'Analysis' / 'Content' / 'Source' (All Data view).
- `record_name` / `record_id` / `display_date` / `importance` / `date_created` / `date_modified` — `COALESCE`/`CASE` computed values in the All Data unified query.
- `timeline_date` — `COALESCE(date_content, date_analysis, date_entry, date_creation, source_date_entry, content_date_creation, …)` used by the Timeline; rows with no date at all are excluded from the timeline.

**Indexes:** on `sources(name, type)`, `sources(importance)`, `sources(date_entry)`, `contents(title)`, `contents(date_content)`, `contents(importance)`, `content_analysis(classification)`, `content_analysis(date_analysis)`.

**Validation rules (applied on Add/Edit/Import):**

- `sources`: `name` required (min 2 characters) and unique; `type` required; `link_sources` required and must be a valid URL; `country` required; `importance` 0.0–1.0.
- `contents`: `content_data` required; `sources_id` required; `importance` 0.0–1.0.
- `content_analysis`: `content_id` required; `classification` required (min 2 characters).
- **Duplicate detection** on Add: all fields except `id` are compared against every existing row (with None/whitespace normalization and date-aware comparison); an exact duplicate is rejected with a message naming the existing record's ID.

---

## 2. Shared Conventions Across the Table Interfaces

The Sources, Contents, Analysis, and All Data tabs are built on the same base class, so they share an identical structure. The per-tab sections below therefore focus on what differs; this section defines the shared parts once.

### 2.1 Tab layout (top to bottom)

1. **Filter row** (horizontally scrollable strip): `Search:` label + search input + Clear icon button; "Date Filter" group with `From:` date + `To:` date + Clear icon button. (All Data keeps this date group and also has its own "Filter by Type" row — see that section.)
2. **Action row** (horizontally scrollable strip, fixed height), grouped frames:
   - **Records group:** Add (labeled, green) | Edit (icon, enabled only when a row is selected) | Delete (icon, red, enabled only when a row is selected) | Refresh (icon).
   - **Workspace group:** page-specific buttons (per tab; some are tertiary and appear only in the More menu — listed per tab).
   - **Output group:** Export (labeled, purple — unified export with preview) | Print (icon).
   - **View group:** Set Header (icon — opens the global print/export header settings).
   - **More (⋯) menu:** all tertiary page-specific actions + "Bulk Operations", "Advanced Search", "Columns" (column visibility).
3. **Results summary strip:** "X records · Y total · Z selected" — Y (total) appears only when a filter is active; Z appears only when rows are selected.
4. **Data table** (read-only grid, row height 38, multi-select ExtendedSelection with Ctrl/Shift, no native header sort — sorting is tab-level, no in-cell editing).
5. **Selection action bar** (appears only when one or more rows are selected): "N selected" label + "Bulk Operations" button + "Clear" button (clears the selection). (Not present on All Data, which is read-only.)
6. **Full Text Preview panel** (collapsed 48 px header by default: title "Full Text Preview" + selected record's title + chevron toggle; expands to 250–400 px, see §2.4).
7. **Pagination widget** (fixed height, always visible at the bottom, outside scrolling — see §2.5).
8. **Status label** (hidden unless a recoverable error occurred, e.g. DB unavailable after auto-save).

### 2.2 Search and date filter behavior (Sources / Contents / Analysis)

- **Text search:** applied immediately on typing (no button needed). A row matches when the case-insensitive search text occurs in *any* of the row's values (all stored and derived fields, e.g. `source_name` for Contents/Analysis).
- **Date filter:** `From:` default = today − 1 year, `To:` default = today (both calendar-pop-up date editors, `yyyy-MM-dd`). Applied immediately on change. The row's date is the first non-empty value of: `date_creation`, `date_content`, `date_entry`, `date_analysis`, `source_date_creation`, `content_date_creation`, `analysis_date_creation`, `source_date_entry` (All Data uses its own resolution order — see that section; in practice the system creation date, since every row carries `date_creation`). **Rows with no date are always kept** even when a date range is set.
- **Combined state:** text search AND date range must both match.
- **Clear (search):** empties the search box and re-applies.
- **Clear (dates):** resets From/To to the defaults (today−1 year → today) and re-applies — it does not remove the date filter.
- **Refresh does not re-apply filters:** Refresh reloads the complete dataset from the database and discards the active search/date narrowing (the filter controls keep their values and take effect again when the user edits them).

### 2.3 Table behavior

- **Row number column (`#`):** 1-based position in the *full filtered result set*; on page N it continues from the previous pages (e.g. page 2 with 50/page starts at 51). Not stored; purely display-derived.
- **Sorting:** clicking a column header sorts the entire filtered set ascending; clicking again reverses to descending; the sort indicator appears on the header. Sorting persists across filter changes and paging and is re-applied after every data load. The `#` column sorts by current order.
- **Selection:** single or multi (Ctrl/Shift). Edit and Delete act on the currently focused selected row. Double-clicking a row opens its Edit dialog.
- **Context menu (right-click):** "Copy value" (copies the right-clicked cell's text to the clipboard); "Preview" (loads the clicked row into the text preview panel); "Edit" (Sources/Contents/Analysis only; All Data offers "Quick View" instead).
- **Cell display rules:** NULL / empty / literal 'None' → `-`; floating-point numbers → 2 decimal places; importance → percentage `X.XX%`; link column left-aligned.

### 2.4 Full Text Preview panel (shared)

Collapsed by default (48 px strip). Header: "Full Text Preview" title, the selected record's title/name, chevron toggle button. When expanded it shows, for the selected row:

- **Content Data** (primary text box): the row's `content_data`; for a source row it falls back to `description`, then `note`. Hidden when empty.
- Field grid: **Title** (title/content title/name), **Source** (`source_name`), **Type** (type/source type/record type), **Classification**, **Importance** (1 decimal + `%`; legacy values > 1 are shown as-is), **Date** (first of `date_content`, `date_creation`, `date_entry`, `date_analysis`, `source_date_creation`; `yyyy-MM-dd`), **People** (`list_names_people`), **Places** (`list_names_places`). Empty fields show `-`.
- **Note** box and **Description** box: shown only when present and different from the primary text.
- No selection → placeholder "Select a record to preview"; empty values show `-`.

### 2.5 Pagination widget (shared, fixed 60 px height)

Shown on every table-based interface (same widget everywhere). Left → right (mirrored in Arabic):

- **"Showing X–Y of Z" label** — current page's record range and total filtered count.
- **First / Previous / Next / Last** circular icon buttons.
- **Adaptive numbered page buttons** (36 × 36): when there are ≤ 7 pages all are shown; otherwise a window of the middle pages with ellipses at the ends (e.g. `1 … 4 5 6 … 12`).
- **"Page X of Y" indicator**.
- **Page-number spin box** — type a page number to jump (Enter or focus-out).
- **"Rows per page" combo:** 25 / 50 / 100 / 200 / 500 — **default 50** (saved under `[Application] page_size`).
- Page Up / Page Down keys change page. RTL mode mirrors icons and order.

Behavior:

- Any **filter change** (search text, date range, type) resets to page 1.
- **Changing rows-per-page** resets to page 1.
- **Sorting** keeps the current page.
- After **add / edit / delete / refresh**, the current page is kept (clamped to the last valid page).
- **Advanced Search results** and **import** reset to page 1.
- `get_page_range()` returns the 0-based (start, end) slice of the full filtered list; only that slice is shown in the table, while Export/Print/Statistics always operate on the **entire filtered dataset**, not the visible page.

### 2.6 Empty, loading, and error states

- **Empty result:** a "No data" overlay label centered in the table (theme-aware).
- **Loading:** "Loading..." placeholder while the initial query runs.
- **Recoverable error:** a red status line (e.g. database file missing after auto-save) with the table left in its last good state; fatal startup errors are shown as a critical message box.

### 2.7 Add / Edit / Delete / Refresh / Export / Print / Import / Duplicate — shared mechanics

- **Add** opens the tab's entry dialog (one dialog per tab, documented separately); **Edit** opens the same dialog pre-filled with the selected row.
- **Delete** asks for confirmation ("Are you sure you want to delete this record?", Yes/No, default No). Deletion cascades through the schema (source → contents → analyses). A success message reports the deleted ID; the table reloads.
- **Refresh** re-queries the database in default order (see §2.2 caveat about filters).
- **Export** opens the unified **Export (Preview) dialog** with the tab's entire filtered dataset (see "Export Interface" section).
- **Print** opens the **Print/Export Column Selection** dialog, then builds an HTML page with the global print header and sends it through the system print dialog (printer selection, print with page numbers per the global print settings). Prints the entire filtered dataset.
- **Set Header** opens the **Print & Export Header Settings** dialog (global header/footer/logo/document-number/page-number settings used by all printing and PDF export).
- **Duplicate** (where present) copies the selected row into a new Add dialog with a "(Copy)" suffix appended to the name/title and the system fields (id, dates) stripped; saving creates a brand-new record.
- **Bulk Operations** and **Advanced Search** are shared dialogs described in their own sections; **Columns** toggles the visibility of the current tab's columns (choice persisted as column visibility).

---
## 3. Application Shell (Main Window) Interface

The main window is the container for all six tabs. It consists of a top app header, a collapsible left sidebar, a context header above the tab area, the tab content, and a status bar.

### Columns

The shell has no data columns. It hosts:

| Element | Source | Meaning |
|---|---|---|
| Global search input | Active tab | Placeholder "Search the research workspace"; mirrors and drives the active tab's own search field |
| Workspace title / description | Tab definition | Current tab name and one-line description (e.g. Sources — "Collect and organize the records that ground your research.") |
| Breadcrumb | Static | "Research workspace" |

### Buttons

- **Quick Add (＋)** — top-right of the header. Invokes the active tab's add flow when one is defined (Sources/Contents/Analysis open their entry dialog; All Data has no add flow, so it has no effect; Reports has no add flow either).
- **Settings (gear)** — top-right; opens the Settings dialog.
- **Help (question mark)** — top-right; opens the Help dialog.
- **Refresh** — right side of the context header; calls the active tab's data reload.
- **Sidebar navigation buttons** (Workspace group): Sources, Contents, Analysis, All Data, Timeline, Reports — each with icon, name, and description; the active one is highlighted. Keyboard equivalents Ctrl+1 … Ctrl+6.
- **Sidebar Operations group:** Manage Attachments, Backup & Restore, Import Data, Settings, Help.
- **Collapse sidebar toggle** — collapses/expands the navigation.
- **Menu bar:**
  - **File:** Exit (Ctrl+Q).
  - **View:** Sources (Ctrl+1), Contents (Ctrl+2), Analysis (Ctrl+3), All Data (Ctrl+4), Timeline (Ctrl+5), Reports (Ctrl+6).
  - **Tools:** Settings…, Backup & Restore…, Reset…, Print Settings…, Manage Attachments…, Import Data… (Ctrl+I), Performance Monitor.
  - **Help:** Help… (F1), Keyboard Shortcuts…, About.
- **Status bar** at the bottom (reserved for status text).

### Filters

- **Global search box:** free text; on typing it is written into (and synced with) the active tab's search input — for the table tabs that input's change handler applies the table filter; on the Timeline tab it drives the timeline search. On the Reports tab the search is not bound ("Search is not available in this workspace"). Clearing either box clears both.

### Functionality

- **Tab switching:** sidebar buttons, menu items, or Ctrl+1–6 switch the stack. Each tab loads its data on first show (lazy) and reloads after external changes (import, restore, reset). All tabs are refreshed when the language or theme changes (Settings dialog).
- **Language switch (EN ↔ AR):** re-translates every widget and flips the entire layout to right-to-left (including pagination icons, splitters, table alignment); choice persisted.
- **Theme switch (Light ↔ Dark):** applied live from Settings; persisted.
- **Exit:** closes the application (Ctrl+Q).
- **Startup:** window title, default size, database check/creation, schema initialization, backup system init, performance monitor start, optional pre-load of tabs, audit-trail initialization.

### Pagination

None (the shell itself is not paginated; each tab provides its own pagination).

---

## 4. Sources Interface

Lists all `sources` records. Data query: `SELECT * FROM sources ORDER BY date_creation DESC` (newest created first).

### Columns

| Column (header) | DB field | Source table | Relationship / FK | Meaning | Display format | Stored vs derived |
|---|---|---|---|---|---|---|
| # | — | — | — | Row position in filtered result | integer, 1-based, continues across pages | Derived |
| ID | `id` | sources | PK | Source identifier | integer | Stored |
| Name | `name` | sources | UNIQUE NOT NULL | Source title | text | Stored |
| Type | `type` | sources | NOT NULL | Source type | text | Stored |
| Link | `link_sources` | sources | NOT NULL | URL to the source | text, left-aligned | Stored |
| Importance | `importance` | sources | REAL 0.0–1.0 | Importance score | percentage `X.XX%` | Stored |
| Country | `country` | sources | NOT NULL | Country | text | Stored |
| City | `city` | sources | nullable | City | text, `-` if empty | Stored |
| Description | `description` | sources | nullable | Description | text, `-` if empty | Stored |
| Accounts | `accounts` | sources | nullable | Accounts/URLs list | semicolon-separated text | Stored |
| Note | `note` | sources | nullable | Note | text | Stored |
| Ownership | `ownership` | sources | nullable | Ownership | text | Stored |
| Entry Date | `date_entry` | sources | nullable, TIMESTAMP | User-entered entry date | `yyyy-MM-dd HH:mm` (first 16 chars) | Stored |
| Date Created | `date_creation` | sources | NOT NULL | System creation time | `yyyy-MM-dd HH:mm:ss` | Stored (system) |
| Date Modified | `date_modified` | sources | trigger-maintained | System modification time | `yyyy-MM-dd HH:mm:ss` | Stored (system) |

### Buttons

**Records group:** Add | Edit (enabled only with a row selected) | Delete (enabled only with a row selected) | Refresh.
**Workspace group (visible):** Import Sources.
**Workspace group (in the More ⋯ menu):** Duplicate, Statistics — plus the shared Bulk Operations, Advanced Search, Columns (all three shared entries appear in the More menu on every table tab).
**Output group:** Export | Print. **View group:** Set Header.
**Filter row:** Clear (search, icon; enabled only when the search box has text); Clear (dates, icon) inside the Date Filter group.
**Selection action bar (visible only when rows are selected):** "N selected" label + Bulk Operations + Clear (clears the selection).
**Context menu:** Copy value | Preview | Edit. Row **double-click** = Edit.

### Filters

- **Text search:** case-insensitive substring across all row values; applied live.
- **Date From / To:** default today−1 year → today; applied live; rows without a date always kept. (The row date is its `date_creation`.)
- **Columns (More menu):** toggles visibility of the tab's columns; the choice is persisted.

### Functionality

- **Add:** opens the Source Entry dialog (next interface). On save: required-field checks, URL validation for Link, importance 0–1, duplicate check (all fields except id); inserted with `date_creation = now`; success message; audit log; table reloads.
- **Edit:** same dialog pre-filled with the selected row; all fields except id are updated (system dates untouched — the `date_modified` trigger fires). Success message; audit log.
- **Delete:** confirm → `DELETE FROM sources WHERE id=?` → cascade removes the source's contents and their analyses → success message with ID → reload. Audit log.
- **Import Sources:** file picker (CSV only). Columns are matched by header name (each field recognized in lowercase or its Capitalized variant, e.g. `link_sources` or `Link`, `date_entry` or `Date Entry`); missing columns are treated as empty. Rows with an empty name are errors ("Source name is required"); each other row goes through `add_source` (validation + duplicate detection — a failure is logged as that row's error). Result message: imported count plus up to 5 error lines (with a "…N more" note); reload. Audit log.
- **Duplicate:** with a selection, opens the Add dialog pre-filled with the row's values, name suffixed " (Copy)", id/dates removed; saving creates a new independent source.
- **Statistics:** message box computed over all loaded source records (the full dataset, not the filtered view): total, count by type (top 10 with percentages), count by country (top 10 with percentages), average importance.
- **Refresh:** reloads from the database (all records, newest created first); page position kept (clamped); active search/date filters not re-applied (see §2.2).
- **Export:** unified export of the entire filtered dataset via the Export (Preview) dialog (default format Excel).
- **Print:** column selection → HTML with the global header → system print dialog; all filtered rows.
- **Bulk Operations / Advanced Search:** shared dialogs (own sections). Advanced Search results replace the table's dataset (paginated from page 1) until the next Refresh.
- **Copy value:** clipboard copy of the right-clicked cell.
- **Preview:** loads the row into the Full Text Preview panel (for sources the primary text is `description`, falling back to `note`).

### Pagination

Standard shared widget: 25/50/100/200/500 rows per page (default 50); First/Prev/numbered/Next/Last; "Showing X–Y of Z"; "Page X of Y"; page spin; PgUp/PgDn. Filter changes and advanced-search results reset to page 1; CRUD keeps the page (clamped); exports/print use the full filtered set.

---

## 5. Source Entry (Add / Edit Source) Interface

Modal, user-resizable dialog (base size 700 × 600, responsive sizing with a minimum size), titled "Add New Source" (add mode) or "Edit Source" (edit mode). The form sits in a scroll area and is organized into four group boxes.

### Columns

(n/a — a form, not a table.) Form fields, by group:

**"Name / Type" group**

| Field (label) | DB field | Widget | Requirement |
|---|---|---|---|
| Name * | `name` | Line edit | Required; min 2 chars; must be unique |
| Type * | `type` | Auto-complete line edit | Required; suggestions = distinct existing `type` values |
| Link * | `link_sources` | Line edit | Required; validated as URL |
| Importance * | `importance` | Percentage spin box (0–100, suffix `%`, 2 decimals) | Required; maps to 0.0–1.0 |

**"Country / City" group**

| Field (label) | DB field | Widget | Requirement |
|---|---|---|---|
| Country * | `country` | Auto-complete line edit | Required; suggestions = distinct `country` values |
| City | `city` | Auto-complete line edit | Optional; suggestions = distinct `city` values |

**"Description" group**

| Field (label) | DB field | Widget | Requirement |
|---|---|---|---|
| Description | `description` | Read/write text edit | Optional |
| Accounts | `accounts` | Multi-email/URL widget (read/write text edit + "Validate" and "Format" buttons) | Optional; values normalized to semicolon-separated |
| Ownership | `ownership` | Auto-complete line edit | Optional; suggestions = distinct `ownership` values |
| Note | `note` | Read/write text edit | Optional |

**"Entry Date" group**

| Field (label) | DB field | Widget | Requirement |
|---|---|---|---|
| Entry Date | `date_entry` | Date-time edit (`yyyy-MM-dd HH:mm`), default = now | Optional |

Auto-complete fields also accept free text (typing filters a popup; a new value is allowed and becomes part of the distinct set after saving).

### Buttons

- **Save** — validates and inserts/updates; success message; audit log.
- **Cancel** — closes without changes.
- **Validate** (Accounts row) — checks the entered emails/URLs; reports invalid entries.
- **Format** (Accounts row) — normalizes the Accounts text to a single-line semicolon-separated list.

### Filters

None.

### Functionality

- **Add mode:** empty form (Importance 0%, Entry Date = now). Save runs required checks (name, type, link, country), URL validation for link, DataValidator (name ≥ 2 chars, importance 0–1), then the duplicate detector; on duplicate → error message citing the existing record's ID; on success → insert, success message, parent tab reloads.
- **Edit mode:** all fields pre-filled from the selected row. Save updates all mutable fields (`id` excluded; `date_creation`/`date_modified` untouched — the `date_modified` trigger fires automatically). Duplicate check compares against other records (the record's own row excluded from the comparison).
- **Cancel:** no validation, no changes.

### Pagination

None.

---

## 6. Contents Interface

Lists all `contents` records with their parent source name. Data query: `SELECT c.*, s.name AS source_name FROM contents c LEFT JOIN sources s ON c.sources_id = s.id ORDER BY c.date_creation DESC`.

### Columns

| Column (header) | DB field | Source table | Relationship / FK | Meaning | Display format | Stored vs derived |
|---|---|---|---|---|---|---|
| # | — | — | — | Row position | integer, 1-based, continues across pages | Derived |
| ID | `id` | contents | PK | Content identifier | integer | Stored |
| Source | `source_name` | sources (join) | `contents.sources_id` → `sources.id` | Name of the parent source | text; `-` if the source row is missing | Derived (JOIN) |
| Title | `title` | contents | nullable | Content title | text | Stored |
| Content | `content_data` | contents | NOT NULL | Full text of the content | text | Stored |
| Attachments | `attachments` | contents | nullable | Attachment files | file names only (paths stripped), semicolon list | Stored |
| Importance | `importance` | contents | 0.0–1.0 | Importance score | percentage `X.XX%` | Stored |
| Note | `note` | contents | nullable | Note | text | Stored |
| Content Date | `date_content` | contents | nullable, TIMESTAMP | Date of the content itself | `yyyy-MM-dd HH:mm` | Stored |
| Date Created | `date_creation` | contents | NOT NULL | System creation time | `yyyy-MM-dd HH:mm:ss` | Stored (system) |
| Date Modified | `date_modified` | contents | trigger-maintained | System modification time | `yyyy-MM-dd HH:mm:ss` | Stored (system) |

(The `sources_id` foreign key itself is not shown as a column; the parent is shown via the derived `Source` column.)

### Buttons

**Records group:** Add | Edit (enabled only with a row selected) | Delete (enabled only with a row selected) | Refresh.
**Workspace group (visible):** Import Contents, View Attachments, Preview Content.
**Workspace group (in the More ⋯ menu):** Duplicate Content, Link to Analysis — plus the shared Bulk Operations, Advanced Search, Columns.
**Output group:** Export | Print. **View group:** Set Header.
**Filter row:** Clear (search); Clear (dates).
**Selection action bar (when rows selected):** Bulk Operations | Clear (selection).
**Context menu:** Copy value | Preview | Edit. Row double-click = Edit.

### Filters

Identical to Sources (text search across all values incl. `source_name`; date From/To with the shared date-resolution order; default range today−1 year → today; no-date rows kept). Columns visibility via More menu.

### Functionality

- **Add:** opens the Content Entry dialog (next interface).
- **Edit:** dialog pre-filled; updates mutable fields; parent tab reloads.
- **Delete:** confirm → deletes the content row and, by cascade, all its `content_analysis` rows → message → reload.
- **Import Contents:** CSV file picker. Columns are matched by header name (lowercase or Capitalized variant, e.g. `content_data` or `Content`, `date_content` or `Date Content`). The CSV must supply `sources_id` / `Sources ID` referencing an existing source (an unresolvable source becomes a row error); rows without `content_data` are errors ("Content data is required"); other rows go through `add_content` (importance 0–1, duplicate check). Result message (imported count + up to 5 errors) + reload + audit log.
- **Duplicate Content:** copies the selected row into the Add dialog pre-filled, title suffixed " (Copy)" (or name-based fallback), system fields stripped; save creates a new content under the same source.
- **View Attachments:** with a selected content, opens the **Attachment Preview** dialog pre-loaded with the first attachment file of that content (no attachments → "no files" message).
- **Preview Content:** opens the **Content Preview** dialog for the selected row (see that interface).
- **Link to Analysis:** with a selected content, opens the Analysis Entry dialog pre-populated with that content's ID — i.e. a shortcut to create a new analysis attached to the selected content.
- **Refresh / Export / Print / Set Header / Bulk Operations / Advanced Search / Copy value / Preview:** shared mechanics per §2.7 (export/print cover the entire filtered dataset).

### Pagination

Standard shared widget (default 50/page; 25–500 choices). Filter changes and advanced search reset to page 1; CRUD keeps the page (clamped).

---

## 7. Content Entry (Add / Edit Content) Interface

Modal, user-resizable dialog (base size 700 × 600, responsive sizing), titled "Add New Content" or "Edit Content". Form in a scroll area, two group boxes.

### Columns

(n/a — a form.) Form fields:

**"Source" group**

| Field (label) | DB field | Widget | Requirement |
|---|---|---|---|
| Source * | `sources_id` | Searchable combo box — editable list of all sources shown as "ID — Name"; typing filters the list; an "Add New…" entry and an adjacent "Add New" button open the Source Entry dialog inline | Required — a source must exist and be selected |

**"Content Data" group**

| Field (label) | DB field | Widget | Requirement |
|---|---|---|---|
| Title | `title` | Line edit | Optional |
| Content Data * | `content_data` | Read/write text edit | Required |
| Importance * | `importance` | Percentage spin box (0–100 %, 2 decimals) | 0–1 range |
| Content Date | `date_content` | Date-time edit (`yyyy-MM-dd HH:mm`), default = now | Optional |
| Attachments | `attachments` | File attachment widget — list of attached file names, an "Attach Files" button (multi-select file picker; files are copied under `Source/<source name>/`) and a "Clear" button (removes all staged files) | Optional; recorded as semicolon-separated paths |
| Note | `note` | Read/write text edit | Optional |

The inline "Add New" (Source) opens the Source Entry dialog; after creating the source it refreshes the list and selects the new one, so a brand-new source and its first content can be entered in one flow. Attachment changes are staged while the dialog is open and committed when Save succeeds (rolled back on failure/cancel).

### Buttons

- **Save** — validates (content_data required, source selected, importance range, duplicate check) and inserts/updates; success message; audit log.
- **Cancel** — closes without changes.
- **Add New** (next to the Source combo, and the "Add New…" list entry) — inline source creation (see above).
- **Attachment controls:** "Attach Files" (file picker, multi-select; copies files into the source folder), "Clear" (removes all staged files).

### Filters

None.

### Functionality

- **Add mode:** Source combo empty; Content Data empty; Content Date = now. Save inserts the row (system dates set automatically) and reloads the tab.
- **Edit mode:** all fields pre-filled; the Attachments widget reflects the stored paths (displaying file names). Save updates mutable fields (id excluded); attachment add/remove is persisted into the `attachments` path list.
- **Duplicate protection:** identical content row (all fields except id) already existing → rejected with the existing ID.

### Pagination

None.

---
## 8. Analysis Interface

Lists all `content_analysis` records with the parent content title and grand-parent source name. Data query (three-way join): `ca.*` + `c.title` (contents) + `s.name` (sources) + `c.sources_id`, ordered by `ca.date_creation DESC`. The `list_coordinates` field is exposed under the header **Coordinates**.

### Columns

| Column (header) | DB field | Source table | Relationship / FK | Meaning | Display format | Stored vs derived |
|---|---|---|---|---|---|---|
| # | — | — | — | Row position | integer, 1-based, continues across pages | Derived |
| ID | `id` | content_analysis | PK | Analysis identifier | integer | Stored |
| Source | `s.name` (alias) | sources (2-hop join) | via `contents.sources_id` | Grand-parent source name | text; `-` if missing | Derived (JOIN) |
| Content | `c.title` | contents (join) | `content_analysis.content_id` → `contents.id` | Title of the analyzed content | text | Derived (JOIN) |
| Classification | `classification` | content_analysis | nullable | Classification (comma list) | text | Stored |
| People | `list_names_people` | content_analysis | nullable | People names (comma list) | text | Stored |
| Places | `list_names_places` | content_analysis | nullable | Place names (comma list) | text | Stored |
| Coordinates | `list_coordinates` | content_analysis | nullable | Coordinate pairs | `lat,lon` pairs, comma-separated | Stored |
| Sides | `list_sides` | content_analysis | nullable | Sides/parties (comma list) | text | Stored |
| Analysis Date | `date_analysis` | content_analysis | nullable, default CURRENT_TIMESTAMP | Date of the analysis | `yyyy-MM-dd HH:mm` | Stored |
| Date Created | `date_creation` | content_analysis | NOT NULL | System creation time | `yyyy-MM-dd HH:mm:ss` | Stored (system) |
| Date Modified | `date_modified` | content_analysis | trigger-maintained | System modification time | `yyyy-MM-dd HH:mm:ss` | Stored (system) |

### Buttons

**Records group:** Add | Edit (enabled only with a row selected) | Delete (enabled only with a row selected) | Refresh.
**Workspace group (visible):** Import Analysis, View on Map.
**Workspace group (in the More ⋯ menu):** Duplicate Analysis, Compare, Summary — plus the shared Bulk Operations, Advanced Search, Columns.
**Output group:** Export | Print. **View group:** Set Header.
**Filter row:** Clear (search); Clear (dates).
**Selection action bar (when rows selected):** Bulk Operations | Clear (selection).
**Context menu:** Copy value | Preview | Edit. Row double-click = Edit.

### Filters

Same mechanics as the other table tabs (text search over all values; date From/To; default today−1 year → today; no-date rows kept). Columns visibility via More menu.

### Functionality

- **Add / Edit:** opens the Analysis Entry dialog (next interface).
- **Delete:** confirm → deletes the analysis row (no children to cascade) → message → reload.
- **Import Analysis:** CSV file picker. Columns are matched by header name (lowercase or Capitalized variant, e.g. `list_names_people` or `List Names People`). The CSV must supply `content_id` / `Content ID` referencing an existing content (rows without it are errors: "Content ID is required"); other rows go through `add_content_analysis` (classification required, duplicate check). Result message (imported count + up to 5 errors) + reload + audit log.
- **Duplicate Analysis:** copies the selected row into the Add dialog pre-filled (content reference preserved), system fields stripped; save creates a new analysis.
- **View on Map:** with a selected analysis, parses the first coordinate pair from `list_coordinates` and opens it in the default web browser as a Google Maps URL (`https://www.google.com/maps?q=lat,lon`); the status label reports the opened coordinate. No selection → warning; no coordinates → info message; malformed pair → warning.
- **Compare:** opens the **Comparison dialog** (see that interface) showing the currently filtered analysis rows side by side (requires at least 2 rows).
- **Summary:** opens the **Summary dialog** (message box) with aggregate statistics over the currently filtered analysis rows.
- **Refresh / Export / Print / Set Header / Bulk Operations / Advanced Search / Copy value / Preview:** shared mechanics per §2.7.
- **Preview:** the Full Text Preview panel for an analysis row shows Classification, People, Places, Source, and dates in the field grid (no primary long text — the panel shows field values only).

### Pagination

Standard shared widget (default 50/page). Filter changes and advanced search reset to page 1; CRUD keeps the page (clamped).

---

## 9. Analysis Entry (Add / Edit Analysis) Interface

Modal, user-resizable dialog (base size 700 × 600, responsive sizing), titled "Add New Analysis" or "Edit Analysis". Form in a scroll area, two group boxes.

### Columns

(n/a — a form.) Form fields:

**"Content ID" group**

| Field (label) | DB field | Widget | Requirement |
|---|---|---|---|
| Content * | `content_id` | Searchable combo box — lists all contents as "ID — first 100 chars of content_data preview" (data query `get_all_content_ids`); "Add New…" entry and "Add New" button open the Content Entry dialog inline | Required |

**"Analysis" group**

| Field (label) | DB field | Widget | Requirement |
|---|---|---|---|
| Classification | `classification` | Auto-complete line edit | Required on save; min 2 chars; suggestions = distinct existing classifications (comma items split into individual values) |
| People Names | `list_names_people` | Auto-complete line edit (comma-separated values) | Optional; suggestions = distinct existing people |
| Place Names | `list_names_places` | Auto-complete line edit (comma-separated values) | Optional; suggestions = distinct existing places |
| Coordinates | `list_coordinates` | Coordinate input widget (lat/lon pair entries with add/remove controls) | Optional; stored as `lat,lon` comma-separated |
| Sides/Parties | `list_sides` | Auto-complete line edit (comma-separated values) | Optional; suggestions = distinct existing sides |

There is **no date field** in this dialog: `date_analysis` takes the database default (current time) on insert.

### Buttons

- **Save** — validates (content selected, classification ≥ 2 chars, duplicate check) and inserts/updates; success message; audit log.
- **Cancel** — closes without changes.
- **Add New** (next to the Content combo, and the "Add New…" list entry) — inline content creation (see above).
- **Coordinate pair controls:** add pair / remove pair (lat and lon validated as numbers).

### Filters

None.

### Functionality

- **Add mode:** Content combo empty, lists all contents (ID + preview). Save inserts and reloads the tab.
- **Edit mode:** pre-filled; comma-separated list fields are shown as-is for editing. Save updates mutable fields.
- **Duplicate protection:** identical analysis row (all fields except id) → rejected with the existing ID.

### Pagination

None.

---

## 10. All Data Interface

One unified, **read-only** view of **all three tables** combined (a "Read Only" badge sits next to the tab title). Data query `get_all_data_unified`: 3-way LEFT JOIN (`content_analysis` ← `contents` ← `sources`) producing one row per analysis, plus content-only rows, plus source-only rows; ordered by the coalesced date descending.

### Columns

| Column (header) | DB field (expression) | Source table | Relationship / FK | Meaning | Display format | Stored vs derived |
|---|---|---|---|---|---|---|
| # | — | — | — | Row position | integer, 1-based | Derived |
| ID | `record_id` = COALESCE(analysis id, content id, source id) | all three | respective PKs | Identifier of the underlying record | integer | Derived |
| Type | `record_type` = CASE on which table supplied the row | all three | — | 'Analysis' / 'Content' / 'Source' | text | Derived |
| Name/Title | `record_name` = CASE: source name / content title / 'Analysis - <id>' | all three | — | Human-readable name | text | Derived |
| Content | `content_data` or `description` fallback | contents / sources | — | Long text of the row | text | Stored |
| Source | `source_name` (`s.name`) | sources | joins | Source name (present for all row kinds) | text | Derived (JOIN) |
| Classification | `classification` | content_analysis | — | Classification | text | Stored |
| People | `list_names_people` | content_analysis | — | People list | text | Stored |
| Places | `list_names_places` | content_analysis | — | Places list | text | Stored |
| Coordinates | `list_coordinates` | content_analysis | — | Coordinates | text | Stored |
| Sides | `list_sides` | content_analysis | — | Sides list | text | Stored |
| Importance | COALESCE(content, source importance) | contents / sources | — | Importance score | percentage `X.XX%` | Stored |
| Date | `display_date` = COALESCE(date_content, date_entry, date_analysis, date_creation) | all three | — | Best available date for the row | `yyyy-MM-dd` | Derived |
| Note | `note` (content or source) | contents / sources | — | Note | text | Stored |
| Description | `description` | sources | — | Description | text | Stored |
| Attachments | `attachments` | contents | — | Attachment file names | semicolon list | Stored |
| Date Created | COALESCE of the three `date_creation` fields | all three | — | System creation time | `yyyy-MM-dd HH:mm:ss` | Derived |
| Date Modified | COALESCE of the three `date_modified` fields | all three | — | System modification time | `yyyy-MM-dd HH:mm:ss` | Derived |

The underlying per-table row IDs are carried with each row (used by Quick View/Generate Report); the visible ID is the coalesced one.

### Buttons

**Records group:** Refresh only (this tab is read-only — there are no Add / Edit / Delete buttons).
**"Filter by Type" row** (below the toolbar): Record Type combo + **Quick View** labeled button (enabled only with a row selected) + **Generate Report** labeled button (purple).
**Output group:** Export | Print. **View group:** Set Header.
**Filter row:** Clear (search); Clear (dates) — the date filter exists on this tab too.
**More (⋯) menu:** Columns (column visibility).
**Context menu:** Copy value | Quick View. Row **double-click** = Quick View.

### Filters

- **Text search:** case-insensitive substring across all values; applied live.
- **Date From / To:** same as the other tabs (default today−1 year → today; no-date rows kept). The row date is the first non-empty of: `date_content`, `content_date_creation`, `source_date_creation`, `analysis_date_creation`, `date_analysis`, `source_date_entry`.
- **Record Type filter (combo, in the "Filter by Type" row):** All Types (default) | Source | Content | Analysis — filters the unified result set by the derived `record_type`.
- **Columns** visibility via the More menu.

### Functionality

- **Quick View:** opens the **Quick View dialog** for the selected row (double-click or button; see that interface). No editing of unified rows exists on this tab.
- **Generate Report:** requires a non-empty filtered set; sends the entire current filtered unified dataset to the Reports workspace: the Reports tab loads the rows into its Results area, sets the report title to "All Data", and switches to the Report Preview pane (see Reports Interface).
- **Refresh:** reloads the unified query (all records); active filters not re-applied (see §2.2).
- **Export:** unified export of the entire filtered dataset via the Export (Preview) dialog (table name "all_data").
- **Print:** column selection → HTML with global header → system print dialog; all filtered rows.
- **Set Header:** global print/export header settings.
- **Copy value:** clipboard copy of the right-clicked cell.
- **Preview:** the Full Text Preview panel works on unified rows (primary text = content_data/description; the field grid maps unified keys — e.g. `record_type` into the Type field).

### Pagination

Standard shared widget (default 50/page). Search, date, or type-filter changes reset to page 1; refresh keeps the page (clamped).

---

## 11. Quick View (All Data record detail) Interface

Modal dialog, fixed 700 × 500, titled "Quick View" — read-only detail of one unified record.

### Columns

No table; the record is presented as:

- A **type badge** (colored pill): SOURCE = green, CONTENT = orange, ANALYSIS = blue (from `record_type`).
- A **title** line (the content title, falling back to the source name).
- A **field list** in a read-only text area: every non-empty field of the row except `id` and `record_type`, rendered as "field name: value" lines (HTML-escaped).

### Buttons

- **Close** — dismisses the dialog.

### Filters

None.

### Functionality

- Opens from a selected All Data row (Quick View button, double-click, or context menu). Pure inspection: no editing, no export.

### Pagination

None.

---

## 12. Content Preview (Contents detail) Interface

Modal dialog, fixed 700 × 500, titled "Preview Content" — read-only preview of one content record.

### Columns

No table; the record is presented as:

- **Title** (heading; "(No Title)" fallback).
- **Info line:** "Source: <source name> | Date: <content date>".
- **Content Data:** full text in a read-only text edit.
- **Note:** shown as a labeled line only when present.

### Buttons

- **Close** — dismisses the dialog.

### Filters

None.

### Functionality

- Opens for the selected Contents row via the "Preview Content" button; pure inspection of the full text and its metadata.

### Pagination

None.

---

## 13. Comparison Dialog (Analysis) Interface

Modal dialog, fixed 900 × 600, titled "Compare" — compares the **currently filtered analysis rows** side by side (a minimum of 2 rows is required; otherwise an info message).

### Columns

| Column (header) | DB field | Display |
|---|---|---|
| ID | `id` | integer |
| Classification | `classification` | text |
| People | `list_names_people` | text, truncated to 50 chars in-cell (full value in tooltip) |
| Places | `list_names_places` | text, truncated to 50 chars (full value in tooltip) |
| Coordinates | `list_coordinates` (alias `coordinates`) | text, truncated to 30 chars (full value in tooltip) |
| Sides | `list_sides` | text, truncated to 50 chars (full value in tooltip) |

One row per filtered analysis record; multi-select rows; row height 38; columns auto-sized to content.

### Buttons

- **Close** — dismisses the dialog.

### Filters

None in the dialog; the scope is the Analysis tab's currently filtered dataset.

### Functionality

- Read-only side-by-side comparison of the filtered analyses' structured fields.

### Pagination

Yes — the shared pagination widget, with the rows-per-page capped at 25 for this dialog.

---

## 14. Summary Dialog (Analysis) Interface

Message-box dialog (titled "Summary") with aggregate statistics over the **currently filtered analysis rows** (requires at least 1 row; otherwise an info message).

### Columns

(n/a — a formatted text report.)

- **Total records** in the filtered set.
- **By classification:** each classification with its count and percentage (sorted by count).
- **Unique people** count, plus the top 5 names.
- **Unique places** count, plus the top 5 names.
- **With coordinates:** count and percentage of rows carrying coordinates.

### Buttons

- **OK** (message box) — dismisses.

### Filters

None in the dialog; the scope is the Analysis tab's currently filtered dataset.

### Functionality

- Read-only aggregate digest; computed in-memory from the filtered rows.

### Pagination

None.

---
## 15. Timeline Interface

A chronological, visual view of every record that has a date, plus statistics, charts, and an analysis panel. Layout: page title, then a horizontal split — timeline widget (left) and the shared Full Text Preview panel (right) — with a status line ("N events loaded" / "No events"). Data query `get_timeline_events`: the unified 3-way join with a derived `timeline_date` (first non-NULL of `date_content`, `date_analysis`, `date_entry`, `date_creation`, `source_date_entry`, `content_date_creation`), rows without any date excluded, newest first by default.

### Columns

No grid columns. The content is a vertical list of **event cards**, each rendered with:

| Element | DB field / expression | Meaning | Display |
|---|---|---|---|
| Day of week | from `timeline_date` | e.g. "MON" | small bold accent label |
| Date | `timeline_date` | Event date (first non-NULL of `date_content`, `date_analysis`, `date_entry`, `date_creation`, `source_date_entry`, `content_date_creation`) | bold; fallback "No date" |
| Time | from `timeline_date` | Event time | small secondary label |
| Title | `record_name` | Source name / content title / 'Analysis - id' | bold, wrapped |
| Description | `content_data` / `description` excerpt (or classification/people context) | Short excerpt | wrapped, secondary |
| Badges | `list_names_people`, `list_names_places`, `classification` | Context badges, shown when present | People = blue, Places = red, Classification = purple |
| Source line | `source_name` | Source attribution (italic, newspaper icon) | shown when present |

A colored **axis node** runs down the timeline's edge: purple (larger) for analysis events, blue (medium) for content events, green (small) for source events. Above the list, a **statistics dashboard** shows four cards: Total Events, Filtered Events, Sources, Analyses (counts update with the active filters; "Filtered" reflects the current filter/sort result).

### Buttons

- **View controls bar:**
  - **Order group:** Sort-by combo (Date (default) / People / Places / Classification / Source) + order combo (Newest First (default) / Chronological).
  - **Density group:** Compact / Comfortable (default) / Expansive — card size and spacing; persisted (`[Timeline] density_mode`).
  - **Date range group:** From (default today−1 year) / To (default today) date editors + red **Clear** button (resets search, all filter combos, and the date range to defaults in one pass).
- **Charts section:** chart-type combo — Timeline (default) / Type Distribution / Day of Week / Monthly / Classification — plus the chart canvas and a **Timeline Analysis** panel (total events, counts by type with percentages, top 5 classifications with percentages, most active month).
- **Data section header:** Print (icon button) and Export (icon button, green).
- **Filters row:** search input + People combo + Places combo + Classification combo (all editable; placeholder "All …") + Clear (icon) button.
- **Event cards:** clicking a card selects it (highlighted) and loads it into the Full Text Preview panel on the right.
- **Pagination controls** at the bottom of the data section (see Pagination).

### Filters

- **Date range:** From/To over `timeline_date` (default today−1 year → today); applied immediately; events without a date are excluded from the timeline entirely.
- **Search** (debounced 300 ms after typing): case-insensitive substring over `content_title`, `content_data`, `classification`, `list_names_people`, `list_names_places`, `source_name`.
- **People filter:** editable combo populated with the distinct people names (all comma lists split); substring match against individual items; events without people never match.
- **Places filter:** editable combo from distinct place names; also matches the source's city and country; events without any place never match.
- **Classification filter:** editable combo from distinct classifications; substring match.
- **Sort:** by date / people / places / classification / source, newest-first or chronological.
- All filters combine; every change re-computes the filtered set, resets to page 1, and updates the statistics cards, chart, and analysis panel (which always reflect the **full filtered set**, independent of the visible page).

### Functionality

- **Load:** `load_events` refreshes the filter-option combos from the database and applies all filters.
- **Selection:** clicking a card highlights it and drives the preview panel (primary text, title/source/type/classification/importance/date/people/places, note/description).
- **Charts:** the selected chart type renders the filtered events — events per date, counts by record type, events by day of week, events per month, or events by classification.
- **Analysis panel:** live text digest of the filtered events (totals, type breakdown, top classifications, most active period).
- **Print:** builds the timeline print HTML (global print header/footer, page numbers, orientation per the print settings) for the full filtered event list and sends it through the system print dialog; warns when there is no data.
- **Export:** opens the **Timeline Export dialog** (next interface) passing the full list, the filtered list, and the current page's events.
- **Density change:** re-lays out all cards and the axis (persisted).
- **Refresh (main header):** reloads events from the database.
- **Empty state:** "No events match the current view." centered in the list.

### Pagination

Yes — the data section uses the shared pagination widget (default 50/page, 25–500): only the current page's event cards are rendered (prevents freezing on large sets); the statistics cards, chart, and analysis panel always reflect the full filtered set. Filter changes reset to page 1; changing rows-per-page resets to page 1; "Showing X–Y of Z" tracks the filtered event count.

---

## 16. Timeline Export Interface

Modal dialog (fixed 600 × 500) for exporting the timeline to a document.

### Columns

No table; an options form:

| Control | Values / default | Meaning |
|---|---|---|
| Export Scope (radio) | **Filtered Data (default)** / Current Page / All Data — each option enabled only when non-empty and showing its event count | Which event set to export: all events matching the active filters; the events on the currently visible page; or every event regardless of filters |
| Export Format (radio) | **Word (default)** / Excel / PDF | Output file type (.docx / .xlsx / .pdf) |
| Options (checkboxes) | Include System Header (default on), Preserve Original Format (default on), Open File After Export (default on) | Include the global print header; keep the original text formatting; open the file in the default application |
| Output file | filename field + Browse… | Destination path; a preview line shows the resulting file name |

### Buttons

- **Browse…** — file save dialog for the output path.
- **Export** (primary) — validates (a non-empty scope and a file path), generates the file directly, verifies the output file was created, success message, then opens the file if the option is set.
- **Cancel** — closes without exporting.

### Filters

The dialog itself has no filters; it consumes the timeline's active filter state (and, for "All Data", the unfiltered dataset).

### Functionality

- **Scope selection:** radio buttons update the shown event counts live (count comes from the timeline's data: filtered vs. full).
- **Word export:** a formatted .docx — professional header (when the option is on), a centered timeline title, then one styled block per event (date, type, title, summary, meta fields).
- **Excel export:** one sheet, one row per event with the event's fields, styled header block.
- **PDF export:** the timeline print HTML rendered through the print pipeline with the global header and page numbers; orientation follows the global print setting (landscape when set, portrait otherwise).
- **Open after export:** shells out to open the file with the OS default application.

### Pagination

None.

---

## 17. Reports Interface (workspace)

The Reports tab (fixed internal layout ~450 px left pane / 700 px right pane) has four sub-panels — Query Builder (left, top), Chart Designer (left, bottom), Results (right, top), Report Preview (right, bottom) — plus a tab toolbar. The four sub-panels are specified as separate interfaces below (§17.1–§17.4); the Saved Reports dialog is §17.5.

### Columns

The workspace itself holds no data columns; see the sub-interfaces. Results and Preview display query output described in their sections.

### Buttons

**Tab toolbar, grouped:**

- **Report group:** New (primary, labeled — "Create a new report? Unsaved changes will be lost." confirmation; clears query, results, title, chart state) | Save (labeled — opens the Save dialog) | Load (icon — opens the Load dialog listing saved reports).
- **Output group:** Print (icon) | Print Preview (icon) | Export PDF (icon) | Export Excel (icon) | Export CSV (labeled).
- **Page group:** Page Orientation combo (Portrait default / Landscape) | Page Size combo (A4 default / Letter / A3 / Legal).

### Filters

No data filters at the workspace level; the query itself is the filter (see Query Builder). Page orientation/size affect printing and PDF export only.

### Functionality

- **New report:** confirms, then resets the workspace (empty query editor, empty results, empty title, chart button disabled).
- **Save:** opens the Saved Reports dialog in save mode (name + description + existing list); stores `saved_reports/<sanitized name>_<timestamp>.json` containing: name, description, query, query parameters (visual-mode field/filter selections), report title, chart config (type, label/value fields, aggregation, style, limit), orientation, page size, include-chart flag, creation time.
- **Load:** opens the dialog in load mode; selecting a saved report restores its query (into the SQL editor), title, orientation, page size, include-chart flag, and chart config, then executes the query.
- **Print:** requires results data; opens the Print/Export Column Selection dialog, then builds the report HTML (global header, report title, timestamp, stats, optional chart image, data table) and prints through the system print dialog with the selected orientation/page size (15 mm margins, high-resolution printer).
- **Print Preview:** same preparation, but shown in an interactive print-preview window (zoom/pan, page navigation) before printing.
- **Export PDF / Excel / CSV:** route through the shared Export (Preview) dialog with the report's result set (table name "report"; default format PDF/Excel/CSV respectively) — see Export Interface.
- **Orientation / Page Size:** applied to print, print preview, and PDF export; persisted in saved reports.
- **Data injection from All Data:** "Generate Report" in the All Data tab loads that tab's filtered unified rows directly into the Results panel, sets the title to "All Data", and switches the right side to Report Preview (no query required).

### Pagination

None at the workspace level — the **Results** sub-panel has its own pagination (see §17.3); print/preview/export render the full result set.

---

## 17.1 Reports — Query Builder Interface (left pane)

Builds the SQL query whose result feeds Results/Preview/Chart. Two modes toggled by a segmented control: **SQL Mode** (default) and **Visual Mode**.

### Columns

**SQL Mode:**

| Element | Meaning |
|---|---|
| SQL editor | Monospace, syntax-highlighted read/write text edit holding the query (e.g. `SELECT * FROM sources`). The currently saved/last query is shown here. |
| Template buttons grid (4 columns, 35 buttons) | One-click query templates; each inserts its SQL into the editor. The set: All Sources; All Contents; All Analysis; Sources by Type; Sources by Country; Content Count; Average Importance; Full Join (all three tables); Recent Content; Content by Month; Sources by Date; Analysis Trends; Top Sources by Importance; Importance Distribution; Average Importance by Country; Average Importance by City; Content Importance Stats; Sources by City; Content by Country; Geographic Distribution; Content with Analysis; Content without Analysis; Classification Distribution; Content by Importance; Most Analyzed Content; Most Active Sources; Sources without Content; Analysis Coverage; Recent Additions; Source Statistics; Content Stats by Type; People Mentioned; Places Mentioned; Data Quality Metrics; Comprehensive Overview. |
| Database structure tree | Read-only tree: the three tables with their columns (name + type) for reference; expands per table. |

**Visual Mode:**

| Element | Meaning |
|---|---|
| Tables (checkboxes) | `sources`, `contents`, `content_analysis` — all checked by default; determines the FROM/JOIN clause (allowed tables only). |
| Fields (multi-select list) | Qualified `table.column` entries for the checked tables; "Select All" / "Deselect All" buttons; selection becomes the SELECT list. |
| Filter rows | Each row: field combo (fields of the checked tables) + operator combo (16 operators: `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `NOT LIKE`, `CONTAINS`, `STARTS WITH`, `ENDS WITH`, `IS NULL`, `IS NOT NULL`, `IN`, `NOT IN`, `BETWEEN`) + value input (+ a second value input shown for `BETWEEN`) + row-logic combo (AND/OR) + Remove (×) button. "Add Filter" adds a row; "Clear" removes all. `IN`/`NOT IN` take a comma-separated list in the single value input. |
| Filter groups | "Add Group" nests filters into AND/OR groups (group logic combo); a global "Combine groups with" AND/OR selector. |
| Quick presets | Today / Last 7 Days / Last 30 Days / High Importance buttons. Each first clears existing filters, then sets the first filter row: a `BETWEEN` date range on the first available date field (Today: today→today; Last 7 Days: 7 days ago→today; Last 30 Days: 30 days ago→today), or `>= 0.7` on the first available importance field (High Importance). |
| Order By | field combo + direction combo (ASC / DESC). |
| Limit | checkbox (default off — no LIMIT clause when off) + spin box 1–10000 (default 100). |
| Generated SQL preview | Read-only box showing the SQL that will run, updated live as selections change. |

### Buttons

- **Execute** (primary) — runs the query: SQL mode executes the editor text as-is (must be a single SELECT statement; semicolons are rejected); visual mode builds a parameterized SELECT from the selections. Results load into the Results panel; errors are shown as a message box plus an error state in the panel.
- **Add Filter / Add Group / Remove (per row)** — visual-mode structure edits.
- **Select All / Deselect All** (fields).
- **Clear** (filters).
- Template buttons (SQL mode) — insert SQL text.

### Filters

The entire Query Builder is itself the filter mechanism (tables, fields, filter rows/groups, presets, ordering, limit). No additional filters.

### Functionality

- **SQL Mode:** free authoring with syntax highlighting; the template grid covers the common cases; the DB tree documents the schema. Execute is SELECT-only and single-statement.
- **Visual Mode:** guided authoring; only the three known tables and their real columns can be selected (allowlisted); filter values are parameterized (no injection); the generated-SQL preview is editable only via the form.
- **Result flow:** Execute → Results panel (with pagination, stats, copy-value menu, "Create chart") → Report Preview (refreshed) → available to Chart Designer, Print, Preview, and all exports.
- **Report title:** independent text in the Preview pane.

### Pagination

None here (the query's own Limit caps rows; the Results panel paginates the returned set).

---

## 17.2 Reports — Chart Designer Interface (left pane, bottom)

Creates a chart from the current result set.

### Columns

| Element | Values / default | Meaning |
|---|---|---|
| View toggle | Chart (default) / Table | Switches the pane between the chart canvas and the underlying data table the chart uses. |
| Chart Type | Pie (default) / Bar / Line / Horizontal Bar / Area / Donut | Matplotlib chart type. |
| Chart Title | line edit (empty) | Title rendered on the chart. |
| Label field | combo (result columns) | Column used for axis labels / slice labels. |
| Value field | combo (result columns) | Column used for values. |
| Aggregation | Count (default) / Sum / Average / Max / Min | How non-numeric or repeated label groups are reduced (Count ignores the value field). |
| Style options | Show Legend (default on), Show Values (default on), Show Grid (default on) | Chart decorations. |
| Color Scheme | Default (default) / Pastel / Dark / Vibrant / Monochrome | 5 fixed palettes. |
| Limit data | checkbox (default off) + spin 1–100 (default 10) | When on, cap the number of categories plotted. |

### Buttons

- **Generate** (primary) — builds the chart with the selected settings on a 6 × 5 inch canvas; a success message on completion.
- **View toggle** buttons (Chart / Table).

### Filters

None (operates on the existing result set).

### Functionality

- **Generate:** aggregates the result rows by label field (with the chosen aggregation), plots with matplotlib (guarded import — a notice is shown if matplotlib is unavailable), and embeds the image in the Report Preview when "Include chart" is on.
- **Table view:** shows the label/value data the chart is built from.
- **"Create chart from results"** (Results panel button) pre-fills the designer with the current result set and jumps here.
- **Chart config** is included in saved reports and restored on Load.

### Pagination

None.

---

## 17.3 Reports — Results Interface (right pane, top)

Shows the query result set.

### Columns

| Column | Source | Meaning | Display |
|---|---|---|---|
| # | derived | Row number in the result set (continues across pages) | integer |
| (dynamic) | query result columns | Whatever the query selected — headers translated to display names | None → `-`; floats → 2 decimals; importance-style 0–1 floats → percentage; timestamps formatted |

Plus an info row: "X rows · Y columns" quick stats and a state label (ready / running / error).

### Buttons

- **Create Chart from Results** — switches the left pane to the Chart Designer with this result set loaded.
- **Context menu (right-click a cell):** Copy value.
- Row selection (single) for reference.

### Filters

None (the query defines the data).

### Functionality

- **Populated** by Query Builder Execute (or by All Data "Generate Report" injection).
- **Stats row** updates with the set size (rows × columns).
- **Error state** shows the failed query's error text.

### Pagination

Yes — the shared pagination widget (default 50/page, 25–500). Page controls and rows-per-page behave as in §2.5; row numbers continue across pages. Printing/preview/export use the full set.

---

## 17.4 Reports — Report Preview Interface (right pane, bottom)

A live HTML preview of the report document as it will print/export.

### Columns

The preview renders: report **title** (from the title field), a **generation timestamp** (date + time), a stats box (**Rows** count, **Columns** count), the **chart image** (when included and a chart exists; a placeholder box when the chart is unavailable), and a **data table** — all result columns with translated headers, up to the first 50 rows (values truncated to 100 characters; a "… N more rows" note when truncated) — and a footer line. RTL rendering when Arabic is active.

### Buttons

- **Report Title** line edit (placeholder hint; the document falls back to the title "Data Report" when empty).
- **Include chart** checkbox (default on).
- **Refresh** — rebuilds the preview from the current result set/title/chart.

### Filters

None.

### Functionality

- **Live preview** of exactly what Print / Print Preview / Export PDF produce (same HTML pipeline, global header, page numbers).
- Title and include-chart settings are saved with the report.

### Pagination

None (the table is truncated to 50 preview rows; the printed/exported document contains the full set).

---

## 17.5 Saved Reports (Save / Load) Interface

Modal dialog (fixed 500 × 400) with two modes.

### Columns

(n/a — a form + list.)

- **Name** line edit (required on save; shown read-only-ish on load).
- **Description** line edit (optional).
- **Saved reports list** — every file in `saved_reports/`, displayed as "Name — Description"; the list refreshes after save/delete.

### Buttons

- **Save** (save mode) — validates the name, writes the JSON report file (name, description, query, query params, title, chart config, orientation, page size, include-chart, created), refreshes the list, success message.
- **Load** (load mode) — with a report selected, restores it into the workspace (query → SQL editor, title, orientation, page size, include-chart, chart config) and executes it.
- **Delete** — deletes the selected saved report file (confirmation).
- **Close** / **Cancel** — dismiss.

### Filters

None.

### Functionality

- **Save mode** is entered from the toolbar Save button; **load mode** from the Load button. Selecting a list item in either mode fills the name/description fields from that report's metadata.

### Pagination

None.

---
## 18. Settings Interface

Modal dialog, fixed 550 × 550, three tabs.

### Columns

(n/a — a settings form.) Settings by tab:

**General tab**

| Setting | Control / values | Default | Effect |
|---|---|---|---|
| Language | combo: English / العربية (Arabic) | English | Full re-translation + LTR/RTL on save |
| Theme | radio: Light / Dark (with a small live preview swatch) | Light | Live theme switch while the dialog is open; reverted on Cancel |
| Font Size | spin 8–16 pt | 10 pt | Application font size |
| Timeline Density | 3-way button group: Compact / Comfortable / Expansive | Comfortable | Timeline card size (also in the Timeline tab) |

**Accessibility tab**

| Setting | Control / values | Default | Effect |
|---|---|---|---|
| High Contrast Mode | checkbox | off | High-contrast palette |
| Font Scale | slider 100–200 % (ticks every 25) | 100 % | Global font scaling |
| Color Blind Mode | combo: None / Protanopia / Deuteranopia / Tritanopia | None | Alt color palette for charts/badges |
| Show Keyboard Shortcuts | checkbox | on | Shortcuts shown in tooltips/hints |
| Enhanced Focus Indicator | checkbox | on | Stronger focus outlines |
| Screen Reader Support | checkbox | on | Accessibility announcements |

**Performance tab**

| Setting | Control / values | Default | Effect |
|---|---|---|---|
| Default Page Size | combo 25 / 50 / 100 / 200 / 500 | 50 | Pagination default for all tables |
| Auto-save Drafts | checkbox | on | Periodic auto-save of drafts |
| Auto-save Interval | spin 30–600 s | 300 s | Auto-save period |

### Buttons

- **Reset to Defaults** — confirmation ("Reset all settings to defaults?") then restores every control to factory defaults.
- **Save** (primary) — writes all values to `config.ini` + `config.json`, applies language/theme/font immediately, applies the accessibility manager settings, success message; the main window re-translates and reloads all tabs.
- **Cancel** — closes; any live theme preview is reverted.

### Filters

None.

### Functionality

- **Live theme preview:** switching the theme radio restyles the running application instantly; Cancel restores the previous theme.
- **Persistence:** every setting survives restart (config files); page size and timeline density also feed their widgets at startup.
- **Language:** switching to Arabic flips the entire application to RTL (layouts, pagination icons, table alignment) and re-applies translations.

### Pagination

None.

---

## 19. Backup & Restore Interface

Modal dialog (fixed 700 × 500) combining backup creation and restore/merge of existing backups.

### Columns

**Backups table** (one row per backup file in the backup folder):

| Column (header) | Source | Meaning | Display |
|---|---|---|---|
| Filename | backup file name | `backup_manual_YYYYMMDD_HHMMSS_ffffff.sqlite` | text (tooltip = full path) |
| Size | file metadata | Backup size | `X.XX MB` |
| Date | backup metadata `created_at` | Creation time | `yyyy-MM-dd HH:mm:ss` |
| Actions | metadata `is_encrypted` | Lock icon when the backup is encrypted | icon (static) |

### Buttons

- **Create Backup** — confirmation ("Create a backup of the database?", Yes default) → runs in a background thread with a progress bar → success message with the file path. The backup is a SQLite copy of all three tables (optionally encrypted per the `[Backup]` setting), with size + checksum recorded in the backup metadata.
- **Restore** (enabled when a table row is selected) — confirmation ("This will replace all current data with the backup. Continue?") → restores the database from the selected backup (schema compatibility is checked first) → all tabs reload.
- **Merge** (row selected) — confirmation → merges the backup's rows into the current database (duplicate rows are detected and skipped) → reload.
- **Restore from File** — file picker (`.sqlite`) → validates the file (structure + schema) → opens the **Backup File Import Preview** dialog (below) → Restore or Merge.
- **Delete** (row selected) — confirmation → deletes the backup file and refreshes the list.
- **Refresh** — reloads the backups list.
- **Table selection:** single-row select enables the action buttons.

**Backup File Import Preview (sub-dialog, opened by Restore from File):**

- **Columns shown:** file name; if the backup is encrypted → an "encrypted" notice; otherwise row counts — "Sources: N", "Contents: N", "Analyses: N"; file size. If the file is invalid → an error message with the reason and only an OK button.
- **Checkbox:** "Copy to backup folder after import" (shown only when the file is outside the backup folder; default on).
- **Buttons:** **Restore** (replaces current data with this file's data), **Merge** (adds it to current data), **Cancel**.

### Filters

None (the list shows every backup file in the folder).

### Functionality

- **Create Backup:** thread-based so the UI stays responsive; progress bar tracks the copy; metadata (type, path, size, tables, encryption flag, checksum, status SUCCESS, timestamp) is recorded; encrypted when the backup encryption setting is on.
- **Restore:** the selected backup replaces the live database file; after the dialog closes, every tab is reloaded. A schema check prevents restoring incompatible files (error message on mismatch).
- **Merge:** row-by-row union with duplicate suppression (all-fields comparison).
- **Delete:** removes only the backup file (never the live database).
- **External file import:** the preview validates before any action; on Restore/Merge the file's data is applied and, if the copy option is set, the file is also stored into the backup folder.
- **Encrypted backups** are decrypted with the configured key during restore/merge (an encrypted file opened without a key is reported as invalid).

### Pagination

Yes — the backups table uses the shared pagination widget (default 50/page; typically far fewer rows than a page).

---

## 20. Reset Interface

Small modal dialog for destructive resets.

### Columns

(n/a.) A bold red warning "WARNING: This operation cannot be undone!", a "Reset Options" group, and an info label.

| Option (radio) | Meaning |
|---|---|
| **Reset Data Only (Delete all records)** — default | Deletes every row from the three tables (content_analysis, contents, sources, in that order); schema and config are untouched |
| **Reset All (Delete database and recreate)** | Copies the current database file to `research_db.sqlite.backup`, deletes `research_db.sqlite`, and re-creates the schema from `schema.sql` (a fresh, empty database) |

### Buttons

- **Reset** (red) — opens a critical confirmation: for data-only, "This will delete ALL data from the database. This cannot be undone! Continue?"; for reset-all, "This will DELETE the entire database and recreate it. This cannot be undone! Continue?" On Yes the operation runs and all tabs reload.
- **Cancel** — closes.

### Filters

None.

### Functionality

- The two options differ exactly as in the table above; the reset-all safety copy (`*.sqlite.backup`) is the only artifact kept.
- After any reset the main window reloads every tab (empty state).

### Pagination

None.

---

## 21. Data Import Interface (Import Preview Dialog)

Modal wizard, fixed 1000 × 700, four step tabs (Select File → Map Columns → Preview & Validate → Import), with Back / Next navigation and Start Import / Cancel.

### Columns

**Step 1 — Select File:**

| Control | Values / default | Meaning |
|---|---|---|
| File path | read-only line edit + **Browse…** | CSV or JSON file to import |
| Format | combo: CSV / JSON | Auto-detected from the file extension on browse |
| Encoding | combo: utf-8 (default) / utf-8-sig / latin-1 / cp1256 / cp1252 | File character encoding |
| Delimiter (CSV) | combo: comma (default) / semicolon / tab / pipe | Field separator |

**Step 2 — Map Columns:** one combo per detected file column; each combo lists the target database fields of the selected table (plus an empty "skip" entry); matching column names (e.g. `name` → `name`, `title` → `title`) are pre-mapped automatically; empty mapping = column skipped.

**Step 3 — Preview & Validate:**

| Column (header) | Source | Meaning | Display |
|---|---|---|---|
| Row status icon | validation | Valid / Warning / Error per row | icon |
| (mapped columns) | file rows | Preview of the mapped data | text; row background colored — green (valid), yellow (warning), red (error) |

Plus a summary label: counts of Valid / Warnings / Errors.

**Step 4 — Import:** a progress bar and a scrolling log of per-row results ("Importing row X of Y…", errors listed).

### Buttons

- **Browse…** — file picker (CSV/JSON).
- **Load & Preview** (Step 1) — parses the file with the chosen encoding/delimiter, auto-maps columns, advances to Step 2.
- **Back / Next** — wizard navigation (Next disabled until the file is parsed; the Import step's "Start Import" is enabled when there is at least one valid row, or valid+warning rows with error-skipping enabled).
- **Validate** (Step 3) — re-runs validation after mapping changes.
- **Start Import** (primary, Step 4) — runs the import in a background thread.
- **Cancel** — aborts and closes.
- **Checkbox:** "Skip rows with errors" (Step 3, default on) — error rows are excluded from the import.

### Filters

None.

### Functionality

- **Target table:** "Import Data" first asks which table to import to (an item prompt listing Sources / Contents / Content Analysis); the wizard then opens for that table, and its Step-2 mapping lists that table's fields. (This is distinct from the per-tab "Import Sources / Contents / Analysis" buttons, which perform the simpler direct CSV import described in those tab sections.)
- **Validation rules per target table** (see §1.1): a required-field failure → **ERROR** row (skipped if skip-on-errors is on); other issues (e.g. invalid URL, importance out of range, source not found for contents, content not found for analysis) → **WARNING** row (still imported).
- **Import execution:** `ImportWorker` QThread iterates rows, calls the table's `add_*` (with the normal duplicate detection — duplicated rows are counted as errors), emits progress/row/completed signals; on completion a summary message (imported count + errors list) is shown and **all tabs are reloaded**. Audit log records the import.
- **JSON import:** same pipeline over parsed JSON objects.

### Pagination

Step 3's preview table is paginated with the shared pagination widget (default 50/page) across the mapped rows.

---

## 22. Export Interface (Unified Export Preview Dialog)

Modal dialog, fixed 900 × 700. Opens from every table tab's Export button (and from the Reports tab's PDF/Excel/CSV exports), always with the **entire filtered dataset** of the calling tab.

### Columns

**Preview table** (top): the first N rows (N = preview count) of the dataset, showing exactly the currently selected export columns (headers = display names). A "Showing 1–N of M" range label sits beside the preview-count spin.

**Column selection list** (bottom-left): one row per exportable column:

| Element | Meaning |
|---|---|
| Checkbox | Include the column in the export. Displayed (table) columns are listed first in bold; additionally available data fields (e.g. `source_name` on Contents/Analysis/All Data, joined or extra keys) are listed after. Default: all selected (or the last-saved selection). |
| Width spin | Column width as a percentage, 5–60 % (default ≈ 100 ÷ number of columns, clamped 5–30) — used for Excel/PDF layout. Persisted. |

### Buttons

- **Select All / Deselect All** (column list).
- **Format radios (7):** Excel .xlsx (default) | CSV .csv | Word .docx | PDF .pdf | JSON .json | XML .xml | JSON Lines .jsonl.
- **Options checkboxes:** Include document header (the global print/header block, where the format supports it — Excel/Word/PDF) (default on) | Translate field names to current language (default on) | Open file after export (default on).
- **Filename** line edit — defaults to `<table>_<YYYYMMDD_HHMMSS><ext>` and updates when the format changes — + **Browse…** (save-file dialog; the extension follows the chosen format).
- **Export** (primary, min-width 150) — writes the file; success message with the path; opens the file when the option is set.
- **Cancel** — closes.
- **Preview rows** spin (5–100, default 20) — how many rows the preview table shows.

### Filters

None (the dataset and its filters were chosen before the dialog opened; the column checkboxes are the only in-dialog selection).

### Functionality

- **Preview:** live-updates as columns are toggled (preview table + "Showing" label).
- **Excel (.xlsx):** one sheet (named after the table) with a professional header block drawn from the global print/header settings (organization lines, document info, footer text), then the data table with a styled header row, per-column percentage widths, formula-safe values; the sheet view is RTL when Arabic is active; only selected columns.
- **CSV:** header row of display names (translated when the option is on); string values beginning with `=`, `+`, `-`, or `@` are apostrophe-prefixed so spreadsheets treat them as text (formula-injection protection); only selected columns.
- **Word (.docx):** document with the professional header from the global settings (when the option is on), a centered "<table> Report" title, and one styled block per record listing the selected fields as label/value pairs; the document is RTL when Arabic is active.
- **PDF:** the export HTML (global header, page numbers per the global print settings, RTL + Arabic font when Arabic is active) rendered to PDF; always landscape.
- **JSON:** a top-level object `{ export_date, record_count, records: [...] }` where `records` holds one object per row (keys = selected columns), 2-space indented, UTF-8.
- **XML:** root element named after the table carrying `export_date` and `record_count` attributes; one `<record>` element per row with a child element per non-NULL field; pretty-printed.
- **JSON Lines (.jsonl):** one compact JSON object per line.
- **Persistence:** the selected format, column selection, and column widths are saved (ExportSettings) and pre-applied the next time the dialog opens.

### Pagination

None (preview is a fixed top-N slice; the export itself always contains all filtered rows).

---
## 23. Print / Export Column Selection Interface

Modal dialog (fixed 550 × 500) opened by the table tabs' **Print** action (and the Reports tab's Print / Print Preview) before printing.

### Columns

One row per column of the calling table:

| Element | Meaning |
|---|---|
| Info label + total label | "Select columns to export" hint; the total label shows the sum of the current widths. |
| Checkbox (per column) | Column name (display header); checked = included in the output. All checked by default (or last saved selection). |
| Width spin (per column) | Column width in percent (5–60), applied to the generated document table. |
| "Auto" checkbox (per column) | Lets the layout choose that column's width automatically (disables the width spin while on). |

### Buttons

- **Select All** / **Deselect All** — bulk column toggles.
- **Equal Widths** — distributes the total evenly across selected columns.
- **Auto All** — turns on auto-width for every column.
- **OK** — proceeds (print: to the system print dialog; export: to the save dialog).
- **Cancel** — aborts.

### Filters

None.

### Functionality

- Controls which columns appear in the print/PDF output and how wide they are; the selection and widths are persisted and pre-applied next time.
- After OK, the document HTML is built with the global print header/footer and sent to the printer (page numbers per the global print settings, orientation per the print setting).

### Pagination

None.

---

## 24. Print & Export Header Settings Interface (Global Header)

Modal dialog (fixed 800 × 650) defining the **global document header and footer** used by every print action and PDF export. Opened from the "Set Header" button (View group) and from Tools → Print Settings.

### Columns

(n/a — a form with a live preview.)

**Header (left / center / right):**

| Field | Control | Default | Meaning |
|---|---|---|---|
| Header line 1 | line edit | empty | e.g. organization name |
| Header line 2 | line edit | empty | e.g. department |
| Header line 3 | line edit | empty | extra info |
| Logo | preview image + **Select Logo…** / **Clear Logo** buttons | none | Centered header image |
| Document number — auto | checkbox | on | Auto document numbering |
| Document number — prefix | line edit | `DOC` | Prefix for the auto number (e.g. "DOC-001") |
| Document number — manual | line edit | empty | Manual number override |
| Header date — show | checkbox | on | Date in the header |
| Header date — format | combo | `yyyy-MM-dd` | One of several date formats |
| Header date — extra | line edit | empty | Extra text next to the date |

**Footer:**

| Field | Control | Meaning |
|---|---|---|
| Footer left / center / right | 3 line edits | Free footer text |
| Page numbers — show | checkbox (default on) | Page numbers in the footer |
| Page numbers — format | combo: `page X of Y` / `X of Y` / `X / Y` / `X only` | Number style |
| Page numbers — position | combo: left / center / right | Footer position |

**Live preview:** a rendered header + footer sample at the bottom of the dialog that updates as the user types.

### Buttons

- **Select Logo… / Clear Logo** — logo file management.
- **Reset Settings** — restores factory header/footer defaults.
- **Save & Close** (primary) — persists the settings to the print-settings store and closes; all subsequent print/PDF actions use them.
- **Cancel** — closes without saving.

### Filters

None.

### Functionality

- The settings apply globally to: table Print, Print/PDF export, Report Print/Preview/PDF, Timeline Print/export, CSV/Excel/Word "include header" option.
- Auto numbering increments per generated document; the prefix is prepended; the manual field overrides the auto value.
- Page-number style/position and footer text appear on every printed/exported page.

### Pagination

None (the preview shows a single sample page).

---

## 25. Advanced Search Interface

Modal dialog (fixed 1000 × 800, horizontal split ≈ 700/300): a condition builder + results on the left; saved searches / history / frequently used on the right.

### Columns

**Condition rows (left, top):** each row has:

| Element | Values |
|---|---|
| Field combo | The real fields of the current table (allowlisted per table: sources, contents, content_analysis) |
| Operator combo | `=`, `!=`, `LIKE`, `NOT LIKE`, `>`, `<`, `>=`, `<=`, `IS NULL`, `IS NOT NULL` |
| Value input | text (hidden/disabled for IS NULL / IS NOT NULL) |

Plus an **Add Condition** button and a **Logic** combo (AND default / OR) combining all conditions.

**Results table (left, bottom):** `#` row number + the table's columns for the matching rows (same display rules as the tab table). A results-count label ("N results") and a state label above it.

**Right-side tabs:**

| Tab | Columns / content |
|---|---|
| Saved Searches | list of saved search names (per table) |
| History | list of past search conditions (recent first) |
| Frequently Used | list of most-used saved searches (by use count) |

### Buttons

- **Add Condition** / per-row **Remove** (×).
- **Search** (primary) — executes the conditions against the database (`advanced_search` with field/operator validation; invalid field or operator → error message; the `coordinates` field is accepted as an alias of `list_coordinates` for content_analysis).
- **Clear** — removes all conditions and results.
- **Save Search** (menu button): "Save as New…" (name prompt → stored in the search-history store with its conditions and logic) or "Update Existing" (updates the selected saved search).
- **Close** — applies the results to the parent tab (the tab's table shows the search results, paginated) and closes.
- **Saved Searches tab:** Load (applies that search), Delete (removes it), context menu (Load/Delete).
- **History tab:** Load (re-applies a past search), Clear History (empties it), context menu.
- **Frequently Used tab:** double-click loads the search.

### Filters

The condition builder IS the filter (multi-condition, per-condition operators, AND/OR logic).

### Functionality

- **Search execution:** builds a parameterized WHERE from the conditions (each value parameterized), runs it on the calling table, and shows results with a count; the search is added to history; `search_executed` is emitted.
- **Results → tab:** Close replaces the parent tab's dataset with the result set (paginated from page 1) until the next Refresh.
- **Persistence:** saved searches, history, and use counts are stored by the SearchHistoryManager (max 50 history entries by configuration `[Search] max_history`).
- **Frequently Used** ranks saved searches by how often they have been loaded.

### Pagination

Yes — the results table uses the shared pagination widget (default 50/page, 25–500) with "Showing X–Y of Z" over the full result set.

---

## 26. Bulk Operations Interface

Modal dialog (fixed 800 × 600) for operating on many records at once. Opened from the More menu or the selection action bar of any table tab.

### Columns

**Operation Type (radio group, top):**

| Option | Meaning |
|---|---|
| **Bulk Delete** (default) | Delete the selected records |
| **Bulk Edit** | Set field values on the selected records |
| **Bulk Import** | Append rows from a CSV file |

**Select Records tab:** a table with a leading **checkbox column** (width 64) + the table's data columns (headers with tooltips). Rows = the calling table's full dataset; rows already selected in the tab arrive pre-checked. A selection-count label ("N selected") updates live.

**Edit Fields tab:** one **auto-complete line edit per editable column** (all columns except `id`, `date_creation`, `date_modified`), with the hint "Leave empty to keep current value." Suggestions come from existing values in that column.

**Import File tab:** a read-only path field + **Browse…** (CSV) + the hint that the file should have columns matching the table structure.

### Buttons

- **Select All / Deselect All** (Select Records tab).
- **Browse…** (Import File tab).
- **Execute** (primary, green) — runs the chosen operation (see below); a progress bar tracks the operation.
- **Cancel** — closes without changes.

### Filters

None (the selection IS the scope).

### Functionality

- **Bulk Delete:** no selection → warning "No records selected". Otherwise confirmation "Delete N record(s)?" → deletes each record with the normal per-table delete (cascade applies) → progress bar → "Deleted N record(s)" → emits completion → tab reloads. Audit log.
- **Bulk Edit:** no selection → warning. Collects the non-empty field edits (empty = keep); none → warning "No fields to update". Otherwise updates each selected record with those field values (row read → fields overwritten → written back) → progress → "Updated N record(s)". Audit log.
- **Bulk Import:** no file → warning "Please select a file to import". Otherwise reads the CSV (utf-8), maps columns by name to the table's fields, and adds each row through the normal `add_*` path (validation + duplicate detection) → progress → "Imported N record(s)" plus up to 10 error lines. Audit log.
- **Selection hand-off:** the dialog can be opened with the tab's current selection pre-checked; after completion the calling tab reloads.

### Pagination

None (the selection table shows the full dataset; no page controls).

---

## 27. Attachment Manager Interface

Modal dialog (fixed 800 × 600, horizontal split) listing and managing the attachment files of a source. Opened from the sidebar (all sources) or from Contents "View Attachments" (that source's attachments).

### Columns

**Left pane — Sources list:** one entry per source that has attachments, shown as the source name with its attachment count (e.g. "Source Name (3)").

**Right pane — Attachments list:** one entry per file of the selected source: file name (with tooltip = full path). Multi-select supported.

### Buttons

- **Open Folder** — opens the selected source's attachment folder in the OS file manager.
- **Open** (right pane) — opens the selected attachment file with the OS default application.
- **Delete** (right pane) — confirmation ("Delete N attachment(s)?") → removes each file from disk and from the `attachments` path lists of the affected contents rows → refreshes both panes.
- **Refresh** — reloads the source list and attachments from disk/DB.
- **Close** — closes.
- **Double-click** an attachment → opens it.

### Filters

None (the left list is the source scope).

### Functionality

- **Folder structure:** files live under the attachment base path `Source/<sanitized source name>/`; the manager reads the actual directory and the `contents.attachments` semicolon lists.
- **Selection:** choosing a source loads its files; multi-selecting files enables batch Open/Delete.
- **Delete safety:** confirmation required; after deletion the lists are rewritten and the UI refreshed.
- **No attachments:** the source list is empty (nothing has files) — the panes show empty states.

### Pagination

None (scrollable lists).

---

## 28. Attachment Preview Interface

Tabbed preview window titled "Preview Attachments" for viewing an attachment in-app before or instead of opening it externally.

### Columns

Three preview tabs, each rendering the loaded file for its type:

| Tab | Renderer |
|---|---|
| Image | scaled image view (png/jpg/jpeg/gif/bmp/webp) |
| PDF | embedded PDF page view |
| Document | document-info panel (name, size, type, path) |

### Buttons

- **Open File** (per tab) — opens the attachment with the OS default application.
- **Download File** (per tab) — save a copy of the file via a file picker.

### Filters

None.

### Functionality

- Opened from Contents "View Attachments" (pre-loaded with the first attachment of the selected content) and from the attachment lists elsewhere; `preview_file` switches to the appropriate tab and renders the file.

### Pagination

None.

---

## 29. Performance Monitor Interface

Modal dialog (fixed 800 × 600) opened from Tools → Performance Monitor. Read-only diagnostics.

### Columns

**Summary block:** Total Queries (last 5 min), Total Time (ms), Average Time (ms), Max Time (ms), Slow Queries count, Very Slow Queries count — plus two progress bars (average query time; slow-query percentage).

**Slow queries table:**

| Column (header) | Meaning |
|---|---|
| Table | The table the slow query touched |
| Time | Execution time (ms) |
| Rows | Rows returned |
| Query | First 100 characters of the SQL (full SQL in tooltip) |

**Suggestions pane:** color-coded optimization suggestions (error = red, warning = amber, info = blue), each with title, description, and suggestion; "No optimization issues detected" when clean.

### Buttons

- **Refresh** — re-reads the metrics and recent slow queries.
- **Clear Metrics** — resets the collected metrics.
- **Close** — closes.

### Filters

None (metrics cover the last 5 minutes of query activity).

### Functionality

- The PerformanceMonitor records every executed query's table, duration, and row count; the dialog displays aggregates, the 20 most recent slow queries, and heuristic optimization hints (e.g. missing-index or expensive-query patterns).

### Pagination

None (the slow-queries table is capped at 20 rows).

---

## 30. Help Interface

### Columns

**Help dialog** (fixed 900 × 700; RTL when Arabic): a left **Topics tree** (max width 250) and a right **content pane** (rich text). Topics: Getting Started, Sources Management, Contents Management, Content Analysis, Timeline, Reports, Export, Search & Filter, Bulk Operations — each with title + multi-paragraph content (translated EN/AR).

### Buttons

- **Topic selection** (tree click) — loads the topic's content.
- **Close** — closes the dialog.
- (Main window) **Keyboard Shortcuts…** menu item — opens a shortcuts reference dialog listing every binding: F1 Help; Ctrl+Q Exit; Ctrl+S Save (reports); Ctrl+N New (reports); Ctrl+E Print; Ctrl+D Print Preview; Ctrl+F Find; Ctrl+R Refresh; Ctrl+P Print (reports); Ctrl+1–6 switch tabs; Ctrl+I Import Data; Escape close dialog; Enter activate; Tab / Shift+Tab move focus; Ctrl+Home / Ctrl+End first/last row; Page Up / Page Down previous/next page; table keys Up/Down/Home/End/Space/Enter.
- **About** menu item — message box with the product title and version (2.1.0).

### Filters

None.

### Functionality

- F1 (or Help → Help…, or the header Help button) opens the Help dialog on Getting Started; content is fully translated; RTL layout for Arabic.

### Pagination

None.

---

## 31. Index of Interfaces

| # | Interface | Entry point |
|---|---|---|
| 3 | Application Shell (main window) | startup |
| 4 | Sources | sidebar / View / Ctrl+1 |
| 5 | Source Entry (Add/Edit) | Sources → Add / Edit / double-click / Duplicate |
| 6 | Contents | sidebar / View / Ctrl+2 |
| 7 | Content Entry (Add/Edit) | Contents → Add / Edit / double-click / Duplicate |
| 8 | Analysis | sidebar / View / Ctrl+3 |
| 9 | Analysis Entry (Add/Edit) | Analysis → Add / Edit / double-click / Duplicate |
| 10 | All Data | sidebar / View / Ctrl+4 |
| 11 | Quick View | All Data row → Quick View |
| 12 | Content Preview | Contents → Preview Content |
| 13 | Comparison Dialog | Analysis → Compare |
| 14 | Summary Dialog | Analysis → Summary |
| 15 | Timeline | sidebar / View / Ctrl+5 |
| 16 | Timeline Export | Timeline → Export |
| 17 | Reports (workspace) | sidebar / View / Ctrl+6 |
| 17.1 | Reports — Query Builder | Reports left pane |
| 17.2 | Reports — Chart Designer | Reports left pane / Create chart |
| 17.3 | Reports — Results | Reports right pane |
| 17.4 | Reports — Report Preview | Reports right pane |
| 17.5 | Saved Reports (Save/Load) | Reports → Save / Load |
| 18 | Settings | header / sidebar / menu / Ctrl (Tools) |
| 19 | Backup & Restore | sidebar / menu |
| 20 | Reset | Tools → Reset |
| 21 | Data Import (4-step wizard) | sidebar / menu (Ctrl+I) |
| 22 | Export (unified preview) | any table tab → Export; Reports → Export PDF/Excel/CSV |
| 23 | Print/Export Column Selection | any table tab → Print |
| 24 | Print & Export Header Settings | any table tab → Set Header; Tools → Print Settings |
| 25 | Advanced Search | table tabs → More → Advanced Search |
| 26 | Bulk Operations | table tabs → More / selection bar → Bulk Operations |
| 27 | Attachment Manager | sidebar → Manage Attachments; Contents → View Attachments |
| 28 | Attachment Preview | Attachment Manager / attachments list |
| 29 | Performance Monitor | Tools → Performance Monitor |
| 30 | Help (dialog / shortcuts / About) | F1 / Help menu / header Help |

---

*End of specification. All behaviors described above are taken directly from the implemented code (PyQt5 UI modules, `db/db_manager.py` queries, `db/schema.sql` schema, validation in `utils/data_validation.py`, and the `doc/USER_GUIDE.md` project report); where a control's default or limit is stated, it is the value in the code.*