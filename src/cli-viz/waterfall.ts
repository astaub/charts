import { bodyText, fg, FULL_BLOCK, mutedText, THEME, type RGB } from './theme.js';
import { panel } from './components.js';
import { makeRenderCtx } from './render-context.js';
import type { RenderCtx } from './components.js';

const DEFAULT_WIDTH = 80;
const NARROW_WIDTH = 54;
const MIN_WIDTH = 32;
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;

export type WaterfallStepKind = 'start' | 'end' | 'positive' | 'negative';

export interface WaterfallStep {
  label: string;
  value: number;
  kind?: WaterfallStepKind;
}

export interface WaterfallChartOptions {
  width?: number;
  emptyLabel?: string;
  title?: string;
  color?: 'never' | 'auto' | 'always';
  isTTY?: boolean;
  env?: Record<string, string | undefined>;
}

// Semantic color per step kind: gains are positive (green), drops negative
// (red), and the start/end totals use the brand accent.
function kindColor(kind: WaterfallStepKind): RGB {
  if (kind === 'negative') return THEME.negative;
  if (kind === 'positive') return THEME.positive;
  return THEME.accent;
}

interface CleanWaterfallStep {
  label: string;
  value: number;
  kind: WaterfallStepKind;
}

interface WaterfallSegment extends CleanWaterfallStep {
  base: number;
  delta: number;
  total: number;
}

export function renderWaterfallChart(steps: WaterfallStep[], options: WaterfallChartOptions = {}): string {
  const width = clampWidth(options.width);
  const cleanSteps = normalizeSteps(steps);

  if (cleanSteps.length === 0) {
    return truncateLine(sanitizeText(options.emptyLabel ?? 'No waterfall data.'), width);
  }

  const segments = waterfallSegments(cleanSteps);
  if (width < NARROW_WIDTH) return renderWaterfallBlocks(segments, width);

  const ctx = makeRenderCtx(options);
  const labelWidth = Math.min(30, Math.max(8, longest(segments.map((segment) => segment.label))));
  const valueWidth = Math.max('Value'.length, longest(segments.map((segment) => formatNumber(segment.value))));
  const changeWidth = Math.max('Change'.length, longest(segments.map((segment) => formatChange(segment))));
  const totalWidth = Math.max('Total'.length, longest(segments.map((segment) => formatNumber(segment.total))));
  const gap = '  ';
  const inner = width - 4;
  const fixedWidth = labelWidth + valueWidth + changeWidth + totalWidth + gap.length * 4;

  if (fixedWidth + 6 > inner) return renderWaterfallBlocks(segments, width);

  const barWidth = Math.max(6, inner - fixedWidth);
  const dimText = (text: string) => (ctx.color ? mutedText(text) : text);
  const header = [
    padCell('Step', labelWidth, 'left'),
    padCell('Value', valueWidth, 'right'),
    padCell('Change', changeWidth, 'right'),
    padCell('Total', totalWidth, 'right'),
    padCell('Bar', barWidth, 'left'),
  ].join(gap);
  const body: string[] = [dimText(header), ''];

  for (const segment of segments) {
    // The Change column is tinted by direction (a small Tremor-style delta cue).
    const changeText = padCell(formatChange(segment), changeWidth, 'right');
    const change = !ctx.color || segment.kind === 'start' || segment.kind === 'end'
      ? dimText(changeText)
      : fg(segment.delta < 0 ? THEME.negative : THEME.positive, changeText);
    const label = ctx.color ? bodyText(padCell(segment.label, labelWidth, 'left')) : padCell(segment.label, labelWidth, 'left');
    const valueCell = ctx.color ? bodyText(padCell(formatNumber(segment.value), valueWidth, 'right')) : padCell(formatNumber(segment.value), valueWidth, 'right');
    body.push(
      [
        label,
        valueCell,
        change,
        dimText(padCell(formatNumber(segment.total), totalWidth, 'right')),
        waterfallBar(ctx, segment, segments, barWidth),
      ].join(gap),
    );
  }

  return panel(ctx, {
    body,
    width,
    accent: THEME.accent,
    ...(options.title ? { title: sanitizeText(options.title) } : {}),
  }).join('\n');
}

function normalizeSteps(steps: WaterfallStep[]): CleanWaterfallStep[] {
  return steps
    .filter((step) => Number.isFinite(step.value))
    .map((step, index) => ({
      label: sanitizeText(step.label),
      value: numeric(step.value),
      kind: step.kind ?? (index === 0 ? 'start' : step.value < 0 ? 'negative' : 'positive'),
    }))
    .filter((step) => step.label.length > 0);
}

