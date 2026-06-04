import { type RGB } from './theme.js';
export interface RenderCtx {
    /** Whether to emit ANSI color. */
    color: boolean;
    /** Display width of a string ignoring ANSI escapes (from index.ts). */
    visualWidth: (value: string) => number;
    /** Truncate to a display width, ANSI-aware (from index.ts). */
    truncate: (value: string, width: number) => string;
}
export declare function padEnd(ctx: RenderCtx, value: string, width: number): string;
export declare function padStart(ctx: RenderCtx, value: string, width: number): string;
export declare function colorLabel(ctx: RenderCtx, text: string, color: RGB): string;
/** A filled swatch glyph in the given color (●), or a mono bullet. */
export declare function swatch(ctx: RenderCtx, color: RGB): string;
export declare function meter(ctx: RenderCtx, fraction: number, cells: number, color: RGB): string;
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
