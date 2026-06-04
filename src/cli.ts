#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  renderBarChart,
  renderBigNumber,
  renderFilterSummary,
  renderFunnelBars,
  renderGroupedBarChart,
  renderLineChart,
  renderRetentionHeatmap,
  renderScatterPlot,
  renderSparkline,
  renderStackedBarChart,
  renderTable,
  renderWaterfallChart,
  type BarChartDatum,
  type BigNumberOptions,
  type FilterDatum,
  type FilterSummaryOptions,
  type FunnelStepDatum,
  type GroupedBarBucketDatum,
  type GroupedBarChartOptions,
  type GroupedBarMarker,
  type LineChartLineStyle,
  type LineChartSeries,
  type LineChartShade,
  type LineChartShadePattern,
  type LineChartVline,
  type LineChartXAxisLabels,
  type RetentionCohortDatum,
  type ScatterPlotOptions,
  type ScatterPlotPoint,
  type SparklineOptions,
  type StackedBarBucketDatum,
  type StackedBarChartOptions,
  type SuggestedFilterDatum,
  type TableColumn,
  type TableRow,
  type WaterfallChartOptions,
  type WaterfallStep,
} from './cli-viz/index.js';
import { verifyIntegrity, wrapWithIntegrity, type RendererCallback } from './integrity.js';
import { resolveCliColorMode } from './cli-viz/theme.js';

// Package version is read at build time and inlined by tsc. The version is
// embedded into integrity markers so verify can tell which renderer produced
// the block, even if the consumer is on a different agentviz release.
import { readFileSync as readPkgSync } from 'node:fs';
import { dirname as pathDirname, join as pathJoin } from 'node:path';

