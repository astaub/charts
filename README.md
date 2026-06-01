# agentviz

Terminal charts agents can show humans.

`agentviz` renders compact terminal reports from structured data. It is for
agents that need to explain evidence in a CLI, pull request comment, transcript,
or generated report without dumping raw CSV or hiding denominators.

## Status

`agentviz` is staged for extraction as a private GitHub repository in Phase 1 of
the OSS release plan. It is not published to npm yet.

Planned package name:

```sh
npm install @staub/agentviz
```

[ANDREW Q] Confirm the GitHub organization before creating the private repo.

## Why

- Show the evidence, not just the conclusion.
- Preserve exact counts, denominators, and caveats.
- Keep output readable inside narrow terminals and chat transcripts.
- Avoid browser screenshots when a text report is enough.

## CLI

Pass a chart type and a JSON file, or pipe JSON through stdin.

```sh
agentviz line report.json --width 96
cat report.json | agentviz funnel
cat filters.json | agentviz filters
```

Minimal line chart input:

```json
{
  "title": "Activation",
  "series": [
    {
      "label": "Page views",
      "points": [
        { "label": "Mon", "value": 120 },
        { "label": "Tue", "value": 180 }
      ]
    }
  ],
  "filters": [
    { "scope": "property", "field": "$current_url", "operator": "contains", "value": "/setup" }
  ]
}
```

```sh
agentviz line activation.json
```

Supported charts:

- `bar`
- `bignumber`
- `filters`
- `funnel`
- `line`
- `retention`
- `scatter`
- `sparkline`
- `stacked`
- `table`
- `waterfall`

## API

```ts
import { renderFunnelBars } from "@staub/agentviz";

console.log(renderFunnelBars([
  { label: "Visited pricing", count: 1200 },
  { label: "Started checkout", count: 420 },
  { label: "Paid", count: 180 },
], { width: 72 }));
```

### Line chart annotations

`renderLineChart` accepts four optional annotation fields for product-change
markers, not-comparable regions, footer provenance, and dense-axis label
strategies. All fields are optional and backwards compatible.

```ts
import { renderLineChart } from "@staub/agentviz";

console.log(renderLineChart(series, {
  width: 96,
  height: 8,
  vlines: [
    { at: "2025-09", label: "launch", position: "above" },
  ],
  shades: [
    { from: "2025-08", to: "2025-09", label: "pre-launch", pattern: "gray" },
  ],
  footer: "queried 2026-05-18 from prod readonly | n=28,661",
  xAxisLabels: "auto", // or "stagger" or { skipEvery: 3 }
}));
```

CLI equivalents (repeatable where noted):

```sh
agentviz line trend.json \
  --vline at=2025-09,label=launch \
  --shade from=2025-08,to=2025-09,label=pre-launch,pattern=gray \
  --footer "queried 2026-05-18" \
  --xaxis-labels stagger
```

- `vlines` — vertical marker drawn at the bucket whose label matches `at`. Unmatched `at` values are silently skipped. `position` is `above` (default) or `below`.
- `shades` — background fill across the inclusive `from`-to-`to` bucket range. `pattern` is `gray` (default, `░`), `hatch` (`▒`), or `dotted` (`·`). Series markers and lines paint over shade chars.
- `footer` — free-text line printed below the legend, wrapped at `width`. Caller is responsible for embedding timestamps, source paths, or row counts.
- `xAxisLabels` — `auto` (default; falls back to `skipEvery` when labels collide), `stagger` (two alternating rows), or `{ skipEvery: N }` (every Nth label only).

Narrow-width behavior (`width < 54`): the chart falls back to per-series sparklines because the full grid does not fit. The annotation fields still surface as compact summary lines below the sparklines:

- `footer` is always printed, wrapped at the requested width.
- Labelled `vlines` collapse into a single `Marks: at=label  ...` line.
- Labelled `shades` collapse into a single `Shaded: ░ from-to=label  ...` line using the same pattern character as the full chart.

Unlabelled vlines and shades are dropped at narrow widths since their position cannot be drawn.

### Goal lines & y-axis units

`renderLineChart` can draw a horizontal target line and format the y-axis with
units. All optional and backwards compatible.

```ts
renderLineChart(series, {
  goal: 180,
  goalLabel: "Q2 target",     // legend reads: Q2 target ╌ $180
  unit: { prefix: "$" },      // axis labels: $0, $90, $180 …
  // or: valueFormat: "percent" for 0–1 ratios → 0%, 50%, 100%
});
```

The goal line is drawn dashed (`╌`) only on empty cells, so series always win on
a collision. At narrow widths it collapses to a `Goal: <value>` annotation.

### High-resolution braille lines

