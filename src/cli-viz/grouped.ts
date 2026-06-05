import { categorical, fg, FULL_BLOCK, mutedText, THEME, type RGB } from './theme.js';
import { panel } from './components.js';
import { makeRenderCtx } from './render-context.js';
import type { RenderCtx } from './components.js';

const DEFAULT_WIDTH = 80;
const NARROW_WIDTH = 54;
const MIN_WIDTH = 32;
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const SERIES_SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');

export interface GroupedBarSeriesDatum {
  key: string;
  label?: string;
  value: number;
}

export interface GroupedBarBucketDatum {
  label: string;
  bars: GroupedBarSeriesDatum[];
}

/** Vertical annotation rule drawn at a bucket's x-position (e.g. a ship date). */
export interface GroupedBarMarker {
  at: string;
  label?: string;
}

/** Format applied to y-axis values: 'percent' treats values as 0–1 ratios. */
export type GroupedBarValueFormat = 'number' | 'percent';

/** Unit affixes for y-axis values, e.g. { prefix: '$' } or { suffix: ' ms' }. */
export interface GroupedBarUnit {
  prefix?: string;
  suffix?: string;
}

export interface GroupedBarChartOptions {
  width?: number;
  height?: number;
  title?: string;
  emptyLabel?: string;
  /** Explicit left-to-right series order by key; unlisted keys follow in first-seen order. */
  seriesOrder?: string[];
  showLegend?: boolean;
  /** Vertical rules drawn at the named buckets. */
  markers?: GroupedBarMarker[];
  valueFormat?: GroupedBarValueFormat;
  unit?: GroupedBarUnit;
  footer?: string;
  color?: 'never' | 'auto' | 'always';
  isTTY?: boolean;
  env?: Record<string, string | undefined>;
  /** Self-frame in the panel box. Default true; `false` emits a bare body. */
  frame?: boolean;
}

interface CleanBar {
  key: string;
  label: string;
  value: number;
}

interface CleanBucket {
  label: string;
  bars: CleanBar[];
}

interface SeriesMeta {
  key: string;
  label: string;
  symbol: string;
  color: RGB;
}

export function renderGroupedBarChart(buckets: GroupedBarBucketDatum[], options: GroupedBarChartOptions = {}): string {
  const width = clampWidth(options.width);
  const emptyLabel = sanitizeText(options.emptyLabel ?? 'No grouped bar chart data.');
  if (buckets.length === 0) return truncateLine(emptyLabel, width);

  const cleanBuckets = cleanGroupedBuckets(buckets);
  if (cleanBuckets.length === 0) return truncateLine(emptyLabel, width);

  const series = seriesMetadata(cleanBuckets, options.seriesOrder);
  if (series.length === 0) return truncateLine(emptyLabel, width);

  const ctx = makeRenderCtx(options);
  const values = cleanBuckets.flatMap((bucket) => bucket.bars.map((bar) => bar.value));
  const maxValue = Math.max(...values, 0);

  const chartHeight = Math.max(4, Math.min(12, Math.floor(options.height ?? 8)));
  const axisLabels = groupedAxisLabels(maxValue, chartHeight, options);
  const labelWidth = Math.max(5, longest(axisLabels));

  // Plot lives inside the panel: lay out against the inner content width.
  const contentWidth = width - 4;
  const layout = resolveLayout(cleanBuckets.length, series.length, labelWidth, contentWidth);

  // Narrow / can't-fit → keep the plain per-bucket block listing.
  if (layout === undefined) {
    return renderGroupedBlocks(cleanBuckets, series, options, width);
  }

  const body: string[] = [];
  if (options.showLegend !== false) body.push(...groupedLegendLines(ctx, series, contentWidth), '');
  body.push(...renderGroupedPlot(ctx, cleanBuckets, series, options, layout, chartHeight, maxValue, axisLabels, labelWidth));
  const footer = renderFooter(options.footer, contentWidth);
  if (footer.length > 0) body.push(...footer);

  return panel(ctx, {
    body,
    width,
    accent: THEME.accent,
    ...(options.title ? { title: sanitizeText(options.title) } : {}),
  }).join('\n');
}

// Colored ● swatches in color mode; mono keys the legend by each series' letter
// symbol so it matches the symbols painted into the bars.
function groupedLegendLines(ctx: RenderCtx, series: SeriesMeta[], width: number): string[] {
  if (ctx.color) {
    const entries = series.map((meta) => `${fg(meta.color, '●')} ${fg(meta.color, meta.label)}`);
    const oneLine = `${mutedText('Legend:')} ${entries.join('   ')}`;
    if (ctx.visualWidth(oneLine) <= width) return [oneLine];
    return [mutedText('Legend:'), ...entries];
  }
  return wrapLine(`Legend: ${series.map((meta) => `${meta.symbol} ${meta.label}`).join('   ')}`, width);
}

