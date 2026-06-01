#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderBarChart, renderBigNumber, renderFilterSummary, renderFunnelBars, renderLineChart, renderRetentionHeatmap, renderScatterPlot, renderSparkline, renderStackedBarChart, renderTable, renderWaterfallChart, } from './cli-viz/index.js';
import { verifyIntegrity, wrapWithIntegrity } from './integrity.js';
// Package version is read at build time and inlined by tsc. The version is
// embedded into integrity markers so verify can tell which renderer produced
// the block, even if the consumer is on a different agentviz release.
import { readFileSync as readPkgSync } from 'node:fs';
import { dirname as pathDirname, join as pathJoin } from 'node:path';
function readAgentVizVersion() {
    // Walks up from this file looking for the nearest package.json. Works in
    // both src/ (during tests) and dist/ (after build) without baking the
    // version into source.
    try {
        const here = fileURLToPath(import.meta.url);
        let dir = pathDirname(here);
        for (let i = 0; i < 6; i += 1) {
            try {
                const pkg = JSON.parse(readPkgSync(pathJoin(dir, 'package.json'), 'utf8'));
                if (typeof pkg.version === 'string' && pkg.version.length > 0)
                    return pkg.version;
            }
            catch {
                // keep walking
            }
            const parent = pathDirname(dir);
            if (parent === dir)
                break;
            dir = parent;
        }
    }
    catch {
        // fall through
    }
    return '0.0.0';
}
const CHARTS = new Set([
    'bar',
    'bignumber',
    'filters',
    'funnel',
    'line',
    'retention',
    'scatter',
    'sparkline',
    'stacked',
    'table',
    'waterfall',
]);
export function renderAgentVizSpec(spec, chartHint, cliWidth, lineOverrides = {}, extra = {}) {
    const objectSpec = normalizeSpec(spec);
    const chart = normalizeChart(chartHint ?? objectSpec.chart);
    const width = cliWidth ?? numberOption(objectSpec.width) ?? numberOption(objectSpec.options?.width);
    const options = { ...(objectSpec.options ?? {}), ...(width === undefined ? {} : { width }) };
    if (chart === 'line') {
        const merged = mergeLineOptions(objectSpec, lineOverrides);
        Object.assign(options, merged);
    }
    const output = renderChart(objectSpec, chart, options);
    const filterOutput = renderAttachedFilters(objectSpec, chart, width);
    const rendered = [titleLine(objectSpec.title, width), output, filterOutput].filter(Boolean).join('\n\n');
    if (!extra.integrity)
        return rendered;
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
export function buildCanonicalSpec(spec, chart, width, lineOverrides) {
    const out = { chart };
    if (spec.title !== undefined)
        out.title = spec.title;
    if (width !== undefined)
        out.width = width;
    if (spec.options !== undefined)
        out.options = spec.options;
    if (spec.series !== undefined)
        out.series = spec.series;
    if (spec.rows !== undefined)
        out.rows = spec.rows;
    if (spec.columns !== undefined)
        out.columns = spec.columns;
    if (spec.data !== undefined)
        out.data = spec.data;
    if (spec.steps !== undefined)
        out.steps = spec.steps;
    if (spec.cohorts !== undefined)
        out.cohorts = spec.cohorts;
    if (spec.buckets !== undefined)
        out.buckets = spec.buckets;
    if (spec.points !== undefined)
        out.points = spec.points;
    if (spec.value !== undefined)
        out.value = spec.value;
    if (spec.values !== undefined)
        out.values = spec.values;
    if (spec.filters !== undefined)
        out.filters = spec.filters;
    if (spec.suggestions !== undefined)
        out.suggestions = spec.suggestions;
    if (spec.suggested_filters !== undefined)
        out.suggested_filters = spec.suggested_filters;
    if (chart === 'line') {
        // Fold CLI overrides into the spec so re-render does not depend on
        // having the same `--vline` / `--shade` / `--footer` / `--xaxis-labels`
        // / `--linestyle` flags on the verify call.
        const vlines = lineOverrides.vlines ?? spec.vlines;
        if (vlines !== undefined)
            out.vlines = vlines;
        const shades = lineOverrides.shades ?? spec.shades;
        if (shades !== undefined)
            out.shades = shades;
        const footer = lineOverrides.footer ?? spec.footer;
        if (footer !== undefined)
            out.footer = footer;
        const xAxisLabels = lineOverrides.xAxisLabels ?? spec.xAxisLabels;
        if (xAxisLabels !== undefined)
            out.xAxisLabels = xAxisLabels;
        const lineStyle = lineOverrides.lineStyle ?? spec.lineStyle;
        if (lineStyle !== undefined)
            out.lineStyle = lineStyle;
    }
    return out;
}
// Re-renders a previously-canonicalized spec. Used by `agentviz verify` to
// recompute the body for comparison. The spec already encodes its own
// chart kind and width, so no overrides are passed.
const integrityRerender = (spec) => renderAgentVizSpec(spec);
function mergeLineOptions(spec, overrides) {
    const merged = {};
    if (spec.vlines !== undefined)
        merged.vlines = spec.vlines;
    if (overrides.vlines !== undefined)
        merged.vlines = overrides.vlines;
    if (spec.shades !== undefined)
        merged.shades = spec.shades;
    if (overrides.shades !== undefined)
        merged.shades = overrides.shades;
    if (typeof spec.footer === 'string')
        merged.footer = spec.footer;
    if (typeof overrides.footer === 'string')
        merged.footer = overrides.footer;
    if (spec.xAxisLabels !== undefined)
        merged.xAxisLabels = spec.xAxisLabels;
    if (overrides.xAxisLabels !== undefined)
        merged.xAxisLabels = overrides.xAxisLabels;
    if (spec.lineStyle !== undefined)
        merged.lineStyle = spec.lineStyle;
    if (overrides.lineStyle !== undefined)
        merged.lineStyle = overrides.lineStyle;
    return merged;
}
export function parseAgentVizArgs(argv) {
    const args = {};
    // `verify` is a subcommand that takes only an optional file path; it does
    // not accept chart kinds or render flags.
    if (argv[0] === 'verify') {
        args.verify = true;
        for (let i = 1; i < argv.length; i += 1) {
            const arg = argv[i];
            if (!arg)
                continue;
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
        if (!arg)
            continue;
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
            if (!value)
                throw new Error(`${arg} requires a number`);
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
            if (!value)
                throw new Error('--vline requires a key=value spec');
            (args.vlines ??= []).push(parseVlineSpec(value));
            index += 1;
            continue;
        }
        if (arg.startsWith('--vline=')) {
            (args.vlines ??= []).push(parseVlineSpec(arg.slice('--vline='.length)));
            continue;
        }
        if (arg === '--shade') {
            const value = argv[index + 1];
            if (!value)
                throw new Error('--shade requires a key=value spec');
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
            if (value === undefined)
                throw new Error('--footer requires a value');
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
            if (!value)
                throw new Error('--xaxis-labels requires a value (auto|stagger|skip:N)');
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
            if (!value)
                throw new Error('--linestyle requires a value (linear|step|markers-only)');
            args.lineStyle = parseLineStyle(value);
            index += 1;
            continue;
        }
        if (arg.startsWith('--linestyle=')) {
            args.lineStyle = parseLineStyle(arg.slice('--linestyle='.length));
            continue;
        }
        if (!args.chart && CHARTS.has(arg)) {
            args.chart = arg;
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
function parseKeyValueSpec(spec) {
    const out = {};
    for (const part of spec.split(',')) {
        const trimmed = part.trim();
        if (trimmed.length === 0)
            continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0)
            throw new Error(`expected key=value, got: ${trimmed}`);
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (key.length === 0)
            throw new Error(`empty key in: ${trimmed}`);
        out[key] = value;
    }
    return out;
}
function parseVlineSpec(spec) {
    const parts = parseKeyValueSpec(spec);
    if (!parts.at)
        throw new Error('--vline requires at=<bucket>');
    const vline = { at: parts.at };
    if (parts.label !== undefined)
        vline.label = parts.label;
    if (parts.position !== undefined) {
        if (parts.position !== 'above' && parts.position !== 'below') {
            throw new Error(`--vline position must be above|below, got: ${parts.position}`);
        }
        vline.position = parts.position;
    }
    return vline;
}
function parseShadeSpec(spec) {
    const parts = parseKeyValueSpec(spec);
    if (!parts.from || !parts.to)
        throw new Error('--shade requires from=<bucket>,to=<bucket>');
    const shade = { from: parts.from, to: parts.to };
    if (parts.label !== undefined)
        shade.label = parts.label;
    if (parts.pattern !== undefined) {
        if (parts.pattern !== 'hatch' && parts.pattern !== 'gray' && parts.pattern !== 'dotted') {
            throw new Error(`--shade pattern must be hatch|gray|dotted, got: ${parts.pattern}`);
        }
        shade.pattern = parts.pattern;
    }
    return shade;
}
function parseXAxisLabels(value) {
    if (value === 'auto' || value === 'stagger')
        return value;
    if (value.startsWith('skip:')) {
        const n = Number(value.slice('skip:'.length));
        if (!Number.isFinite(n) || n <= 0)
            throw new Error(`--xaxis-labels skip:N requires a positive integer, got: ${value}`);
        return { skipEvery: Math.floor(n) };
    }
    throw new Error(`--xaxis-labels must be auto|stagger|skip:N, got: ${value}`);
}
function parseLineStyle(value) {
    if (value === 'linear' || value === 'step' || value === 'markers-only' || value === 'braille')
        return value;
    throw new Error(`--linestyle must be linear|step|markers-only|braille, got: ${value}`);
}
async function main() {
    try {
        const args = parseAgentVizArgs(process.argv.slice(2));
        if (args.help) {
            process.stdout.write(helpText());
            return;
        }
        if (args.verify) {
            const text = args.file ? readFileSync(args.file, 'utf8') : await readStdin();
            const result = verifyIntegrity(text, integrityRerender);
            const summaryParts = [];
            if (result.chart)
                summaryParts.push(`chart=${result.chart}`);
            if (result.version)
                summaryParts.push(`agentviz=${result.version}`);
            if (result.actualHash)
                summaryParts.push(`sha256=${result.actualHash.slice(0, 12)}…`);
            const summary = summaryParts.length > 0 ? ` (${summaryParts.join(' ')})` : '';
            if (result.status === 'ok') {
                process.stdout.write(`OK${summary}\n`);
                const lead = result.leadingContentLength ?? 0;
                const trail = result.trailingContentLength ?? 0;
                if (lead > 0 || trail > 0) {
                    process.stdout.write(`  note: ${lead} byte(s) before and ${trail} byte(s) after the verified block are NOT covered by the hash\n`);
                }
                return;
            }
            if (result.status === 'tampered') {
                process.stdout.write(`TAMPERED${summary}\n`);
                if (result.reason)
                    process.stdout.write(`  reason: ${result.reason}\n`);
                if (result.expectedHash && result.actualHash) {
                    process.stdout.write(`  expected sha256: ${result.expectedHash}\n`);
                    process.stdout.write(`  declared sha256: ${result.actualHash}\n`);
                }
                process.exitCode = 2;
                return;
            }
            process.stdout.write(`${result.status.toUpperCase()}${summary}\n`);
            if (result.reason)
                process.stdout.write(`  reason: ${result.reason}\n`);
            process.exitCode = 2;
            return;
        }
        const input = args.file ? readFileSync(args.file, 'utf8') : await readStdin();
        const spec = JSON.parse(input);
        const lineOverrides = {};
        if (args.vlines !== undefined)
            lineOverrides.vlines = args.vlines;
        if (args.shades !== undefined)
            lineOverrides.shades = args.shades;
        if (args.footer !== undefined)
            lineOverrides.footer = args.footer;
        if (args.xAxisLabels !== undefined)
            lineOverrides.xAxisLabels = args.xAxisLabels;
        if (args.lineStyle !== undefined)
            lineOverrides.lineStyle = args.lineStyle;
        const extra = {};
        if (args.integrity)
            extra.integrity = true;
        process.stdout.write(`${renderAgentVizSpec(spec, args.chart, args.width, lineOverrides, extra)}\n`);
    }
    catch (error) {
        process.stderr.write(`agentviz: ${error instanceof Error ? error.message : String(error)}\n\n`);
        process.stderr.write(helpText());
        process.exitCode = 1;
    }
}
function renderChart(spec, chart, options) {
    switch (chart) {
        case 'bar':
            return renderBarChart(arrayFrom(spec.rows ?? spec.data, 'rows'), options);
        case 'bignumber':
            return renderBigNumber(numberFrom(spec.value ?? spec.data, 'value'), options);
        case 'filters':
            return renderFilterSummary(arrayFrom(spec.filters ?? spec.data, 'filters'), {
                ...options,
                suggestions: arrayFrom(spec.suggestions ?? spec.suggested_filters ?? [], 'suggestions'),
            });
        case 'funnel':
            return renderFunnelBars(arrayFrom(spec.steps ?? spec.data, 'steps'), options);
        case 'line':
            return renderLineChart(arrayFrom(spec.series ?? spec.data, 'series'), options);
        case 'retention':
            return renderRetentionHeatmap(arrayFrom(spec.cohorts ?? spec.data, 'cohorts'), options);
        case 'scatter':
            return renderScatterPlot(arrayFrom(spec.points ?? spec.data, 'points'), options);
        case 'sparkline':
            return renderSparkline(numberArrayFrom(spec.values ?? spec.data, 'values'), options);
        case 'stacked':
            return renderStackedBarChart(arrayFrom(spec.buckets ?? spec.data, 'buckets'), options);
        case 'table':
            return renderTable(arrayFrom(spec.rows ?? spec.data, 'rows'), arrayFrom(spec.columns, 'columns'), options);
        case 'waterfall':
            return renderWaterfallChart(arrayFrom(spec.steps ?? spec.data, 'steps'), options);
    }
}
function renderAttachedFilters(spec, chart, width) {
    if (chart === 'filters')
        return undefined;
    const filters = spec.filters ?? [];
    const suggestions = spec.suggestions ?? spec.suggested_filters ?? [];
    if (filters.length === 0 && suggestions.length === 0)
        return undefined;
    return renderFilterSummary(filters, { width, suggestions });
}
function normalizeSpec(spec) {
    if (!isRecord(spec))
        throw new Error('input must be a JSON object');
    return spec;
}
function normalizeChart(value) {
    if (typeof value !== 'string' || !CHARTS.has(value)) {
        throw new Error(`chart must be one of: ${[...CHARTS].join(', ')}`);
    }
    return value;
}
function titleLine(value, width) {
    if (typeof value !== 'string' || value.trim().length === 0)
        return undefined;
    const title = value.trim();
    if (!width || title.length <= width)
        return title;
    if (width <= 1)
        return title.slice(0, Math.max(0, width));
    return `${title.slice(0, width - 1)}~`;
}
function arrayFrom(value, label) {
    if (!Array.isArray(value))
        throw new Error(`${label} must be an array`);
    return value;
}
function numberFrom(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${label} must be a finite number`);
    }
    return value;
}
function numberArrayFrom(value, label) {
    const values = arrayFrom(value, label);
    if (!values.every((item) => typeof item === 'number'))
        throw new Error(`${label} must be an array of numbers`);
    return values;
}
function numberOption(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function parseWidth(value) {
    const width = Number(value);
    if (!Number.isFinite(width) || width <= 0)
        throw new Error(`invalid width: ${value}`);
    return width;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
async function readStdin() {
    if (process.stdin.isTTY)
        throw new Error('pass a JSON file or pipe JSON to stdin');
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}
function helpText() {
    return `agentviz

Render terminal charts from JSON. Built for agents that need to show evidence
inside a CLI transcript.

Usage:
  agentviz <chart> [file.json] [--width 100] [--integrity]
  cat chart.json | agentviz <chart>
  agentviz verify [chart.txt]
  cat chart.txt | agentviz verify

Charts:
  bar, bignumber, filters, funnel, line, retention, scatter, sparkline, stacked, table, waterfall

Line chart flags (repeatable where noted):
  --vline at=<bucket>[,label=<text>][,position=above|below]
  --shade from=<bucket>,to=<bucket>[,label=<text>][,pattern=hatch|gray|dotted]
  --footer <text>
  --xaxis-labels auto|stagger|skip:<N>
  --linestyle linear|step|markers-only|braille

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

Funnel input:
  {"steps":[{"label":"Visited","count":120},{"label":"Paid","count":18}]}

Big-number input:
  {"value":1234,"options":{"label":"Weekly signups","previous":1102,"sparkline":[900,1102,1050,1234]}}
`;
}
function isCliEntrypoint() {
    const entrypoint = process.argv[1];
    if (!entrypoint)
        return false;
    try {
        return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entrypoint);
    }
    catch {
        return import.meta.url === `file://${entrypoint}`;
    }
}
if (isCliEntrypoint()) {
    void main();
}
