# Design System — “Graphite & Iris”

The single source of visual truth for Text Analysis. All values below are
defined as tokens in `src/index.css`; **components must never hard-code a
color, radius or duration.** Light is the default canvas; a `.dark` class
on `<html>` swaps the palette; `.dark.high-contrast` and a
color-blind-safe mode live in Settings.

## 1 · Foundations

### Type
| Role | Spec |
|---|---|
| Display font | `--font-display` — Plus Jakarta Sans (titles, labels, badges) |
| Body font | `--font-body` — Inter (UI text, cell copy) |
| Data font | `--font-mono` — JetBrains Mono (numbers, IDs, dates; always with `.tnum`) |
| Root | `html { font-size: 13.5px }` — every `rem` below is ×13.5 |
| Page title | 17px / 700 / −0.01em, display |
| Section / modal title | 13.5–15.5px / 700, display |
| Field & table labels | 0.84–0.94rem scale below; **sentence case, never all-caps** |
| Table header | 0.84rem (≈11.3px) / 600, `--fg-soft` |
| Table cell | 0.94rem (≈12.7px) / 450, `--fg`; primary column 500 |
| Helper / meta | 0.7–0.74rem, `--muted-fg` |

### Surfaces & depth (light)
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#E9ECF4` | canvas (two fixed radial washes sit behind the app) |
| `--surface` | `#FFFFFF` | cards, rails, inputs |
| `--surface-2` | `#F6F8FC` | quiet rails, footers, meta chips |
| `--surface-3` | `#EDF0F7` | hovers, insets |
| `--surface-inset` | `#F0F2F8` | wells (sparklines, code) |
| `--border` | `#DFE4EE` | hairlines |
| `--border-strong` | `#C9D1E0` | control borders |
| `--shadow-1/2/3` | — | card / floating pill / overlay elevation |
| `--shadow-pop` | — | menus & modals |

### Brand & semantics
One controlled accent — iris `--primary: #4F46E5` (dark: `#818CF8`) —
with `--brand-grad` used **only** on: primary CTA glow accents, active
nav bar, page-header flourishes and the wordmark. Semantics:
`--success #15803D`, `--warning #B45309`, `--error #DC2626` (+ `-soft`
tints). **Rule: solid red appears only on a confirmation CTA;
destructive toolbar actions are soft-tinted pills** — color carries
weight, not decoration.

### Geometry & motion
`--radius-sm 5px` (chips), `--radius 8px` (controls), `--radius-lg 14px`
(cards, modals), `--radius-full` (dots). Durations `--t-fast 120ms`,
`--t-med 200ms`, `--t-slow 320ms` with `--ease-out`; all motion collapses
under `prefers-reduced-motion`. `--control-h: 32px` is the universal
control height.

## 2 · The unified control system (CSS classes)

Defined in `@layer components` of `src/index.css` so Tailwind utilities
can still override locally — **do not re-inline these properties.**

| Class | Contract |
|---|---|
| `.ctrl` | every text-like field (Input, Select, Textarea, SearchInput, ColumnFilter): 32px, 8px radius, hairline inset, 0.92rem type, states: hover border tint → focus ring + glow → `:disabled` inset panel → `[data-error="true"]` red ring. `select.ctrl` reserves a chevron gutter; `textarea.ctrl` auto-heights; `.ctrl-sm` is the 26px table variant. |
| `.fgroup` | grouped multi-part controls (date/time, number+`%`): one frame, `:focus-within` ring; children `.fgroup-tag` (inline label), `.fgroup-act` (NOW-style utility), `.fgroup-x` (clear ×). Native spinners suppressed; picker indicator dimmed. |
| `.row-cb` | 18px checkbox frame, `data-on` fill, hover border, `:focus-visible` ring — always via `RowCheckbox` (hidden native input + `.row-cb` span; `mixed` → real indeterminate). |
| `.field-label` | sentence-case 0.84rem/600 `--fg-soft` label; required marker is a subtle red `*`. |
| `.imp-range` | 4px filled slider with soft scaling thumb (`--fill` custom prop drives progress). |
| `.work-card`, `.rail-row` | workspace composition (below). |
| `.form-section` | modal caption: quiet sentence-case label + hairline rule. |

**Buttons** (`Btn`): heights 32 / 28 / 26 (`sm/xs`), md 36. Variants:
`primary` (solid iris, subtle shadow, brightness hover), `secondary`
(bordered surface), `subtle`, `ghost`, `danger` (tinted red),
`danger-solid` (confirmation CTAs only), `success`. Press response =
scale 0.985 — no hover lift. `IconButton` = 30px square, mandatory
`label` → aria-label + tooltip.

