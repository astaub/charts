# Build report — terminal-chart design system

**One-liner:** *Beautiful charts inside your CLI.*

agentviz went from a plain ASCII plotter to a coherent terminal-chart **design
system**: every kind draws from one shared component set, comes out beautiful
with zero tuning, degrades cleanly to monochrome, and composes into dashboards.

## What shipped (PRs #2–#11, all merged or open + freeze-verified)

**Foundation**
- `cli-viz/theme.ts` — color/degrade layer (truecolor on a TTY / `FORCE_COLOR`,
  clean monochrome Unicode when piped, off under `NO_COLOR`), one canonical blue
  ramp, a coherent categorical palette, the `heat()` ramp, and the glyph sets
  (eighth blocks, box drawing, shades, braille).
- `cli-viz/components.ts` — `panel`, `legend`, `swatch`, `colorLabel`, `meter`
  (+ reference marker), `meterTable`, `deltaBadge`, `inlineSparkline`.
- `cli-viz/render-context.ts` — the single ANSI-aware width model + `makeRenderCtx`.

**Every chart kind on the system**
- bar, funnel, line (linear / step / markers / **braille** / **area**),
  sparkline, retention heatmap (truecolor heat cells), stacked, grouped,
  waterfall (MRR bridge), bignumber (KPI tile), scatter (quadrant analysis).

**Growth features (the differentiators)**
- **Delta indicators** — `▲/▼` + change, **semantic** green-good / red-bad via a
  per-metric `goodDirection` (churn-down = green, latency-up = red).
- **KPI tiles** — label · big value · delta · mini-sparkline, composable.
- **Goal / reference lines** — dashed amber target on bar (vertical) and line
  (horizontal), labeled.

**Dashboards**
- `cli-viz/dashboard.ts` (`renderDashboard`) + `dashboard` CLI kind +
  `@staub/agentviz/dashboard` subpath. Composes rows of panels into a grid.

## Gallery (docs/screenshots/)
- `dashboard.png` — the hero: KPI tile row · trend-vs-goal · funnel + retention.
- `kpi-tiles.png`, `scatter_after.png`, `funnel-after.png`, `bar-after.png`,
  `line_braille.png`, `line-area.png`, `retention_after.png`,
  `waterfall_after.png`, `bar-goal-line.png`, `delta-indicators.png`, + before/afters.

## Quality
- **189 tests** green; typecheck + `tsc` build clean; `dist/` in sync.
- A panel-right-border **equal-visible-width regression test** covers every
  paneled kind (bar/funnel/line ×3/retention/stacked/grouped/waterfall/bignumber/
  bar-goal/scatter) so a ragged edge can't return.
- Truecolor-in-TTY / mono-when-piped verified end-to-end (incl. the dashboard).
- Realistic `fixtures/` for every kind + the growth dashboard.

## Known gaps / notes for review
- **Freeze + braille:** the `freeze` screenshot tool renders braille glyphs wider
  than ASCII spaces in the bundled macOS mono fonts, so braille/area *screenshots*
  can look slightly ragged. This is a tool artifact — real terminals render braille
  at width 1, so the border is one clean column (the regression test enforces it).
  The default linear line + all block-based kinds are clean in freeze too.
- **Stacked wide view** shows the colored bar + legend + total; exact per-segment
  counts/shares live in the narrow (block) view. Deliberate; can add an inline
  per-segment readout to the wide view if wanted.
- **Dashboard cells need adequate width** — a cell narrower than a kind's ~54-col
  threshold falls back to that kind's stacked/block form (no panel title). Use a
  wide `--width` (the showcase uses 118).
- README still has a pre-existing `[ANDREW Q]` (GitHub org) and "not published to
  npm yet" status — left as-is for Andrew. Final hook/marketing copy left minimal
  per direction.
- Package intentionally **not renamed** (name still TBD).
