import { type RGB } from './theme.js';
export interface RenderCtx {
    /** Whether to emit ANSI color. */
    color: boolean;
    /** Display width of a string ignoring ANSI escapes (from index.ts). */
    visualWidth: (value: string) => number;
    /** Truncate to a display width, ANSI-aware (from index.ts). */
    truncate: (value: string, width: number) => string;
    /**
     * Whether each chart self-frames in its rounded panel box. Default (undefined
     * or true) draws the full panel. `false` makes {@link panel} emit UNPANELLED
     * bare bodies — no border, no title — so a host that draws its own chrome
     * (e.g. a themed "card" frame) wraps the body directly instead of boxing an
     * already-boxed chart (which would double-frame: a box inside a box).
     */
    frame?: boolean;
}
export declare function padEnd(ctx: RenderCtx, value: string, width: number): string;
export declare function padStart(ctx: RenderCtx, value: string, width: number): string;
export declare function colorLabel(ctx: RenderCtx, text: string, color: RGB): string;
/** A filled swatch glyph in the given color (●), or a mono bullet. */
export declare function swatch(ctx: RenderCtx, color: RGB): string;
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
export declare function deltaBadge(ctx: RenderCtx, change: number, opts?: DeltaOptions): string;
/**
 * A bare inline sparkline (no label / endpoints) for embedding in a tile or row.
 * Color mode tints each glyph along the ramp by its height; mono is plain
 * block glyphs. Returns '' when there is no finite data.
 */
export declare function inlineSparkline(ctx: RenderCtx, values: number[], color?: RGB): string;
export declare function meter(ctx: RenderCtx, fraction: number, cells: number, color: RGB, referenceAt?: number): string;
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
    reference?: {
        fraction: number;
        label: string;
    };
}
/**
 * Returns the body lines (dim header, blank spacer, one line per row) or null
 * when there isn't room for a legible meter — the caller should then fall back
 * to a stacked list.
 */
export declare function meterTable(ctx: RenderCtx, spec: MeterTableSpec): string[] | null;
export interface LegendItem {
    label: string;
    color: RGB;
}
export declare function legend(ctx: RenderCtx, items: LegendItem[], width: number): string[];
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
export declare function panel(ctx: RenderCtx, opts: PanelOptions): string[];
