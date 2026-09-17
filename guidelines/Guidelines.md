# Text Analysis Manager — Design Guidelines

> **Status (2026-09):** this document was written for the earlier
> “Swiss Precision / teal” direction and is now **superseded** by the
> implemented system. The authoritative spec is
> [`docs/DESIGN_SYSTEM.md`](../docs/DESIGN_SYSTEM.md) (“Graphite &
> Iris”), and the tokens live in `src/index.css`. What follows is kept as
> the short contract; the old palette table has been retired.

## Stance: quiet enterprise precision

Dense, calm, and deliberate. One controlled accent (iris `#4F46E5` on
light, `#818CF8` on dark) on layered neutral surfaces. Depth comes from
borders and 2-step surface elevation, not from gradients or heavy
shadows; the brand gradient appears only on CTA glow, active-nav and the
wordmark. Color communicates weight — solid red only on confirmations.

## Color system (summary)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | #E9ECF4 | abyss navy | canvas with two fixed radial washes |
| `--surface` / `--surface-2` / `--surface-3` | #FFFFFF / #F6F8FC / #EDF0F7 | stepped navy | cards / quiet rails / hovers |
| `--fg` / `--fg-soft` / `--muted-fg` | #10182B / #38415A / #646E86 | paper scale | text hierarchy |
| `--primary` | #4F46E5 | #818CF8 | accents, selected state, focus |
| `--success` / `--warning` / `--error` | #15803D / #B45309 / #DC2626 | brightened | semantics (soft tints for fills) |
| `--border` / `--border-strong` | #DFE4EE / #C9D1E0 | navy scale | hairlines / control borders |

## Typography

Plus Jakarta Sans (display/labels), Inter (body), JetBrains Mono for
data (`tnum`). Root 13.5px; sentence case everywhere — never
all-caps shouting for headers or labels. Scale is fixed in
`docs/DESIGN_SYSTEM.md` §1.

## Components

Single control system (`.ctrl` / `.fgroup` / `.row-cb`, 32px line height
`--control-h`) shared by toolbars, filter rails, tables and dialogs —
adjacent controls align by construction. Table workspaces compose as one
framed **workspace card** (command rail, quiet filter rail, grid,
preview, segmented pagination), not stacked full-bleed bands. Radii:
5/8/14px; motion 120–200ms and reduced-motion aware; checkbox is a
modern 18px frame with real indeterminate state.

## Iconography

Lucide only (`src/components/icons.tsx`); never text glyphs or emoji;
icon-only controls require label + tooltip + focus ring (audited by the
DOM harness).

## Internationalization & accessibility

All strings via `src/i18n` (EN + AR); RTL via logical properties;
every state designed: hover / focus-visible / pressed / selected /
disabled / loading / error. High-contrast and color-blind-safe modes.
