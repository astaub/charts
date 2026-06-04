// Shared visual components — the chrome every chart kind draws from so the
// whole system reads as one product: a bordered panel with a colored title and
// optional subtitle, color-coded legends and labels, and a sub-cell-precise
// meter (bar) with a faint track. Each component degrades to clean monochrome
// Unicode when color is off.
//
// These build on the pure primitives in ./theme.ts and the width-aware string
// helpers passed in from index.ts (so there is exactly one display-width
// implementation in the codebase).

import {
  BOX,
  FULL_BLOCK,
  THEME,
  bold,
  dim,
  fg,
  barGlyphs,
  ramp,
  type RGB,
} from './theme.js';

const SPARK_GLYPHS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export interface RenderCtx {
  /** Whether to emit ANSI color. */
  color: boolean;
  /** Display width of a string ignoring ANSI escapes (from index.ts). */
  visualWidth: (value: string) => number;
  /** Truncate to a display width, ANSI-aware (from index.ts). */
  truncate: (value: string, width: number) => string;
}

// ---------------------------------------------------------------------------
// Low-level: pad a (possibly colored) cell to a display width.
// ---------------------------------------------------------------------------

export function padEnd(ctx: RenderCtx, value: string, width: number): string {
  const w = ctx.visualWidth(value);
  if (w >= width) return value;
  return value + ' '.repeat(width - w);
}

export function padStart(ctx: RenderCtx, value: string, width: number): string {
  const w = ctx.visualWidth(value);
  if (w >= width) return value;
  return ' '.repeat(width - w) + value;
}

// ---------------------------------------------------------------------------
// Color-coded label — a label tinted to match its series/segment swatch.
// ---------------------------------------------------------------------------

export function colorLabel(ctx: RenderCtx, text: string, color: RGB): string {
  return ctx.color ? fg(color, text) : text;
}

/** A filled swatch glyph in the given color (●), or a mono bullet. */
export function swatch(ctx: RenderCtx, color: RGB): string {
  return ctx.color ? fg(color, '●') : '•'; // ● / •
}

// ---------------------------------------------------------------------------
// Growth primitives — the pieces that make this a *growth* viz library, shared
// across kinds (KPI tiles, metric rows, annotations).
// ---------------------------------------------------------------------------

export interface DeltaOptions {
  /** Which direction reads as "good" (green). Default 'up'. */
  goodDirection?: 'up' | 'down';
  /** Render the magnitude as a signed number instead of a percentage. */
  as?: 'percent' | 'number';
}

/**
 * A period-over-period delta indicator: `▲ 12%` / `▼ 5%` / `→ 0%`, tinted green
 * when the move is good and red when bad (mono: arrow + magnitude, no color).
 * `change` is the signed change — a ratio (0.12 = +12%) by default, or a raw
 * amount when `as: 'number'`. Non-finite change (e.g. divide-by-zero) → `n/a`.
 * This is the shared green-up / red-down pattern first used in the waterfall.
 */
export function deltaBadge(ctx: RenderCtx, change: number, opts: DeltaOptions = {}): string {
  if (!Number.isFinite(change)) return ctx.color ? dim('n/a') : 'n/a';
  const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '→';
  const magnitude =
    opts.as === 'number'
      ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Math.abs(change))
      : new Intl.NumberFormat('en-US', {
          style: 'percent',
          maximumFractionDigits: Math.abs(change) > 0 && Math.abs(change) < 0.1 ? 1 : 0,
        }).format(Math.abs(change));
  const text = `${arrow} ${magnitude}`;
  if (!ctx.color) return text;
  if (change === 0) return dim(text);
  const good = (opts.goodDirection ?? 'up') === 'up' ? change > 0 : change < 0;
  return fg(good ? THEME.positive : THEME.negative, text);
}

/**
 * A bare inline sparkline (no label / endpoints) for embedding in a tile or row.
 * Color mode tints each glyph along the ramp by its height; mono is plain
 * block glyphs. Returns '' when there is no finite data.
 */
