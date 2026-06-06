// Horizontal gauge primitive: label · gradient bar · value / max.
//
// It is intentionally bare (no panel) so callers can drop it into dashboards,
// tables, or transcripts. Color is opt-in like every other primitive.

import { FULL_BLOCK, THEME, barGlyphs, bodyText, fg, type RGB } from './theme.js';
import { padEnd } from './components.js';
import { makeRenderCtx, sanitizeText, visualWidth } from './render-context.js';

const DEFAULT_WIDTH = 80;
const MIN_WIDTH = 16;
const MIN_BAR_CELLS = 8;
const MAX_LABEL_WIDTH = 24;
const THRESHOLD_GLYPH = '┊';

export type GaugeColorMode = 'never' | 'auto' | 'always';

export interface GaugeOptions {
  width?: number;
  color?: GaugeColorMode;
  isTTY?: boolean;
  env?: Record<string, string | undefined>;
  /** Label drawn to the left of the bar. */
  label?: string;
  /** Maximum value used for the denominator and bar scale. Must be positive. */
  max: number;
  /** Optional threshold marker, scaled against `max`. */
  threshold?: number;
}

export function renderGauge(value: number, options: GaugeOptions): string {
  const width = clampWidth(options.width);
  const max = Number.isFinite(options.max) ? options.max : 0;
  if (max <= 0) return 'No gauge range.';

  const ctx = makeRenderCtx(options);
  const label = sanitizeText(options.label ?? 'Gauge');
  const valueText = `${formatNumber(value)} / ${formatNumber(max)}`;
  const labelBudget = Math.max(0, width - visualWidth(valueText) - MIN_BAR_CELLS - 4);
  const labelWidth = Math.min(MAX_LABEL_WIDTH, labelBudget, Math.max(0, visualWidth(label)));
  const labelCell = labelWidth > 0 ? padEnd(ctx, ctx.truncate(label, labelWidth), labelWidth) : '';
  const left = labelCell ? `${ctx.color ? bodyText(labelCell) : labelCell}  ` : '';
  const right = `  ${ctx.color ? bodyText(valueText) : valueText}`;
  const barCells = width - ctx.visualWidth(left) - ctx.visualWidth(right);

  if (barCells < MIN_BAR_CELLS) return ctx.truncate(`${label}: ${valueText}`, width);

  const thresholdAt =
    options.threshold !== undefined && Number.isFinite(options.threshold) && options.threshold >= 0
      ? Math.max(0, Math.min(barCells - 1, Math.round((options.threshold / max) * barCells)))
      : undefined;
  const bar = gaugeBar(ctx.color, value / max, barCells, thresholdAt);
  return `${left}${bar}${right}`;
}

function gaugeBar(color: boolean, fraction: number, cells: number, thresholdAt?: number): string {
  const { filled, track } = barGlyphs(fraction, cells);
  const filledChars = [...filled];
  const trackChars = [...track];
  let out = '';

  for (let i = 0; i < cells; i += 1) {
    if (i === thresholdAt) {
      out += color ? fg(THEME.warn, THRESHOLD_GLYPH) : THRESHOLD_GLYPH;
      continue;
    }

    const inFilled = i < filledChars.length;
    if (!color) {
      out += inFilled ? filledChars[i] ?? FULL_BLOCK : trackChars[i - filledChars.length] ?? '░';
      continue;
    }

    out += inFilled ? fg(gaugeColor(i, cells), filledChars[i] ?? FULL_BLOCK) : fg(THEME.track, FULL_BLOCK);
  }

  return out;
}

function gaugeColor(index: number, cells: number): RGB {
  const t = cells <= 1 ? 1 : index / (cells - 1);
  if (t <= 0.5) return mix(THEME.positive, THEME.warn, t * 2);
  return mix(THEME.warn, THEME.accent, (t - 0.5) * 2);
}

function mix(a: RGB, b: RGB, t: number): RGB {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return {
    r: clamp(a.r + (b.r - a.r) * t),
    g: clamp(a.g + (b.g - a.g) * t),
    b: clamp(a.b + (b.b - a.b) * t),
  };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
}

function clampWidth(width: number | undefined): number {
  if (width === undefined) return DEFAULT_WIDTH;
  return Math.max(MIN_WIDTH, Math.floor(width));
}
