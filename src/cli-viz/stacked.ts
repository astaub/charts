import { bodyText, categorical, fg, FULL_BLOCK, mutedText, THEME, type RGB } from './theme.js';
import { legend as legendComponent, padEnd, padStart, panel, type LegendItem } from './components.js';
import { makeRenderCtx } from './render-context.js';

const DEFAULT_WIDTH = 80;
const NARROW_WIDTH = 64;
const MIN_WIDTH = 32;
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const SEGMENT_SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');

export interface StackedBarSegmentDatum {
  key: string;
  label?: string;
  value: number;
}

export interface StackedBarBucketDatum {
  label: string;
  segments: StackedBarSegmentDatum[];
  total?: number;
}

export interface StackedBarChartOptions {
  width?: number;
  title?: string;
  emptyLabel?: string;
  segmentOrder?: string[];
  showLegend?: boolean;
  color?: 'never' | 'auto' | 'always';
  isTTY?: boolean;
  env?: Record<string, string | undefined>;
}

interface CleanSegment {
  key: string;
  label: string;
  value: number;
}

interface CleanBucket {
  label: string;
  segments: CleanSegment[];
  total: number;
}

interface SegmentMeta {
  key: string;
  label: string;
  symbol: string;
  color: RGB;
}

export function renderStackedBarChart(buckets: StackedBarBucketDatum[], options: StackedBarChartOptions = {}): string {
  const width = clampWidth(options.width);
  const emptyLabel = sanitizeText(options.emptyLabel ?? 'No stacked bar chart data.');
  if (buckets.length === 0) return truncateLine(emptyLabel, width);

  const cleanBuckets = cleanStackedBuckets(buckets);
  if (cleanBuckets.length === 0) return truncateLine(emptyLabel, width);

  const segments = segmentMetadata(cleanBuckets, options.segmentOrder);
  if (segments.length === 0) return truncateLine(emptyLabel, width);

  const ctx = makeRenderCtx(options);

  // Narrow / can't-fit → keep the plain per-bucket block listing.
  if (shouldRenderBlocks(cleanBuckets, segments, width)) {
    return renderStackedBlocks(cleanBuckets, segments, width);
  }

  const inner = width - 4;
  const bucketWidth = Math.min(16, Math.max(6, longest(cleanBuckets.map((bucket) => bucket.label))));
  const totalWidth = Math.max('Total'.length, longest(cleanBuckets.map((bucket) => formatNumber(bucket.total))));
  const gap = '  ';
  const barWidth = Math.max(8, inner - bucketWidth - totalWidth - gap.length * 2);

  const body: string[] = [];
  if (options.showLegend !== false) {
    const items: LegendItem[] = segments.map((segment) => ({ label: segment.label, color: segment.color }));
    // Color mode uses colored ● swatches; mono keys the legend by the segment's
    // letter symbol so it matches the symbols painted into the stacked bar.
    if (ctx.color) {
      body.push(...legendComponent(ctx, items, inner), '');
    } else {
      const monoLegend = segments.map((segment) => `${segment.symbol} ${segment.label}`).join('   ');
      body.push(...wrapLine(`Legend: ${monoLegend}`, inner), '');
    }
  }
  const header = padEnd(ctx, '', bucketWidth) + gap + padEnd(ctx, '', barWidth) + gap + padStart(ctx, 'Total', totalWidth);
  body.push(ctx.color ? mutedText(header) : header, '');

  for (const bucket of cleanBuckets) {
    const rawLabel = padEnd(ctx, ctx.truncate(bucket.label, bucketWidth), bucketWidth);
    const label = ctx.color ? bodyText(rawLabel) : rawLabel;
    const bar = renderStack(ctx, bucket, segments, barWidth);
    const total = padStart(ctx, formatNumber(bucket.total), totalWidth);
    body.push(`${label}${gap}${bar}${gap}${ctx.color ? mutedText(total) : total}`);
  }

  return panel(ctx, {
    body,
    width,
    accent: THEME.accent,
    ...(options.title ? { title: sanitizeText(options.title) } : {}),
  }).join('\n');
}

function cleanStackedBuckets(buckets: StackedBarBucketDatum[]): CleanBucket[] {
  return buckets.map((bucket) => {
    const segments = bucket.segments
      .filter((segment) => Number.isFinite(segment.value))
      .map((segment) => {
        const rawKey = segment.key ?? segment.label ?? '';
        const key = sanitizeText(rawKey);
        return {
          key,
          label: sanitizeText(segment.label ?? key),
          value: numeric(segment.value),
        };
      })
      .filter((segment) => segment.key.length > 0);
    const segmentTotal = segments.reduce((sum, segment) => sum + segment.value, 0);
    const total = bucket.total === undefined || !Number.isFinite(bucket.total) ? segmentTotal : numeric(bucket.total);
    return {
      label: sanitizeText(bucket.label),
      segments,
      total,
    };
  });
}

