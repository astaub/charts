export type ColorMode = 'never' | 'auto' | 'always';
export interface ColorContext {
    /** Explicit override. 'auto' defers to isTTY; default is 'never' for libraries. */
    color?: ColorMode;
    /** Whether the destination is an interactive terminal. */
    isTTY?: boolean;
    /** Environment bag (defaults to process.env) — read for NO_COLOR / FORCE_COLOR. */
    env?: Record<string, string | undefined>;
}
export interface RGB {
    r: number;
    g: number;
    b: number;
}
export declare function resolveColor(ctx?: ColorContext): boolean;
/**
 * Boundary color resolution for an executable (the CLI). Unlike the library
 * default (off unless asked), this honors the conventions a terminal user
 * expects: NO_COLOR off, FORCE_COLOR on, otherwise follow the TTY.
 */
export declare function resolveCliColorMode(ctx?: ColorContext): ColorMode;
export declare function fg(color: RGB, text: string): string;
export declare function bg(color: RGB, text: string): string;
/** Foreground + background in one sequence — used for solid color cells. */
export declare function fgBg(fgColor: RGB, bgColor: RGB, text: string): string;
export declare function bold(text: string): string;
export declare function dim(text: string): string;
export declare const THEME: {
    /** Primary accent — used for titles, the deepest ramp stop, key swatches. */
    accent: RGB;
    /** Dim chrome: borders, tracks, secondary text. */
    muted: RGB;
    /** Faint track behind bars. */
    track: RGB;
    /** Bright text on accent fills. */
    ink: RGB;
    /** Positive / negative semantic accents (reused across kinds). */
    positive: RGB;
    negative: RGB;
    warn: RGB;
};
/** Sample the canonical ramp at t in [0,1] (0 = deepest, 1 = lightest). */
export declare function ramp(t: number): RGB;
/**
 * Ramp shade for item `index` of `count`. Earlier items render deeper so a
 * descending bar chart or a draining funnel reads as a coherent gradient.
 */
export declare function rampShade(index: number, count: number): RGB;
/** Sample the heat ramp at t in [0,1] (0 = cold/dark, 1 = hot/bright). */
export declare function heat(t: number): RGB;
export declare const CATEGORICAL: RGB[];
export declare function categorical(index: number): RGB;
/** Left-anchored eighth blocks, index 0..8 (0 = empty cell, 8 = full block). */
export declare const EIGHTHS: string[];
export declare const FULL_BLOCK = "\u2588";
/** Faint track glyph used behind unfilled bar space in mono / colored modes. */
export declare const TRACK_GLYPH = "\u2591";
export declare const SHADES: string[];
export declare const BOX: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    horizontal: string;
    vertical: string;
    teeLeft: string;
    teeRight: string;
};
/**
 * Render a sub-cell-precise horizontal bar as a raw glyph string (no color):
 * `cells` columns wide, filled proportional to `fraction` in [0,1], with the
 * remainder drawn as faint track glyphs. Color is applied by the component
 * layer so a single glyph string can degrade cleanly to monochrome.
 */
export declare function barGlyphs(fraction: number, cells: number): {
    filled: string;
    track: string;
};