`lineStyle: "braille"` plots the line body at 2×4 sub-cell resolution (Unicode
braille), giving ~8× the density of block characters at the same width — smooth
curves without leaving the terminal. Axis, x-labels, legend, goal, and footer
render the same; `vlines`/`shades` collapse to compact `Marks:`/`Shaded:` lines.
Below 54 columns it falls back to per-series sparklines.

```sh
agentviz line trend.json --linestyle braille --width 96
```

### Big numbers

`renderBigNumber` renders a single headline metric with an optional
period-over-period delta and sparkline — the most common dashboard tile.

```ts
import { renderBigNumber } from "@staub/agentviz";

renderBigNumber(1234, {
  label: "Weekly signups",
  previous: 1102,                 // ▲ 12% vs previous (1,102)
  sparkline: [900, 1102, 1050, 1234],
  unit: { prefix: "$" },          // or format: "percent" | "compact"
  goodDirection: "up",            // color (when enabled): up = green
});
```

```sh
echo '{"value":1234,"options":{"label":"Weekly signups","previous":1102}}' | agentviz bignumber
```

Like every chart, output is plain text with no color unless `color` is set, so it
survives transcripts and copy/paste.

Run the bundled synthetic render:

```sh
bun run example
```

## Integrity (`--integrity` + `agentviz verify`)

Opt-in tamper-evident output. When an agent shows a chart in a transcript, the
operator can verify the chart was actually produced by agentviz instead of
hand-edited prose.

```sh
agentviz line report.json --integrity > chart.txt
agentviz verify chart.txt
# OK (chart=line agentviz=0.1.3 sha256=…)

# Operator suspects fabrication or edit:
agentviz verify suspicious-chart.txt
# TAMPERED (…)
#   reason: re-rendered body from embedded spec does not match block body —
#           chart was hand-edited
```

With `--integrity`, rendered output is wrapped in a marker block:

```
‹‹‹agentviz/0.1.3 chart:line sha256:<64-hex> spec:<base64-json>›››
[chart content]
‹‹‹/agentviz›››
```

The block carries the full canonical spec (chart kind, title, width, series,
options, line annotations — everything needed to reproduce the body) as
base64-encoded JSON, plus a sha256 hash binding the version, chart, spec,
and body together.

`agentviz verify` runs two checks:

1. **Hash check.** Recomputes sha256(version, chart, spec, body) from the
   embedded spec and the current body. Catches any edit to the body, spec,
   version, chart, or the hash itself.
2. **Re-render check.** Re-renders the embedded spec via `renderAgentVizSpec`
   and compares byte-exactly to the block body. This is the stronger guarantee:
   without it, anyone with `sha256sum` could fabricate a block by editing the
   body and recomputing the hash. With it, a passing block means the body is
   what agentviz would produce for the embedded spec, on this version of
   agentviz, running locally — which is the strongest claim possible without
   a server-side signing key.

Caveats:

- Content outside the marker block is not covered by the hash. `agentviz
  verify` surfaces a byte-count note when leading or trailing text is present
  so operators do not treat the whole file as verified.
- Re-render comparison uses the running agentviz version's renderer. If you
  verify a block produced by an older agentviz version whose renderer has
  since changed, the re-render check will report TAMPERED even though the
  block itself is genuine. Re-render with the matching version when this
  matters.
- This is layer 2 of chart-fabrication resistance. Layer 1 is making the
  renderer good enough that an agent does not want to hand-edit in the first
  place. Use `--integrity` for charts that will inform real decisions.

Default behavior is unchanged: without `--integrity`, output is byte-identical
to prior releases.

## What It Draws

- tables
- bars and sparklines
- big numbers with period-over-period delta
- funnels with previous-step and total retention
- line charts (block or high-resolution braille), with goal lines and y-axis units
- filter summaries and suggested filters
- retention heatmaps
- stacked bars
- waterfall charts
- scatter plots

## Boundaries

`agentviz` is source-agnostic. It does not know about analytics tools,
warehouses, saved insights, credentials, or freshness. Source-specific packages
should normalize their data first, then call `agentviz`.

Filter summaries are display-only. `agentviz` can show which filters shaped a
chart, and which filters an adapter recommends, but it does not query,
translate, or validate source-specific filter semantics.

## Safety

- Local reads: none beyond files imported by the caller.
- Local writes: none.
- Network: none.
- Credentials: none.
- Private data: callers must pass already-redacted data.

## Extraction

See `EXTRACTION.md` for the private-repo split path from this monorepo staging
folder. Roadmap reference: `plans/2026-05-14-oss-extraction-roadmap.md`.

## License

MIT

## Public Launch Gate

- package name confirmed;
- private GitHub repo created in the confirmed organization;
- tests pass inside the extracted package;
- README examples match actual output;
- no customer names, local paths, or private fixtures remain.
