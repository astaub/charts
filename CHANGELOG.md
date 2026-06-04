# @staub/agentviz CHANGELOG

## Unreleased

- fix(line): keep the panel right border a single clean column on braille/area
  charts. Empty braille plot cells are now filled with blank braille (U+2800,
  same cell advance) and the trailing run is never trimmed, so every plot row is
  exactly the panel width instead of ending at its last dot. Added a regression
  test asserting every content row of a paneled chart (bar/funnel/line-linear/
  line-braille/line-area/retention) has equal ANSI-stripped visible width.
  (Note: the `freeze` screenshot tool renders braille glyphs wider than ASCII
  spaces in the bundled macOS mono fonts, so braille/area *screenshots* can still
  show the plot past the ASCII frame — a freeze font artifact; real terminals
  render braille at width 1, so the border is clean, as the new test enforces.)

- feat(retention): rebuilt the cohort retention heatmap on the component system.
  The wide layout is now a titled `panel` of **truecolor heat cells** — each
  period cell is a solid background block keyed to its retention rate via a new
  sequential `heat()` ramp (cold/dark → hot/bright blue), with the percentage in
  light ink. Jagged cohorts (missing later periods) render as a centered dim dot
  instead of a gap. Mono degrades to a shade glyph (`░▒▓█`) + percentage per
  cell. Below 54 columns (or when the grid won't fit) it keeps the existing
  per-cohort stacked list. New `retention-weekly` fixture; before/after freeze
  shots in `docs/screenshots/`. `heat(t)` is exported from the package root.

- feat(line, sparkline): rebuilt on the shared component system. The wide line
  chart now renders inside a titled `panel` with **per-series truecolor** (each
  series + its legend entry keyed to the categorical palette), a dim axis frame,
  and a goal line tinted to the warn accent. `lineStyle: 'braille'` draws smooth
  2×4 sub-cell curves, and a new **`area: true`** option fills the region under
  the line (implies braille). Sparkline gains a ramp-tinted color mode. Mono
  output is byte-stable where pinned (sparkline) and degrades cleanly; the
  default `lineStyle` stays `linear` so vlines/shades/goal still draw inline
  (braille degrades those to compact labelled marks, as before). New line
  fixtures (`line-weekly-active`, `line-latency` area). Before/after freeze
  shots in `docs/screenshots/`.

- feat(design-system): **beautiful charts by default.** New shared component
  layer — one set of border/title/subtitle/legend/color-coded-label primitives
  plus a sub-cell-precise meter — so every chart kind reads as one product
  instead of an independently-styled plotter. Two new modules:
  - `cli-viz/theme.ts` — the color/degrade layer (truecolor 24-bit on a TTY or
    under `FORCE_COLOR`, clean monochrome Unicode when piped, off entirely under
    `NO_COLOR`), one canonical blue ramp (`#1d4aff` → light), a coherent
    categorical palette, and the glyph sets (eighth blocks `▏▎▍▌▋▊▉█`, box
    drawing, shades). Exported: `ramp`, `rampShade`, `categorical`, `barGlyphs`,
    `resolveColor`, `resolveCliColorMode`, `fg`/`bg`/`dim`/`bold`, `THEME`.
  - `cli-viz/components.ts` — composable chrome: `panel` (rounded border with
    the title in the top edge), `legend`, `swatch`, `colorLabel`, `meter`, and
    `meterTable` (the shared body for any horizontal-bar chart). Assembled with
    sensible defaults so the common case is one call and comes out beautiful
    with zero tuning.
- feat(bar, funnel): rebuilt on the component system — color-coded labels that
  match a deep→light gradient, a capped block meter with a faint track channel,
  right-aligned numeric columns under a dim header, all inside a titled panel.
  Below 54 columns (or when a legible meter won't fit) they fall back to the
  existing stacked list. Color is resolved at the CLI boundary and folds into
  the integrity block, so `--integrity` output still round-trips through
  `agentviz verify` in both mono and color.
- feat(fixtures): realistic, production-shaped sample data under `fixtures/`
  (activation/checkout funnels, browser-share/traffic/MRR bars) plus a test that
  every fixture parses and renders within width in both modes.
- fix(grouped): the `cleanDisplayText` control-character strip used raw control
  bytes inside a regex character class, which some engines (Bun) reject as an
  out-of-order range; replaced with explicit `\xNN` escapes (behavior identical).
- The public input schemas are unchanged. The library default stays color-off;
  the redesign only changes the wide (paneled) rendering of `bar`/`funnel`.

## 0.3.0 (2026-06-02)

- feat(grouped): new `renderGroupedBarChart` API and `grouped` CLI chart — the
  non-stacked complement to `renderStackedBarChart`, drawing multiple series
  side-by-side per bucket for trends with more than one metric per period
  (e.g. followed-vs-signed-up per week). Each series gets a distinct fill
  symbol keyed to the legend; supports `seriesOrder`, `valueFormat`/`unit`,
  `height`, and `footer`. Below 54 columns (or when groups can't fit) it falls
  back to a per-bucket block listing. New `@staub/agentviz/grouped` subpath
  export.
- feat(grouped): `markers: [{ at, label }]` (`--marker at=<bucket>[,label=...]`)
  draws a vertical annotation rule at a bucket — the bar-chart analogue of
  `vlines` on line charts, for "shipped on <date>" before/after-release lines.
  Bars paint over the rule on a collision; the label prints above the plot;
  unmatched buckets are skipped; at narrow widths labelled markers collapse to
  a `Marks:` line. Folds into the integrity block so it round-trips through
  `agentviz verify`.
- All additions are optional and backwards compatible; default output is
  unchanged.

## 0.2.0 (2026-05-28)

- feat(bignumber): new `renderBigNumber` API and `bignumber` CLI chart — a
  single headline metric with an optional period-over-period delta
  (▲/▼ + % change vs `previous`), unit `prefix`/`suffix`, `number`/`percent`/
  `compact` formatting, an optional `sparkline`, and opt-in color keyed to
  `goodDirection` (up vs down is good). Text-first: no color unless `color` is
  set, so output survives transcripts and copy/paste. New
  `@staub/agentviz/bignumber` subpath export.
- feat(line): `lineStyle: "braille"` renders the line body at 2×4 sub-cell
  resolution (~8× the density of block characters at the same width) via a new
  `BrailleCanvas` primitive (exported from the package root). Axis, x-labels,
  legend, goal, and footer render the same; `vlines`/`shades` collapse to
  compact `Marks:`/`Shaded:` lines; below 54 columns it falls back to
  per-series sparklines.
- feat(funnel): `FunnelStepDatum.previousRate` — when provided, the "Prev"
  column uses the source's authoritative step-over-step conversion verbatim
  instead of recomputing `count/previous`, preserving funnel semantics
  (conversion windows, unique-user math). Optional; falls back to the count
  ratio when absent.
- feat(line): `goal` + `goalLabel` draw a dashed horizontal target line
  (painted only on empty cells, so series always win), with a goal legend and a
  narrow-width annotation fallback. `valueFormat: "percent"` (for 0–1 ratios)
  and `unit: { prefix, suffix }` format the y-axis labels and goal label.
- All additions are optional and backwards compatible; default output is
  unchanged.

## 0.1.3 (2026-05-19)

- feat(integrity): opt-in `--integrity` CLI flag (and `integrity: true` API
  option) wraps rendered output in a tamper-evident marker block. The block
  carries the full canonical spec (chart kind, title, width, series, options,
  line annotations) as base64-encoded JSON plus a sha256 hash binding
  version + chart + spec + body together. Marker format:
  `‹‹‹agentviz/<version> chart:<kind> sha256:<hex> spec:<b64>›››` open,
  chart body, `‹‹‹/agentviz›››` close. Default behavior is unchanged:
  without `--integrity` the output is byte-identical to 0.1.2 (back-compat).
- feat(cli): new `agentviz verify [file]` subcommand reads a marker block
  from a file or stdin and runs two checks:
  1. Hash check — recompute sha256(version, chart, spec, body) from the
     embedded spec and current body; reject any mismatch.
  2. Re-render check — re-render the embedded spec via
     `renderAgentVizSpec` and compare byte-exactly to the block body;
     reject any difference.
  Without re-render, anyone with `sha256sum` could fabricate a block by
  editing the body and recomputing the hash. With re-render, a passing
  block means the body is what agentviz would produce for the embedded
  spec on the running agentviz version — the strongest claim possible
  without a server-side signing key. Reports `OK` (exit 0), `TAMPERED`
  (exit 2), `no-marker` / `malformed` (exit 2) for non-block inputs.
- feat(verify): surfaces leading/trailing byte counts when content exists
  outside the verified block, so operators do not assume the whole file is
  covered by the hash.
- fix(verify): tightened newline handling — adding or removing blank lines
  before the close marker is now detected (hash mismatch) instead of being
  silently normalized away.
- Closes #1644. Motivated by the 2026-05-18 honesty incident where an agent
  hand-edited a generated chart to add `← FEED-AS-HOME` and reformat axis
  labels in a prep transcript.

## 0.1.2 (2026-05-19)

- fix(line): narrow-width sparkline fallback now preserves `footer`, labelled
  `vlines`, and labelled `shades` instead of silently dropping them. Footer
  always prints below the sparkline body. Labelled vlines collapse into a
  single `Marks: at=label  ...` line; labelled shades collapse into a single
  `Shaded: <pattern> from-to=label  ...` line using the same pattern char as
  the full chart. Unlabelled annotations stay dropped at narrow widths since
  their position cannot be drawn. README documents the narrow-mode behavior.
  Closes #1622.

## 0.1.1 (2026-05-18)

- feat(line): add `lineStyle` option with `linear` (default, existing diagonal
  interpolation), `step` (horizontal `─` runs with `│` transitions, no
  diagonals), and `markers-only` (data dots only, no connecting line). Use
  `step` for monthly time-series where the underlying data is discrete and the
  diagonal scribble misleads the eye. Closes #1639.
- feat(cli): expose the new option via `--linestyle linear|step|markers-only`
  (and `--linestyle=...` equals form). CLI flag wins over JSON spec field.

## 0.1.0 (2026-05-18)

- feat(line): add `vlines` option for vertical annotation markers with optional
  above/below labels.
- feat(line): add `shades` option for shaded background regions with
  `gray`/`hatch`/`dotted` patterns and an optional shade legend.
- feat(line): add `footer` option for free-text provenance lines below the
  legend, wrapped at the requested width.
- feat(line): add `xAxisLabels` option with `auto` (collision detection),
  `stagger` (two-row), and `{ skipEvery: N }` strategies for dense axes.
- feat(cli): expose the new options via `--vline`, `--shade`, `--footer`, and
  `--xaxis-labels` flags (repeatable for vline and shade). CLI flags win over
  JSON spec fields.
- fix(line): line segments and series markers now paint cleanly over shade
  and vline characters; no more `*` collisions in annotated charts.
- fix(line): vlines remain visible inside shaded regions instead of being
  silently swallowed by the shade fill.
- fix(line): `auto` x-axis label strategy now keeps increasing `skipEvery`
  until labels stop colliding, and refuses to overpaint a neighbor when the
  axis is still too dense to render every selected label cleanly.
- chore(build): commit `dist/` so the published `bin: ./dist/cli.js` works
  without a separate build step in monorepo consumer paths.

Refs #1606 (line-chart annotations subset). Hard-unblocks #1614. Deferred from
the feedback to follow-up issues: `staub-chart` CLI wrapper, line style modes
(`steps`, `markers-only`), `--panels` subplot mode, partial-window marker,
y-axis tick rounding, `--from-funnel <slug>` integration, npm publish-name
cleanup.