export function inlineSparkline(ctx: RenderCtx, values: number[], color?: RGB): string {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return '';
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const glyphFor = (value: number): { glyph: string; t: number } => {
    const t = max === min ? 0.5 : (value - min) / (max - min);
    const index = Math.round(t * (SPARK_GLYPHS.length - 1));
    return { glyph: SPARK_GLYPHS[Math.max(0, Math.min(SPARK_GLYPHS.length - 1, index))] as string, t };
  };
  if (!ctx.color) return finite.map((value) => glyphFor(value).glyph).join('');
  return finite
    .map((value) => {
      const { glyph, t } = glyphFor(value);
      return fg(color ?? ramp(1 - t), glyph);
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Meter — a sub-cell-precise horizontal bar with a faint track, colored fill.
// ---------------------------------------------------------------------------

const REFERENCE_GLYPH = '┊'; // dashed vertical — a goal/threshold marker

export function meter(ctx: RenderCtx, fraction: number, cells: number, color: RGB, referenceAt?: number): string {
  const { filled, track } = barGlyphs(fraction, cells);
  const filledArr = [...filled];
  const trackArr = [...track];
  // Fast path: no reference marker → the original run-based rendering.
  if (referenceAt === undefined || referenceAt < 0 || referenceAt >= cells) {
    // Mono keeps the ░ track so the channel reads without color. In color mode a
    // smooth dark full-block channel looks far cleaner than the dotted shade.
    if (!ctx.color) return filled + track;
    const trackCells = trackArr.length;
    const filledPart = filled.length > 0 ? fg(color, filled) : '';
    const trackPart = trackCells > 0 ? fg(THEME.track, FULL_BLOCK.repeat(trackCells)) : '';
    return filledPart + trackPart;
  }
  // A goal/threshold reference line is drawn at `referenceAt`, over fill or track.
  let out = '';
  for (let i = 0; i < cells; i += 1) {
    if (i === referenceAt) {
      out += ctx.color ? fg(THEME.warn, REFERENCE_GLYPH) : REFERENCE_GLYPH;
      continue;
    }
    const inFilled = i < filledArr.length;
    if (!ctx.color) {
      out += inFilled ? filledArr[i] ?? FULL_BLOCK : trackArr[i - filledArr.length] ?? '░';
      continue;
    }
    out += inFilled ? fg(color, filledArr[i] ?? FULL_BLOCK) : fg(THEME.track, FULL_BLOCK);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Meter table — the shared body for any horizontal-bar chart (bar, funnel, …):
// a color-coded label, a capped sub-cell meter on the left, then numeric
// columns right-aligned to the panel edge with a flexible spacer between. One
// builder keeps every meter-based chart visually identical.
// ---------------------------------------------------------------------------

export interface MeterRow {
  label: string;
  color: RGB;
  /** Meter fill, 0..1. */
  fraction: number;
  /** Right-aligned numeric cells, in column order. */
  values: string[];
}

export interface MeterTableSpec {
  rows: MeterRow[];
  /** Headers for the numeric columns (right-aligned); same length as each row's values. */
  headers: string[];
  /** Which numeric columns render dim (defaults to all but the first). */
  dimColumns?: boolean[];
  labelWidth: number;
  /** Panel inner content width (outer width − borders − padding). */
  inner: number;
  gap?: number;
  /** Hard cap on meter width so long bars stay elegant; defaults to half the inner width. */
  meterMax?: number;
  /** A dashed goal/threshold line drawn across every meter at `fraction` of the bar, with a label above. */
  reference?: { fraction: number; label: string };
}

/**
 * Returns the body lines (dim header, blank spacer, one line per row) or null
 * when there isn't room for a legible meter — the caller should then fall back
 * to a stacked list.
 */
export function meterTable(ctx: RenderCtx, spec: MeterTableSpec): string[] | null {
  const gapN = spec.gap ?? 2;
  const gap = ' '.repeat(gapN);
  const colCount = spec.headers.length;
  const colWidths = spec.headers.map((header, i) =>
    Math.max(ctx.visualWidth(header), ...spec.rows.map((row) => ctx.visualWidth(row.values[i] ?? ''))),
  );
  const rightFixed = colWidths.reduce((sum, w) => sum + w, 0) + gapN * Math.max(0, colCount - 1);
  const meterMax = spec.meterMax ?? Math.max(10, Math.min(24, Math.floor(spec.inner * 0.5)));
  const meterAvail = spec.inner - spec.labelWidth - gapN * 2 - rightFixed;
  if (meterAvail < 8) return null;
  const meterWidth = Math.min(meterAvail, meterMax);
  const spacer = ' '.repeat(spec.inner - spec.labelWidth - gapN - meterWidth - rightFixed);
  const dimCols = spec.dimColumns ?? spec.headers.map((_, i) => i > 0);

  const rightCells = (cells: string[], styled: boolean): string =>
    cells
      .map((cell, i) => {
        const padded = padStart(ctx, cell, colWidths[i] ?? 0);
        return styled && ctx.color && dimCols[i] ? dim(padded) : padded;
      })
      .join(gap);

  const headerLine =
    ' '.repeat(spec.labelWidth) + gap + ' '.repeat(meterWidth) + spacer + rightCells(spec.headers, false);
  const lines: string[] = [ctx.color ? dim(headerLine) : headerLine, ''];

  // Optional goal/threshold reference line: a dashed vertical drawn across every
  // meter at `fraction`, with a label placed above it (in the warn accent).
  let referenceAt: number | undefined;
  if (spec.reference && spec.reference.fraction >= 0) {
    referenceAt = Math.max(0, Math.min(meterWidth - 1, Math.round(spec.reference.fraction * meterWidth)));
    const meterStart = spec.labelWidth + gapN;
    const x = meterStart + referenceAt;
    const labelText = `${REFERENCE_GLYPH} ${spec.reference.label}`;
    const labelWidthVis = ctx.visualWidth(labelText);
    // Anchor the label to the marker, then keep it inside the panel.
    const start = Math.max(0, Math.min(spec.inner - labelWidthVis, x));
    const labelLine = ' '.repeat(start) + (ctx.color ? fg(THEME.warn, labelText) : labelText);
    lines.splice(1, 0, labelLine); // sits between the header and the blank spacer
  }

  for (const row of spec.rows) {
    const label = padEnd(ctx, colorLabel(ctx, ctx.truncate(row.label, spec.labelWidth), row.color), spec.labelWidth);
    const bars = meter(ctx, row.fraction, meterWidth, row.color, referenceAt);
    lines.push(`${label}${gap}${bars}${spacer}${rightCells(row.values, true)}`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Legend — a horizontal key of colored swatches + labels, wrapped to width.
// ---------------------------------------------------------------------------

export interface LegendItem {
  label: string;
  color: RGB;
}

export function legend(ctx: RenderCtx, items: LegendItem[], width: number): string[] {
  if (items.length === 0) return [];
  const parts = items.map((item) => `${swatch(ctx, item.color)} ${colorLabel(ctx, item.label, item.color)}`);
  const sep = '   ';
  const lines: string[] = [];
  let current = '';
  let currentWidth = 0;
  for (const part of parts) {
    const partWidth = ctx.visualWidth(part);
    const addWidth = current === '' ? partWidth : partWidth + sep.length;
    if (current !== '' && currentWidth + addWidth > width) {
      lines.push(current);
      current = part;
      currentWidth = partWidth;
    } else {
      current = current === '' ? part : current + sep + part;
      currentWidth += addWidth;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

// ---------------------------------------------------------------------------
// Panel — a rounded border with a colored title embedded in the top edge, an
// optional dim subtitle, and the body lines inset with one column of padding.
// Width is the OUTER width; body lines are padded/truncated to the inner width.
// ---------------------------------------------------------------------------

export interface PanelOptions {
  title?: string;
  subtitle?: string;
  /** Body lines (may contain ANSI). */
  body: string[];
  /** Outer width of the panel. */
  width: number;
  /** Accent color for the border + title. Defaults to the theme accent. */
  accent?: RGB;
  /** Footer line drawn just inside the bottom border (dim). */
  footer?: string;
}

const PAD = 1; // columns of padding inside the vertical borders

export function panel(ctx: RenderCtx, opts: PanelOptions): string[] {
  const accent = opts.accent ?? THEME.accent;
  const inner = Math.max(1, opts.width - 2 - PAD * 2);
  const horiz = (text: string) => (ctx.color ? fg(accent, text) : text);
  const chrome = (text: string) => (ctx.color ? dim(text) : text);

  const lines: string[] = [];

  // Top border with embedded title.
  if (opts.title) {
    const title = ctx.truncate(opts.title, Math.max(0, inner - 2));
    const styledTitle = ctx.color ? bold(fg(accent, title)) : title;
    const left = `${BOX.topLeft}${BOX.horizontal} `;
    const used = 2 + 1 + ctx.visualWidth(title) + 1; // corner+dash + space + title + trailing space
    const fillCount = Math.max(0, opts.width - used - 1); // -1 for right corner
    lines.push(`${horiz(left)}${styledTitle}${horiz(' ' + BOX.horizontal.repeat(fillCount) + BOX.topRight)}`);
  } else {
    lines.push(horiz(BOX.topLeft + BOX.horizontal.repeat(opts.width - 2) + BOX.topRight));
  }

  const bodyLine = (content: string) => {
    const padded = padEnd(ctx, content, inner);
    const clipped = ctx.visualWidth(padded) > inner ? ctx.truncate(padded, inner) : padded;
    return `${chrome(BOX.vertical)}${' '.repeat(PAD)}${clipped}${' '.repeat(PAD)}${chrome(BOX.vertical)}`;
  };

  // Subtitle (dim) + blank spacer.
  if (opts.subtitle) {
    const sub = ctx.truncate(opts.subtitle, inner);
    lines.push(bodyLine(ctx.color ? dim(sub) : sub));
    lines.push(bodyLine(''));
  }

  for (const line of opts.body) lines.push(bodyLine(line));

  if (opts.footer) {
    lines.push(bodyLine(''));
    const foot = ctx.truncate(opts.footer, inner);
    lines.push(bodyLine(ctx.color ? dim(foot) : foot));
  }

  // Bottom border.
  lines.push(horiz(BOX.bottomLeft + BOX.horizontal.repeat(opts.width - 2) + BOX.bottomRight));

  return lines;
}