function readAgentVizVersion(): string {
  // Walks up from this file looking for the nearest package.json. Works in
  // both src/ (during tests) and dist/ (after build) without baking the
  // version into source.
  try {
    const here = fileURLToPath(import.meta.url);
    let dir = pathDirname(here);
    for (let i = 0; i < 6; i += 1) {
      try {
        const pkg = JSON.parse(readPkgSync(pathJoin(dir, 'package.json'), 'utf8')) as { version?: string };
        if (typeof pkg.version === 'string' && pkg.version.length > 0) return pkg.version;
      } catch {
        // keep walking
      }
      const parent = pathDirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // fall through
  }
  return '0.0.0';
}

type ChartKind =
  | 'bar'
  | 'bignumber'
  | 'filters'
  | 'funnel'
  | 'grouped'
  | 'line'
  | 'retention'
  | 'scatter'
  | 'sparkline'
  | 'stacked'
  | 'table'
  | 'waterfall';

interface ParsedArgs {
  chart?: ChartKind;
  file?: string;
  width?: number;
  help?: boolean;
  vlines?: LineChartVline[];
  markers?: GroupedBarMarker[];
  shades?: LineChartShade[];
  footer?: string;
  xAxisLabels?: LineChartXAxisLabels;
  lineStyle?: LineChartLineStyle;
  integrity?: boolean;
  verify?: boolean;
}

interface AgentVizSpec {
  chart?: ChartKind;
  title?: string;
  options?: Record<string, unknown>;
  width?: number;
  value?: number;
  values?: number[];
  rows?: TableRow[] | BarChartDatum[];
  data?: unknown;
  columns?: TableColumn[];
  series?: LineChartSeries[];
  steps?: FunnelStepDatum[] | WaterfallStep[];
  cohorts?: RetentionCohortDatum[];
  buckets?: StackedBarBucketDatum[];
  points?: ScatterPlotPoint[];
  filters?: FilterDatum[];
  suggestions?: SuggestedFilterDatum[];
  suggested_filters?: SuggestedFilterDatum[];
  vlines?: LineChartVline[];
  shades?: LineChartShade[];
  footer?: string;
  xAxisLabels?: LineChartXAxisLabels;
  lineStyle?: LineChartLineStyle;
}

interface LineChartOverrides {
  vlines?: LineChartVline[];
  shades?: LineChartShade[];
  footer?: string;
  xAxisLabels?: LineChartXAxisLabels;
  lineStyle?: LineChartLineStyle;
}

const CHARTS = new Set<ChartKind>([
  'bar',
  'bignumber',
  'filters',
  'funnel',
  'grouped',
  'line',
  'retention',
  'scatter',
  'sparkline',
  'stacked',
  'table',
  'waterfall',
]);

// Charts rebuilt on the shared design-system panel (border/title live inside
// the renderer). Grows as more kinds adopt the component set.
const PANELED = new Set<ChartKind>(['bar', 'funnel', 'line', 'retention', 'stacked', 'grouped', 'waterfall', 'bignumber', 'scatter']);

export interface RenderAgentVizSpecOptions {
  integrity?: boolean;
  version?: string;
}

export function renderAgentVizSpec(
  spec: unknown,
  chartHint?: string,
  cliWidth?: number,
  lineOverrides: LineChartOverrides = {},
  extra: RenderAgentVizSpecOptions = {},
): string {
  const objectSpec = normalizeSpec(spec);
  const chart = normalizeChart(chartHint ?? objectSpec.chart);
  const width = cliWidth ?? numberOption(objectSpec.width) ?? numberOption(objectSpec.options?.width);
  const options: Record<string, unknown> = { ...(objectSpec.options ?? {}), ...(width === undefined ? {} : { width }) };
  if (chart === 'line') {
    const merged = mergeLineOptions(objectSpec, lineOverrides);
    Object.assign(options, merged);
  }
  // Paneled charts draw the title (and subtitle) inside their own border, so
  // fold them into the renderer options and suppress the external title line.
  if (PANELED.has(chart) && typeof objectSpec.title === 'string' && objectSpec.title.trim().length > 0) {
    options.title = objectSpec.title;
  }
  const output = renderChart(objectSpec, chart, options);
  const filterOutput = renderAttachedFilters(objectSpec, chart, width);

  const externalTitle = PANELED.has(chart) ? undefined : titleLine(objectSpec.title, width);
  const rendered = [externalTitle, output, filterOutput].filter(Boolean).join('\n\n');
  if (!extra.integrity) return rendered;

  // Build the canonical embedded spec — the complete set of inputs needed
  // to reproduce this exact body via `renderAgentVizSpec(spec)`. Verify
  // re-renders from this spec and compares byte-exactly to the body inside
  // the marker block, so a forger has to actually run agentviz with these
  // inputs to produce a passing block (which means there is no forgery —
  // the chart is what agentviz would produce for the embedded spec).
  const canonicalSpec = buildCanonicalSpec(objectSpec, chart, width, lineOverrides);
  return wrapWithIntegrity(rendered, {
    chart,
    version: extra.version ?? readAgentVizVersion(),
    spec: canonicalSpec,
  });
}

// Builds a self-contained spec that, when passed back through
// `renderAgentVizSpec(spec)` (no chartHint, no cliWidth, no lineOverrides),
// reproduces the exact body that was hashed. `chart` is set explicitly so
// the embedded spec carries its own chart kind. All width / line-style
// overrides are folded into the spec so re-render does not depend on
// CLI flags. Title is included so the body's title line is reproducible.
export function buildCanonicalSpec(
  spec: AgentVizSpec,
  chart: ChartKind,
  width: number | undefined,
  lineOverrides: LineChartOverrides,
): Record<string, unknown> {
  const out: Record<string, unknown> = { chart };
  if (spec.title !== undefined) out.title = spec.title;
  if (width !== undefined) out.width = width;
  if (spec.options !== undefined) out.options = spec.options;
  if (spec.series !== undefined) out.series = spec.series;
  if (spec.rows !== undefined) out.rows = spec.rows;
  if (spec.columns !== undefined) out.columns = spec.columns;
  if (spec.data !== undefined) out.data = spec.data;
  if (spec.steps !== undefined) out.steps = spec.steps;
  if (spec.cohorts !== undefined) out.cohorts = spec.cohorts;
  if (spec.buckets !== undefined) out.buckets = spec.buckets;
  if (spec.points !== undefined) out.points = spec.points;
  if (spec.value !== undefined) out.value = spec.value;
  if (spec.values !== undefined) out.values = spec.values;
  if (spec.filters !== undefined) out.filters = spec.filters;
  if (spec.suggestions !== undefined) out.suggestions = spec.suggestions;
  if (spec.suggested_filters !== undefined) out.suggested_filters = spec.suggested_filters;
  if (chart === 'line') {
    // Fold CLI overrides into the spec so re-render does not depend on
    // having the same `--vline` / `--shade` / `--footer` / `--xaxis-labels`
    // / `--linestyle` flags on the verify call.
    const vlines = lineOverrides.vlines ?? spec.vlines;
    if (vlines !== undefined) out.vlines = vlines;
    const shades = lineOverrides.shades ?? spec.shades;
    if (shades !== undefined) out.shades = shades;
    const footer = lineOverrides.footer ?? spec.footer;
    if (footer !== undefined) out.footer = footer;
    const xAxisLabels = lineOverrides.xAxisLabels ?? spec.xAxisLabels;
    if (xAxisLabels !== undefined) out.xAxisLabels = xAxisLabels;
    const lineStyle = lineOverrides.lineStyle ?? spec.lineStyle;
    if (lineStyle !== undefined) out.lineStyle = lineStyle;
  }
  return out;
}

// Re-renders a previously-canonicalized spec. Used by `agentviz verify` to
// recompute the body for comparison. The spec already encodes its own
// chart kind and width, so no overrides are passed.
const integrityRerender: RendererCallback = (spec: unknown) => renderAgentVizSpec(spec);

function mergeLineOptions(spec: AgentVizSpec, overrides: LineChartOverrides): LineChartOverrides {
  const merged: LineChartOverrides = {};
  if (spec.vlines !== undefined) merged.vlines = spec.vlines;
  if (overrides.vlines !== undefined) merged.vlines = overrides.vlines;
  if (spec.shades !== undefined) merged.shades = spec.shades;
  if (overrides.shades !== undefined) merged.shades = overrides.shades;
  if (typeof spec.footer === 'string') merged.footer = spec.footer;
  if (typeof overrides.footer === 'string') merged.footer = overrides.footer;
  if (spec.xAxisLabels !== undefined) merged.xAxisLabels = spec.xAxisLabels;
  if (overrides.xAxisLabels !== undefined) merged.xAxisLabels = overrides.xAxisLabels;
  if (spec.lineStyle !== undefined) merged.lineStyle = spec.lineStyle;
  if (overrides.lineStyle !== undefined) merged.lineStyle = overrides.lineStyle;
  return merged;
}

export function parseAgentVizArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};

  // `verify` is a subcommand that takes only an optional file path; it does
  // not accept chart kinds or render flags.
  if (argv[0] === 'verify') {
    args.verify = true;
    for (let i = 1; i < argv.length; i += 1) {
      const arg = argv[i];
      if (!arg) continue;
      if (arg === '--help' || arg === '-h') {
        args.help = true;
        continue;
      }
      if (!args.file) {
        args.file = arg;
        continue;
      }
      throw new Error(`unexpected argument: ${arg}`);
    }
    return args;
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === '--help' || arg === '-h' || arg === 'help') {
      args.help = true;
      continue;
    }

    if (arg === '--integrity') {
      args.integrity = true;
      continue;
    }

    if (arg === '--width' || arg === '-w') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a number`);
      args.width = parseWidth(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--width=')) {
      args.width = parseWidth(arg.slice('--width='.length));
      continue;
    }

    if (arg === '--vline') {
      const value = argv[index + 1];
      if (!value) throw new Error('--vline requires a key=value spec');
      (args.vlines ??= []).push(parseVlineSpec(value));
      index += 1;
      continue;
    }

    if (arg.startsWith('--vline=')) {
      (args.vlines ??= []).push(parseVlineSpec(arg.slice('--vline='.length)));
      continue;
    }

    if (arg === '--marker') {
      const value = argv[index + 1];
      if (!value) throw new Error('--marker requires a key=value spec');
      (args.markers ??= []).push(parseMarkerSpec(value));
      index += 1;
      continue;
    }

    if (arg.startsWith('--marker=')) {
      (args.markers ??= []).push(parseMarkerSpec(arg.slice('--marker='.length)));
      continue;
    }

    if (arg === '--shade') {
      const value = argv[index + 1];
      if (!value) throw new Error('--shade requires a key=value spec');
      (args.shades ??= []).push(parseShadeSpec(value));
      index += 1;
      continue;
    }

    if (arg.startsWith('--shade=')) {
      (args.shades ??= []).push(parseShadeSpec(arg.slice('--shade='.length)));
      continue;
    }

    if (arg === '--footer') {
      const value = argv[index + 1];
      if (value === undefined) throw new Error('--footer requires a value');
      args.footer = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--footer=')) {
      args.footer = arg.slice('--footer='.length);
      continue;
    }

    if (arg === '--xaxis-labels') {
      const value = argv[index + 1];
      if (!value) throw new Error('--xaxis-labels requires a value (auto|stagger|skip:N)');
      args.xAxisLabels = parseXAxisLabels(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--xaxis-labels=')) {
      args.xAxisLabels = parseXAxisLabels(arg.slice('--xaxis-labels='.length));
      continue;
    }

    if (arg === '--linestyle') {
      const value = argv[index + 1];
      if (!value) throw new Error('--linestyle requires a value (linear|step|markers-only)');
      args.lineStyle = parseLineStyle(value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--linestyle=')) {
      args.lineStyle = parseLineStyle(arg.slice('--linestyle='.length));
      continue;
    }

    if (!args.chart && CHARTS.has(arg as ChartKind)) {
      args.chart = arg as ChartKind;
      continue;
    }

    if (!args.file) {
      args.file = arg;
      continue;
    }

    throw new Error(`unexpected argument: ${arg}`);
  }

  return args;
}

function parseKeyValueSpec(spec: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of spec.split(',')) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) throw new Error(`expected key=value, got: ${trimmed}`);
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key.length === 0) throw new Error(`empty key in: ${trimmed}`);
    out[key] = value;
  }
  return out;
}

function parseVlineSpec(spec: string): LineChartVline {
  const parts = parseKeyValueSpec(spec);
  if (!parts.at) throw new Error('--vline requires at=<bucket>');
  const vline: LineChartVline = { at: parts.at };
  if (parts.label !== undefined) vline.label = parts.label;
  if (parts.position !== undefined) {
    if (parts.position !== 'above' && parts.position !== 'below') {
      throw new Error(`--vline position must be above|below, got: ${parts.position}`);
    }
    vline.position = parts.position;
  }
  return vline;
}

function parseMarkerSpec(spec: string): GroupedBarMarker {
  const parts = parseKeyValueSpec(spec);
  if (!parts.at) throw new Error('--marker requires at=<bucket>');
  const marker: GroupedBarMarker = { at: parts.at };
  if (parts.label !== undefined) marker.label = parts.label;
  return marker;
}

function parseShadeSpec(spec: string): LineChartShade {
  const parts = parseKeyValueSpec(spec);
  if (!parts.from || !parts.to) throw new Error('--shade requires from=<bucket>,to=<bucket>');
  const shade: LineChartShade = { from: parts.from, to: parts.to };
  if (parts.label !== undefined) shade.label = parts.label;
  if (parts.pattern !== undefined) {
    if (parts.pattern !== 'hatch' && parts.pattern !== 'gray' && parts.pattern !== 'dotted') {
      throw new Error(`--shade pattern must be hatch|gray|dotted, got: ${parts.pattern}`);
    }
    shade.pattern = parts.pattern as LineChartShadePattern;
  }
  return shade;
}

function parseXAxisLabels(value: string): LineChartXAxisLabels {
  if (value === 'auto' || value === 'stagger') return value;
  if (value.startsWith('skip:')) {
    const n = Number(value.slice('skip:'.length));
    if (!Number.isFinite(n) || n <= 0) throw new Error(`--xaxis-labels skip:N requires a positive integer, got: ${value}`);
    return { skipEvery: Math.floor(n) };
  }
  throw new Error(`--xaxis-labels must be auto|stagger|skip:N, got: ${value}`);
}

function parseLineStyle(value: string): LineChartLineStyle {
  if (value === 'linear' || value === 'step' || value === 'markers-only' || value === 'braille') return value;
  throw new Error(`--linestyle must be linear|step|markers-only|braille, got: ${value}`);
}

async function main(): Promise<void> {
  try {
    const args = parseAgentVizArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(helpText());
      return;
    }

    if (args.verify) {
      const text = args.file ? readFileSync(args.file, 'utf8') : await readStdin();
      const result = verifyIntegrity(text, integrityRerender);
      const summaryParts: string[] = [];
      if (result.chart) summaryParts.push(`chart=${result.chart}`);
      if (result.version) summaryParts.push(`agentviz=${result.version}`);
      if (result.actualHash) summaryParts.push(`sha256=${result.actualHash.slice(0, 12)}…`);
      const summary = summaryParts.length > 0 ? ` (${summaryParts.join(' ')})` : '';
      if (result.status === 'ok') {
        process.stdout.write(`OK${summary}\n`);
        const lead = result.leadingContentLength ?? 0;
        const trail = result.trailingContentLength ?? 0;
        if (lead > 0 || trail > 0) {
          process.stdout.write(
            `  note: ${lead} byte(s) before and ${trail} byte(s) after the verified block are NOT covered by the hash\n`,
          );
        }
        return;
      }
      if (result.status === 'tampered') {
        process.stdout.write(`TAMPERED${summary}\n`);
        if (result.reason) process.stdout.write(`  reason: ${result.reason}\n`);
        if (result.expectedHash && result.actualHash) {
          process.stdout.write(`  expected sha256: ${result.expectedHash}\n`);
          process.stdout.write(`  declared sha256: ${result.actualHash}\n`);
        }
        process.exitCode = 2;
        return;
      }
      process.stdout.write(`${result.status.toUpperCase()}${summary}\n`);
      if (result.reason) process.stdout.write(`  reason: ${result.reason}\n`);
      process.exitCode = 2;
      return;
    }

    const input = args.file ? readFileSync(args.file, 'utf8') : await readStdin();
    const spec = JSON.parse(input);
    // `--marker` is folded into the spec's options so it both renders and
    // round-trips through the integrity block (which canonicalizes options).
    // Markers only apply to the grouped chart; on any other chart they are
    // ignored rather than silently corrupting an unrelated options bag.
    if (args.markers !== undefined && (args.chart ?? (isRecord(spec) ? spec.chart : undefined)) === 'grouped') {
      const existing = isRecord(spec) && isRecord(spec.options) ? spec.options : {};
      spec.options = { ...existing, markers: args.markers };
    }
    const lineOverrides: LineChartOverrides = {};
    if (args.vlines !== undefined) lineOverrides.vlines = args.vlines;
    if (args.shades !== undefined) lineOverrides.shades = args.shades;
    if (args.footer !== undefined) lineOverrides.footer = args.footer;
    if (args.xAxisLabels !== undefined) lineOverrides.xAxisLabels = args.xAxisLabels;
    if (args.lineStyle !== undefined) lineOverrides.lineStyle = args.lineStyle;
    const extra: RenderAgentVizSpecOptions = {};
    if (args.integrity) extra.integrity = true;
    // Resolve color at the CLI boundary: truecolor on a TTY (or FORCE_COLOR),
    // clean monochrome when piped, off entirely under NO_COLOR. Folding it into
    // the spec options means the choice round-trips through the integrity block.
    if (isRecord(spec)) {
      const existing = isRecord(spec.options) ? spec.options : {};
      if (existing.color === undefined) {
        spec.options = { ...existing, color: resolveCliColorMode() };
      }
    }
    process.stdout.write(`${renderAgentVizSpec(spec, args.chart, args.width, lineOverrides, extra)}\n`);
  } catch (error) {
    process.stderr.write(`agentviz: ${error instanceof Error ? error.message : String(error)}\n\n`);
    process.stderr.write(helpText());
    process.exitCode = 1;
  }
}

function renderChart(spec: AgentVizSpec, chart: ChartKind, options: Record<string, unknown>): string {
  switch (chart) {
    case 'bar':
      return renderBarChart(arrayFrom<BarChartDatum>(spec.rows ?? spec.data, 'rows'), options);
    case 'bignumber':
      return renderBigNumber(numberFrom(spec.value ?? spec.data, 'value'), options as BigNumberOptions);
    case 'filters':
      return renderFilterSummary(arrayFrom<FilterDatum>(spec.filters ?? spec.data, 'filters'), {
        ...options,
        suggestions: arrayFrom<SuggestedFilterDatum>(spec.suggestions ?? spec.suggested_filters ?? [], 'suggestions'),
      } as FilterSummaryOptions);
    case 'funnel':
      return renderFunnelBars(arrayFrom<FunnelStepDatum>(spec.steps ?? spec.data, 'steps'), options);
    case 'grouped':
      return renderGroupedBarChart(arrayFrom<GroupedBarBucketDatum>(spec.buckets ?? spec.data, 'buckets'), options as GroupedBarChartOptions);
    case 'line':
      return renderLineChart(arrayFrom<LineChartSeries>(spec.series ?? spec.data, 'series'), options);
    case 'retention':
      return renderRetentionHeatmap(arrayFrom<RetentionCohortDatum>(spec.cohorts ?? spec.data, 'cohorts'), options);
    case 'scatter':
      return renderScatterPlot(arrayFrom<ScatterPlotPoint>(spec.points ?? spec.data, 'points'), options as ScatterPlotOptions);
    case 'sparkline':
      return renderSparkline(numberArrayFrom(spec.values ?? spec.data, 'values'), options as SparklineOptions);
    case 'stacked':
      return renderStackedBarChart(arrayFrom<StackedBarBucketDatum>(spec.buckets ?? spec.data, 'buckets'), options as StackedBarChartOptions);
    case 'table':
      return renderTable(arrayFrom<TableRow>(spec.rows ?? spec.data, 'rows'), arrayFrom<TableColumn>(spec.columns, 'columns'), options);
    case 'waterfall':
      return renderWaterfallChart(arrayFrom<WaterfallStep>(spec.steps ?? spec.data, 'steps'), options as WaterfallChartOptions);
  }
}

function renderAttachedFilters(spec: AgentVizSpec, chart: ChartKind, width: number | undefined): string | undefined {
  if (chart === 'filters') return undefined;

  const filters = spec.filters ?? [];
  const suggestions = spec.suggestions ?? spec.suggested_filters ?? [];
  if (filters.length === 0 && suggestions.length === 0) return undefined;

  return renderFilterSummary(filters, { width, suggestions });
}

function normalizeSpec(spec: unknown): AgentVizSpec {
  if (!isRecord(spec)) throw new Error('input must be a JSON object');
  return spec as AgentVizSpec;
}

function normalizeChart(value: unknown): ChartKind {
  if (typeof value !== 'string' || !CHARTS.has(value as ChartKind)) {
    throw new Error(`chart must be one of: ${[...CHARTS].join(', ')}`);
  }
  return value as ChartKind;
}

function titleLine(value: unknown, width: number | undefined): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const title = value.trim();
  if (!width || title.length <= width) return title;
  if (width <= 1) return title.slice(0, Math.max(0, width));
  return `${title.slice(0, width - 1)}~`;
}

function arrayFrom<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value as T[];
}

function numberFrom(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function numberArrayFrom(value: unknown, label: string): number[] {
  const values = arrayFrom<unknown>(value, label);
  if (!values.every((item) => typeof item === 'number')) throw new Error(`${label} must be an array of numbers`);
  return values;
}

function numberOption(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseWidth(value: string): number {
  const width = Number(value);
  if (!Number.isFinite(width) || width <= 0) throw new Error(`invalid width: ${value}`);
  return width;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) throw new Error('pass a JSON file or pipe JSON to stdin');

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function helpText(): string {
  return `agentviz