function cleanGroupedBuckets(buckets: GroupedBarBucketDatum[]): CleanBucket[] {
  return buckets.map((bucket) => {
    const bars = (bucket.bars ?? [])
      .filter((bar) => Number.isFinite(bar.value))
      .map((bar) => {
        const rawKey = bar.key ?? bar.label ?? '';
        const key = sanitizeText(rawKey);
        return {
          key,
          label: sanitizeText(bar.label ?? key),
          value: numeric(bar.value),
        };
      })
      .filter((bar) => bar.key.length > 0);
    return {
      label: sanitizeText(bucket.label),
      bars,
    };
  });
}

function seriesMetadata(buckets: CleanBucket[], seriesOrder: string[] | undefined): SeriesMeta[] {
  const byKey = new Map<string, string>();
  for (const bucket of buckets) {
    for (const bar of bucket.bars) {
      if (!byKey.has(bar.key)) byKey.set(bar.key, bar.label);
    }
  }

  const ordered = (seriesOrder ?? []).map(sanitizeText).filter((key) => byKey.has(key));
  const orderedKeys = [
    ...ordered,
    ...[...byKey.keys()].filter((key) => !ordered.includes(key)),
  ];

  return orderedKeys.map((key, index) => ({
    key,
    label: byKey.get(key) ?? key,
    symbol: SERIES_SYMBOLS[index] ?? '?',
    color: categorical(index),
  }));
}

interface PlotLayout {
  barWidth: number;
  groupGap: number;
  groupWidth: number;
  plotWidth: number;
  positions: number[];
}

// Returns undefined when the groups cannot fit even at the most compact layout,
// signalling the caller to fall back to the block listing.
function resolveLayout(bucketCount: number, seriesCount: number, labelWidth: number, width: number): PlotLayout | undefined {
  if (width < NARROW_WIDTH) return undefined;
  const available = width - labelWidth - 3;
  if (available < seriesCount + 4) return undefined;

  // Try progressively more compact layouts before giving up on the plot.
  for (const [barWidth, groupGap] of [[2, 2], [1, 2], [1, 1]] as Array<[number, number]>) {
    const groupWidth = seriesCount * barWidth;
    const total = bucketCount * groupWidth + Math.max(0, bucketCount - 1) * groupGap;
    if (total <= available) {
      const positions = groupCenters(bucketCount, groupWidth, groupGap);
      return { barWidth, groupGap, groupWidth, plotWidth: total, positions };
    }
  }
  return undefined;
}

function groupCenters(bucketCount: number, groupWidth: number, groupGap: number): number[] {
  const centers: number[] = [];
  let cursor = 0;
  for (let index = 0; index < bucketCount; index += 1) {
    centers.push(cursor + Math.floor((groupWidth - 1) / 2));
    cursor += groupWidth + groupGap;
  }
  return centers;
}

function renderGroupedPlot(
  ctx: RenderCtx,
  buckets: CleanBucket[],
  series: SeriesMeta[],
  options: GroupedBarChartOptions,
  layout: PlotLayout,
  chartHeight: number,
  maxValue: number,
  axisLabels: string[],
  labelWidth: number,
): string[] {
  const { barWidth, groupWidth, groupGap, plotWidth, positions } = layout;
  const grid = Array.from({ length: chartHeight }, () => Array.from({ length: plotWidth }, () => ' '));
  const colorBySymbol = new Map(series.map((meta) => [meta.symbol, meta.color]));

  // Markers first so bars paint over them on collision.
  const markers = resolveMarkers(options.markers, buckets, positions);
  for (const marker of markers) drawMarker(grid, marker.x);

  buckets.forEach((bucket, bucketIndex) => {
    const groupStart = (groupWidth + groupGap) * bucketIndex;
    series.forEach((meta, seriesIndex) => {
      const value = findBar(bucket, meta.key)?.value ?? 0;
      const barHeight = barCellHeight(value, maxValue, chartHeight);
      const barStart = groupStart + seriesIndex * barWidth;
      for (let column = 0; column < barWidth; column += 1) {
        const x = barStart + column;
        for (let row = chartHeight - barHeight; row < chartHeight; row += 1) {
          const gridRow = grid[row];
          if (gridRow && x >= 0 && x < gridRow.length) gridRow[x] = meta.symbol;
        }
      }
    });
  });

  const dimText = (text: string) => (ctx.color ? mutedText(text) : text);
  const lines: string[] = [];

  // Marker labels above the plot.
  const aboveLabels = renderMarkerLabelLine(markers, labelWidth, plotWidth);
  if (aboveLabels) lines.push(aboveLabels);

  for (let row = 0; row < chartHeight; row += 1) {
    const cells = grid[row] ?? [];
    let plot = '';
    for (const ch of cells) {
      if (ch === ' ') plot += ' ';
      else if (ch === '│') plot += dimText('│'); // marker rule
      else if (ctx.color) plot += fg(colorBySymbol.get(ch) ?? THEME.accent, FULL_BLOCK); // colored bar cell
      else plot += ch; // mono: series symbol
    }
    lines.push(`${dimText(padCell(axisLabels[row] ?? '0', labelWidth, 'right'))} ${dimText('|')} ${plot}`);
  }
  lines.push(`${dimText(repeat(' ', labelWidth))} ${dimText('+')} ${dimText(repeat('-', Math.max(1, plotWidth)))}`);
  lines.push(...groupedBucketLabelLines(buckets, positions, labelWidth, plotWidth).map(dimText));

  return lines;
}