function segmentMetadata(buckets: CleanBucket[], segmentOrder: string[] | undefined): SegmentMeta[] {
  const byKey = new Map<string, string>();
  for (const bucket of buckets) {
    for (const segment of bucket.segments) {
      if (!byKey.has(segment.key)) byKey.set(segment.key, segment.label);
    }
  }

  const orderedKeys = [
    ...(segmentOrder ?? []).map(sanitizeText).filter((key) => byKey.has(key)),
    ...[...byKey.keys()].filter((key) => !(segmentOrder ?? []).map(sanitizeText).includes(key)),
  ];

  return orderedKeys.map((key, index) => ({
    key,
    label: byKey.get(key) ?? key,
    symbol: SEGMENT_SYMBOLS[index] ?? '?',
    color: categorical(index),
  }));
}

function shouldRenderBlocks(buckets: CleanBucket[], segments: SegmentMeta[], width: number): boolean {
  if (width < NARROW_WIDTH) return true;
  const bucketWidth = Math.min(16, Math.max(6, longest(buckets.map((bucket) => bucket.label))));
  const totalWidth = Math.max(5, longest(buckets.map((bucket) => formatNumber(bucket.total))));
  const segmentWidths = segments.map((segment) => {
    const values = buckets.map((bucket) => formatSegmentShare(findSegment(bucket, segment.key)?.value ?? 0, bucket.total));
    return Math.min(18, Math.max(visualWidth(segment.label), ...values.map(visualWidth)));
  });
  const fixedWidth = bucketWidth + totalWidth + segmentWidths.reduce((sum, next) => sum + next, 0) + (segments.length + 2) * 2 + 8;
  return fixedWidth > width;
}

function renderStackedBlocks(buckets: CleanBucket[], segments: SegmentMeta[], width: number): string {
  const barWidth = Math.max(8, Math.min(32, width - 8));
  // The narrow listing is plain text (wrapLine strips ANSI), so the mix bar uses
  // the letter-symbol (mono) form.
  const monoCtx = makeRenderCtx({ color: 'never' });
  return buckets
    .flatMap((bucket, index) => {
      const prefix = `${index + 1}. `;
      return [
        ...(index > 0 ? [''] : []),
        `${prefix}${truncateLine(bucket.label, width - visualWidth(prefix))}`,
        ...wrapLine(`   total: ${formatNumber(bucket.total)}`, width),
        ...segments.flatMap((segment) =>
          wrapLine(`   ${segment.label}: ${formatSegmentShare(findSegment(bucket, segment.key)?.value ?? 0, bucket.total)}`, width),
        ),
        ...wrapLine(`   mix: ${renderStack(monoCtx, bucket, segments, barWidth)}`, width),
      ];
    })
    .join('\n');
}

// The signature stacked bar: each segment is a proportional run of solid blocks
// in its palette color (color mode) or its letter symbol (mono). Any uncovered
// remainder is a faint track so the bar always fills `width` columns cleanly.
function renderStack(ctx: ReturnType<typeof makeRenderCtx>, bucket: CleanBucket, segments: SegmentMeta[], width: number): string {
  const trackCell = (count: number) =>
    count <= 0 ? '' : ctx.color ? fg(THEME.track, FULL_BLOCK.repeat(count)) : repeat('░', count);
  if (width <= 0) return '';
  if (bucket.total <= 0) return trackCell(width);

  const rawWidths = segments.map((segment) => {
    const value = findSegment(bucket, segment.key)?.value ?? 0;
    const exact = (Math.max(0, value) / bucket.total) * width;
    return {
      segment,
      whole: Math.floor(exact),
      remainder: exact - Math.floor(exact),
      value,
    };
  });
  let used = rawWidths.reduce((sum, next) => sum + next.whole, 0);
  const listedTotal = rawWidths.reduce((sum, next) => sum + Math.max(0, next.value), 0);
  const targetUsed = Math.min(width, Math.round((listedTotal / bucket.total) * width));
  const positive = rawWidths.filter((entry) => entry.value > 0);
  const sorted = [...positive].sort((left, right) => right.remainder - left.remainder);

  for (let index = 0; used < targetUsed && sorted.length > 0; index += 1) {
    (sorted[index % sorted.length] as (typeof sorted)[number]).whole += 1;
    used += 1;
  }

  while (used > width) {
    const shrinkable = rawWidths.find((entry) => entry.whole > 0);
    if (!shrinkable) break;
    shrinkable.whole -= 1;
    used -= 1;
  }

  const filled = rawWidths
    .filter((entry) => entry.whole > 0)
    .map((entry) => (ctx.color ? fg(entry.segment.color, FULL_BLOCK.repeat(entry.whole)) : repeat(entry.segment.symbol, entry.whole)))
    .join('');
  const filledCols = rawWidths.reduce((sum, entry) => sum + entry.whole, 0);
  return filled + trackCell(Math.max(0, width - filledCols));
}

function findSegment(bucket: CleanBucket, key: string): CleanSegment | undefined {
  return bucket.segments.find((segment) => segment.key === key);
}

function formatSegmentShare(value: number, total: number): string {
  return `${formatNumber(value)} (${formatPercent(ratio(value, total))})`;
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
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
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

function ratio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
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