Render terminal charts from JSON. Built for agents that need to show evidence
inside a CLI transcript.

Usage:
  agentviz <chart> [file.json] [--width 100] [--integrity]
  cat chart.json | agentviz <chart>
  agentviz verify [chart.txt]
  cat chart.txt | agentviz verify

Charts:
  bar, bignumber, filters, funnel, grouped, line, retention, scatter, sparkline, stacked, table, waterfall

Line chart flags (repeatable where noted):
  --vline at=<bucket>[,label=<text>][,position=above|below]
  --shade from=<bucket>,to=<bucket>[,label=<text>][,pattern=hatch|gray|dotted]
  --footer <text>
  --xaxis-labels auto|stagger|skip:<N>
  --linestyle linear|step|markers-only|braille

Grouped bar flags (repeatable):
  --marker at=<bucket>[,label=<text>]   vertical rule at a bucket (e.g. a ship date)

Integrity:
  --integrity   Wrap output in a tamper-evident marker block with sha256
                hash covering version, chart kind, inputs, and body.
  verify        Re-hash an existing marker block and report OK or
                TAMPERED. Exit 0 on OK, 2 on TAMPERED/malformed/missing.

Examples:
  agentviz line report.json --width 96
  agentviz line report.json --integrity > out.txt
  agentviz verify out.txt
  cat filters.json | agentviz filters
  agentviz line trend.json --vline at=2025-09,label=launch --shade from=2025-08,to=2025-09,label=pre-launch,pattern=gray --footer "queried 2026-05-18"

Line input:
  {"series":[{"label":"Page views","points":[{"label":"Mon","value":12}]}]}

Grouped input:
  {"buckets":[{"label":"W1","bars":[{"key":"followed","value":40},{"key":"signed_up","value":12}]}]}

Funnel input:
  {"steps":[{"label":"Visited","count":120},{"label":"Paid","count":18}]}

Big-number input:
  {"value":1234,"options":{"label":"Weekly signups","previous":1102,"sparkline":[900,1102,1050,1234]}}
`;
}

function isCliEntrypoint(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;

  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entrypoint);
  } catch {
    return import.meta.url === `file://${entrypoint}`;
  }
}

if (isCliEntrypoint()) {
  void main();
}