function renderGroupedBlocks(
  buckets: CleanBucket[],
  series: SeriesMeta[],
  options: GroupedBarChartOptions,
  width: number,
): string {
  const markers = (options.markers ?? [])
    .filter((marker) => buckets.some((bucket) => bucket.label === sanitizeText(marker.at)) && sanitizeText(marker.label ?? '').length > 0);

  const blocks = buckets.flatMap((bucket, index) => {
    const prefix = `${index + 1}. `;
    return [
      ...(index > 0 ? [''] : []),
      `${prefix}${truncateLine(bucket.label, width - visualWidth(prefix))}`,
      ...series.flatMap((meta) =>
        wrapLine(`   ${meta.label}: ${formatValue(findBar(bucket, meta.key)?.value ?? 0, options)}`, width),
      ),
    ];
  });

  if (markers.length > 0) {
    const entries = markers.map((marker) => `${sanitizeText(marker.at)}=${sanitizeText(marker.label ?? '')}`);
    blocks.push(...wrapLine(`Marks: ${entries.join('  ')}`, width));
  }

  return blocks.join('\n');
}

interface ResolvedMarker {
  x: number;
  label: string;
}

function resolveMarkers(
  markers: GroupedBarMarker[] | undefined,
  buckets: CleanBucket[],
  positions: number[],
): ResolvedMarker[] {
  if (!markers || markers.length === 0) return [];
  const resolved: ResolvedMarker[] = [];
  for (const marker of markers) {
    const at = sanitizeText(marker.at);
    const index = buckets.findIndex((bucket) => bucket.label === at);
    if (index < 0) continue;
    const x = positions[index];
    if (x === undefined) continue;
    resolved.push({ x, label: sanitizeText(marker.label ?? '') });
  }
  return resolved;
}

function drawMarker(grid: string[][], x: number): void {
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    if (!row || x < 0 || x >= row.length) continue;
    if (row[x] === ' ') row[x] = '│';
  }
}

function renderMarkerLabelLine(markers: ResolvedMarker[], labelWidth: number, plotWidth: number): string | undefined {
  const printable = markers.filter((marker) => marker.label.length > 0);
  if (printable.length === 0) return undefined;
  const line = Array.from({ length: plotWidth }, () => ' ');
  for (const marker of printable) {
    const label = marker.label;
    const start = Math.max(0, Math.min(plotWidth - label.length, marker.x - Math.floor(label.length / 2)));
    // Refuse to overpaint a neighbor: drop the label entirely on collision.
    let collides = false;
    for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
      const target = start + charIndex;
      if (target < 0 || target >= line.length) continue;
      if (line[target] !== undefined && line[target] !== ' ') {
        collides = true;
        break;
      }
    }
    if (collides) continue;
    for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
      const target = start + charIndex;
      if (target >= 0 && target < line.length) line[target] = label[charIndex] ?? ' ';
    }
  }
  return `${repeat(' ', labelWidth)}   ${line.join('').trimEnd()}`;
}

function groupedBucketLabelLines(
  buckets: CleanBucket[],
  positions: number[],
  labelWidth: number,
  plotWidth: number,
): string[] {
  const prefix = `${repeat(' ', labelWidth)}   `;
  const line = Array.from({ length: plotWidth }, () => ' ');
  buckets.forEach((bucket, index) => {
    paintBucketLabel(line, bucket.label, positions[index] ?? 0, plotWidth);
  });
  return [`${prefix}${line.join('').trimEnd()}`];
}