**Inputs must never fight the grid**: toolbars, rails and modals all use
the same 32px line, so adjacent controls align to the pixel by
construction.

## 3 · Workspace card composition

Table workspaces (Sources, Contents, Analysis, All Data) read as **one
framed surface**, not a stack of bands:

```
PageHeader   plain surface · 17px title · soft icon chip · count chip · primary action
┌ work-card (mx-3 mb-3 · border · r14 · shadow-1 · overflow-hidden) ┐
│ rail-row          commands + live results meta (ResultsStrip) + ⋯  │
│ rail-row--quiet   search · type/date filters · Clear (disabled-    │
│                   until any filter incl. per-column/advanced)       │
│ (warning callout rows, e.g. vocabulary drift, when relevant)        │
│ table region (flex-1 min-h-0) — DataTable                           │
│ FullTextPreview — collapsed 40px strip, expands to a reading       │
│                   workspace (78ch measure + meta rail)              │
│ PaginationBar — segmented cluster, filled active-page pill          │
└─────────────────────────────────────────────────────────────────────┘
SelectionBar — floating pill (border + shadow-2), outside the card
```

Rails: 7px×12px padding, 6px gaps, single hairline rhythm; quiet rail on
`--surface-2`. Dialogs always render **outside** the card so they are
never clipped.

## 4 · Data grid (DataTable)

- Sticky head: 34px, `--thead-glass`, single 1px bottom rule; sort
  affordance reveals on hover, active sort is iris.
- Rows: 36px comfortable (density setting maps 32/36/44); 12px gutters;
  hairline separators; near-invisible zebra (`--row-tint`); hover
  `--row-hover`; selection = flat `--primary-soft-2` + 2px start accent
  (no gradients in rows).
- Semantics: `role="grid"` selection via hidden native checkboxes;
  header checkbox indeterminate on partial; Ctrl/⌘ and Shift range
  select retained.
- Cell recipes: primary text 500 weight + `title` on truncation;
  badges = 20px `rounded-[7px]` chips with 8% `color-mix` tint and a
  type-dot; URLs = icon + hostname/path with full value in `title`;
  dates = mono date + muted time; importance = 5×64px track, neutral
  mono readout, semantic fill (<0.35 muted → <0.6 iris → <0.85 amber →
  red).
- Recharts must receive **literal hexes** from the palette (SVG attrs
  don’t resolve CSS vars); SVG components (sparklines, donuts) may use
  `var()`.

## 5 · Modals

`Modal` is the only dialog primitive (focus trap, Esc, labelled). Sizes:
`sm/md/lg/xl` + `form` (760px) for entity editing. Chrome: 14px radius,
2px accent bar, flat header (15.5px title) / body (24px padding) /
52px footer band. `FormModal` adds the footer contract: flex spacer →
secondary **Cancel** → primary **Save**. Field IA stays with the owning
view; visual grouping uses `.form-section` captions.

## 6 · Iconography

`src/components/icons.tsx` re-exports **Lucide only**, via
`createAppIcon` with size tokens (`xs 12 / sm 14 / md 16 / lg 20`).
Rules: semantic icons, one stroke weight, never a text character or
emoji as an icon (audited), icon-only buttons need `label` (aria +
tooltip), decorative icons are `aria-hidden`. The DOM harness fails the
build on violations; only `—` `·` `→` are tolerated in copy.

## 7 · Language, direction, states

Every visible string goes through `src/i18n` (EN + AR) — never
hard-code. Arabic flips the shell to RTL; layouts use logical props
(`ps/pe`, `ms/me`, `start/end`). Required interactive states on every
control: default / hover / focus-visible / active-press / selected /
disabled (40% opacity, inert cursor) / loading (`Spinner` in `Btn`) /
error (`[data-error]`). Transitions stay ≤200ms except chart/panel
motion (300ms).

## 8 · Migration checklist (remaining views)

Timeline, Reports, Activity, Dictionary and Settings still use legacy
bands; they already inherit controls, buttons, typography and theming.
To finish: wrap each view’s body in `.work-card mx-3 mb-3`, convert
toolbars/filter stacks to `rail-row`s, and keep dialogs outside the
card. The dashboard is exempt (it is a panel grid on the canvas).
