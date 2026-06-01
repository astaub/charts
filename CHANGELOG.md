# @staub/agentviz CHANGELOG

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