function paintBucketLabel(line: string[], bucket: string, x: number, plotWidth: number): void {
  const label = bucket.slice(0, 7);
  if (label.length === 0) return;
  const start = Math.max(0, Math.min(plotWidth - label.length, x - Math.floor(label.length / 2)));
  // Refuse to paint if any target cell is filled; better to drop the label
  // than corrupt a neighbor by overwriting it.
  for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
    const target = start + charIndex;
    if (target < 0 || target >= line.length) continue;
    if (line[target] !== undefined && line[target] !== ' ') return;
  }
  for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
    const target = start + charIndex;
    if (target >= 0 && target < line.length) line[target] = label[charIndex] ?? ' ';
  }
}

function barCellHeight(value: number, maxValue: number, chartHeight: number): number {
  if (value <= 0 || maxValue <= 0) return 0;
  const exact = (value / maxValue) * chartHeight;
  // Any positive value gets at least one cell so it never silently vanishes.
  return Math.max(1, Math.min(chartHeight, Math.round(exact)));
}

function groupedAxisLabels(maxValue: number, chartHeight: number, options: GroupedBarChartOptions): string[] {
  return Array.from({ length: chartHeight }, (_, row) => {
    const value = maxValue - (row / Math.max(1, chartHeight - 1)) * maxValue;
    return formatValue(value, options);
  });
}

function renderFooter(footer: string | undefined, width: number): string[] {
  if (typeof footer !== 'string' || footer.trim().length === 0) return [];
  return ['', ...wrapLine(footer, width)];
}

function findBar(bucket: CleanBucket, key: string): CleanBar | undefined {
  return bucket.bars.find((bar) => bar.key === key);
}

function formatValue(value: number, options: GroupedBarChartOptions): string {
  if (options.valueFormat === 'percent') return formatPercent(value);
  return `${options.unit?.prefix ?? ''}${formatNumber(value)}${options.unit?.suffix ?? ''}`;
}

function padCell(value: string, width: number, align: 'left' | 'right'): string {
  const text = truncateLine(value, width);
  const padding = repeat(' ', Math.max(0, width - visualWidth(text)));
  return align === 'right' ? `${padding}${text}` : `${text}${padding}`;
}

function truncateLine(value: string, width: number): string {
  const text = cleanDisplayText(value);
  if (visualWidth(text) <= width) return text;
  if (width <= 1) return takeDisplayWidth(text, Math.max(0, width));
  return `${takeDisplayWidth(text, width - 1)}~`;
}

function wrapLine(value: string, width: number): string[] {
  const text = cleanDisplayText(value).replace(/\s+/g, ' ').trimEnd();
  if (visualWidth(text) <= width) return [text];

  const lines: string[] = [];
  let remaining = text;
  while (visualWidth(remaining) > width) {
    const hardSlice = takeDisplayWidth(remaining, width);
    const lastSpace = hardSlice.lastIndexOf(' ');
    const breakAt = lastSpace > Math.floor(width / 2) ? lastSpace : hardSlice.length;
    const line = hardSlice.slice(0, breakAt).trimEnd();
    lines.push(line);
    remaining = remaining.slice(hardSlice.slice(0, breakAt).length).trimStart();
  }
  if (remaining.length > 0) lines.push(remaining);
  return lines;
}

function sanitizeText(value: string): string {
  return cleanDisplayText(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDisplayText(value: string): string {
  return stripAnsi(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '')
    .replace(/[<>]/g, '');
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value > 0 && value < 0.1 ? 1 : 0,
    style: 'percent',
  }).format(value);
}

function numeric(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

function takeDisplayWidth(value: string, width: number): string {
  let used = 0;
  let output = '';
  for (const char of value) {
    const charWidth = charDisplayWidth(char);
    if (used + charWidth > width) break;
    used += charWidth;
    output += char;
  }
  return output;
}

function visualWidth(value: string): number {
  let width = 0;
  for (const char of stripAnsi(value)) width += charDisplayWidth(char);
  return width;
}

function charDisplayWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code === 0) return 0;
  if (code < 32 || (code >= 0x7f && code < 0xa0)) return 0;
  if (code >= 0x300 && code <= 0x36f) return 0;
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2329 && code <= 0x232a) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  ) {
    return 2;
  }
  return 1;
}

function longest(values: string[]): number {
  return Math.max(0, ...values.map(visualWidth));
}

function repeat(value: string, count: number): string {
  return value.repeat(Math.max(0, count));
}

function clampWidth(width: number | undefined): number {
  if (width === undefined) return DEFAULT_WIDTH;
  return Math.max(MIN_WIDTH, Math.floor(width));
}
