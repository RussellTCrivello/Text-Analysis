# Text Analysis Manager — Design Guidelines

## Stance: Swiss Precision

The UI follows a Swiss grid aesthetic — strict structure, generous whitespace, function-first hierarchy. No decorative elements. Every element earns its place.

## Color System

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | #F1F5F9 | #0F172A | Page background |
| `--fg` | #0F172A | #F1F5F9 | Default text |
| `--card-bg` | #FFFFFF | #1E293B | Cards, surfaces |
| `--primary` | #0F766E | #14B8A6 | Accent, CTAs, selected state |
| `--primary-fg` | #FFFFFF | #0F172A | Text on primary |
| `--secondary-bg` | #E2E8F0 | #334155 | Alternating rows, secondary surfaces |
| `--muted-fg` | #64748B | #94A3B8 | Labels, captions, hints |
| `--border` | #CBD5E1 | #334155 | Hairline rules |
| `--sidebar-bg` | #0F172A | #020617 | Navigation sidebar |
| `--sidebar-active` | #0D9488 | #14B8A6 | Active nav item |

## Typography

- **Display / Navigation**: Outfit (Google Fonts) — 300–700 weight
- **Body / Data**: Source Sans 3 (Google Fonts) — 400, 600 weight
- **Mono / IDs / Code**: DM Mono (Google Fonts) — 400, 500 weight

Font size base: 13px (adjustable in Settings, 9–18px range)

## Record Type Colors

| Type | Color | Badge |
|---|---|---|
| Source | #1d4ed8 (blue) | SOURCE |
| Content | #15803d (green) | CONTENT |
| Analysis | #b45309 (amber) | ANALYSIS |

## Importance Scale

Stars (★) colored by level:
1. #94a3b8 — Very Low
2. #64748b — Low  
3. #f59e0b — Medium
4. #ef4444 — High
5. #dc2626 — Critical

## Internationalization

Languages are added by creating a new locale file in `src/i18n/locales/`.
Each file must satisfy the `TranslationShape` type exported from `en.ts`.

```typescript
// src/i18n/locales/fr.ts
import type { TranslationShape } from './en';
const fr: TranslationShape = { /* ... */ };
export default fr;
```

Then register in `src/i18n/index.tsx`:
```typescript
import fr from './locales/fr';
const locales = { en, ar, tr, fr };
```

RTL direction is applied automatically when language is set to `ar`:
```typescript
document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
```

## Data Architecture

All data lives in React Context (`src/store/AppContext.tsx`) and persists to `localStorage`.

To add a new field to a record type:
1. Update the interface in `src/types/index.ts`
2. Update `emptySource()` / `emptyContent()` / `emptyAnalysis()` in the view file
3. Add the field to the form dialog
4. Add the column to the DataTable columns array
5. Update translations in all locale files

## Adding a New Section

1. Create `src/views/NewSectionView.tsx`
2. Add nav item type to `NavSection` in `src/types/index.ts`
3. Add nav icon to `NAV_ICONS` in `AppShell.tsx`
4. Add label to all locale files
5. Add `case 'newSection':` to `renderSection()` in `App.tsx`

## Component Patterns

### Toolbar
```tsx
<Toolbar>
  <Btn variant="primary">+ Add</Btn>
  <Btn disabled={!selected}>Edit</Btn>
  <ToolbarSep />
  <div className="flex-1" />  {/* right-align remaining items */}
  <SearchInput value={search} onChange={setSearch} />
</Toolbar>
```

### DataTable
Columns define `render` for custom cells. Sort is handled internally. Parent controls `selectedId`.

### FormModal
Pass `saveDisabled` to disable Save when required fields are empty.