function waterfallSegments(steps: CleanWaterfallStep[]): WaterfallSegment[] {
  let running = 0;

  return steps.map((step, index) => {
    const kind = normalizeKind(step.kind, index);
    if (kind === 'start' || kind === 'end') {
      const previous = running;
      running = step.value;
      return {
        ...step,
        kind,
        base: 0,
        delta: running - previous,
        total: running,
      };
    }

    const signedDelta = kind === 'negative' ? -Math.abs(step.value) : Math.abs(step.value);
    const base = running;
    running += signedDelta;
    return {
      ...step,
      kind,
      base,
      delta: signedDelta,
      total: running,
    };
  });
}

function normalizeKind(kind: WaterfallStepKind, index: number): WaterfallStepKind {
  if (index === 0 && kind !== 'start') return kind;
  return kind;
}

function renderWaterfallBlocks(segments: WaterfallSegment[], width: number): string {
  return segments
    .flatMap((segment, index) => {
      const prefix = `${index + 1}. `;
      return [
        ...(index > 0 ? [''] : []),
        `${prefix}${truncateLine(segment.label, width - visualWidth(prefix))}`,
        ...wrapLine(`   value: ${formatNumber(segment.value)}`, width),
        ...wrapLine(`   change: ${formatChange(segment)}`, width),
        ...wrapLine(`   total: ${formatNumber(segment.total)}`, width),
        ...wrapLine(`   ${waterfallCompactLine(segment)}`, width),
      ];
    })
    .join('\n');
}

function waterfallCompactLine(segment: WaterfallSegment): string {
  if (segment.kind === 'start') return `█ start ${formatNumber(segment.total)}`;
  if (segment.kind === 'end') return `█ end ${formatNumber(segment.total)}`;
  if (segment.kind === 'negative') return `░ ${formatNumber(segment.base)} to ${formatNumber(segment.total)}`;
  return `# ${formatNumber(segment.base)} to ${formatNumber(segment.total)}`;
}

function waterfallBar(ctx: RenderCtx, segment: WaterfallSegment, segments: WaterfallSegment[], width: number): string {
  const bounds = waterfallBounds(segments);
  const min = bounds.min;
  const max = bounds.max;
  if (width <= 0) return '';

  // Mono distinguishes kinds by glyph; color uses a solid block tinted by kind.
  const monoFill = segment.kind === 'negative' ? '░' : segment.kind === 'positive' ? '#' : '█';
  const fill = ctx.color ? fg(kindColor(segment.kind), FULL_BLOCK) : monoFill;
  const zeroMark = ctx.color ? mutedText('|') : '|';
  const cells = Array.from({ length: width }, () => ' ');

  if (max !== min) {
    const start = segment.kind === 'start' || segment.kind === 'end' ? Math.min(0, segment.total) : Math.min(segment.base, segment.total);
    const end = segment.kind === 'start' || segment.kind === 'end' ? Math.max(0, segment.total) : Math.max(segment.base, segment.total);
    const left = scalePosition(start, min, max, width);
    const right = Math.max(left, scalePosition(end, min, max, width));
    for (let index = left; index <= right && index < cells.length; index += 1) {
      if (index >= 0) cells[index] = fill;
    }
    const zero = scalePosition(0, min, max, width);
    if (zero >= 0 && zero < cells.length && cells[zero] === ' ') cells[zero] = zeroMark;
  } else if (cells.length > 0) {
    cells[0] = fill;
  }

  // Full width (never trimmed) so the panel right border stays a clean column.
  return cells.join('');
}

function waterfallBounds(segments: WaterfallSegment[]): { min: number; max: number } {
  const values = segments.flatMap((segment) => [0, segment.base, segment.total]);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function scalePosition(value: number, min: number, max: number, width: number): number {
  if (width <= 1 || max === min) return 0;
  const scaled = ((value - min) / (max - min)) * (width - 1);
  return Math.max(0, Math.min(width - 1, Math.round(scaled)));
}

function formatChange(segment: WaterfallSegment): string {
  if (segment.kind === 'start') return 'start';
  if (segment.kind === 'end') return 'end';
  const prefix = segment.delta > 0 ? '+' : '';
  return `${prefix}${formatNumber(segment.delta)}`;
}

function padCell(value: string, width: number, align: 'left' | 'right'): string {
  const text = truncateLine(sanitizeText(value), width);
  const padding = repeat(' ', Math.max(0, width - visualWidth(text)));
  return align === 'right' ? `${padding}${text}` : `${text}${padding}`;
}

function truncateLine(value: string, width: number): string {
  const text = cleanDisplayLine(value);
  if (visualWidth(text) <= width) return text;
  if (width <= 1) return takeDisplayWidth(text, Math.max(0, width));
  return `${takeDisplayWidth(text, width - 1)}~`;
}

function wrapLine(value: string, width: number): string[] {
  const text = sanitizeText(value);
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

function sanitizeText(value: string): string {
  return cleanDisplayLine(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

function cleanDisplayLine(value: string): string {
  return stripAnsi(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
}

function numeric(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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
