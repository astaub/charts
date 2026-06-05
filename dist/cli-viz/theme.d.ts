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
export type Appearance = 'light' | 'dark';
/** The semantic + sequential colors that define one background's look. */
export interface Palette {
    /** Primary accent — titles, the deepest ramp stop, key swatches, borders. */
    accent: RGB;
    /** Dim chrome: borders, tracks, secondary text. */
    muted: RGB;
    /** Faint track behind bars (a solid block in this color reads as empty). */
    track: RGB;
    /** Text drawn on top of accent / heat fills. */
    ink: RGB;
    /** Primary body text. On dark this is left to the terminal default (light);
     *  on light it must be set explicitly so numbers/labels read on white. */
    text: RGB;
    /** Positive / negative / warning semantic accents (reused across kinds). */
    positive: RGB;
    negative: RGB;
    warn: RGB;
    /** Sequential blue ramp, deep → pale. ramp(0) is the boldest. */
    rampStops: RGB[];
    /** Sequential heat ramp, cold/low → hot/high (lowest ≈ the background). */
    heatStops: RGB[];
    /** Categorical hues for multi-series charts. Blue-led, evenly spread. */
    categorical: RGB[];
}
export type BuiltinTheme = 'staub' | 'classic';
export type ThemeName = BuiltinTheme | (string & {});
/** The name used when no theme is selected (and the fallback for unknown names). */
export declare const DEFAULT_THEME: BuiltinTheme;
/** Switch the active palette. Called at the render boundary, not per kind. */
export declare function setAppearance(appearance: Appearance): void;
/** Switch the active theme, keeping the current appearance. */
export declare function setTheme(name: ThemeName): void;
/** The currently-active theme name. */
export declare function getTheme(): ThemeName;
/** All registered theme names (built-ins + any registerTheme'd). */
export declare function listThemes(): ThemeName[];
/** Resolve a theme name to a known one, falling back to the default. */
export declare function resolveTheme(name?: ThemeName): ThemeName;
/**
 * Resolve a theme name (default `staub` when unset/unknown) and make it active.
 * Mirrors applyAppearance: called once at the render boundary so an unset theme
 * resets to the brand default and never leaks across renders.
 */
export declare function applyTheme(name?: ThemeName): ThemeName;
/**
 * Register (or override) a named theme with its own {dark, light} palette pair.
 * The honest "palettes are overridable" affordance — `staub` is just the default.
 */
export declare function registerTheme(name: string, palettes: Record<Appearance, Palette>): void;
/** The currently-active background appearance. */
export declare function getAppearance(): Appearance;
/** The currently-active palette (the raw colors behind THEME/ramp/heat). */
export declare function activeThemePalette(): Palette;
export declare const THEME: {
    readonly accent: RGB;
    readonly muted: RGB;
    readonly track: RGB;
    readonly ink: RGB;
    readonly text: RGB;
    readonly positive: RGB;
    readonly negative: RGB;
    readonly warn: RGB;
};
/** Sample the active blue ramp at t in [0,1] (0 = deepest, 1 = lightest). */
export declare function ramp(t: number): RGB;
/**
 * Ramp shade for item `index` of `count`. Earlier items render deeper so a
 * descending bar chart or a draining funnel reads as a coherent gradient.
 */
export declare function rampShade(index: number, count: number): RGB;
/** Sample the active heat ramp at t in [0,1] (0 = cold/low, 1 = hot/high). */
export declare function heat(t: number): RGB;
/**
 * The default theme's dark categorical hues, exported for back-compat. Prefer
 * `categorical()`, which is theme- and appearance-aware (it reads the active
 * palette's set).
 */
export declare const CATEGORICAL: RGB[];
export declare function categorical(index: number): RGB;
export type AppearanceMode = 'light' | 'dark' | 'auto';
export interface AppearanceContext {
    /** Explicit override. 'auto' detects; undefined defaults to 'dark'. */
    appearance?: AppearanceMode;
    /** Environment bag (defaults to process.env) — read for COLORFGBG / NO_COLOR. */
    env?: Record<string, string | undefined>;
}
/**
 * Resolve the effective appearance. An explicit 'light'/'dark' wins. 'auto'
 * detects from COLORFGBG (and respects NO_COLOR, under which color is off so
 * the choice is moot). Undefined → 'dark', preserving the original behavior.
 */
export declare function resolveAppearance(ctx?: AppearanceContext): Appearance;
/**
 * Resolve appearance from a render option bag and make it active. Called once
 * at the render boundary (the shared render-context builders) so every kind
 * draws against the right palette without any per-kind change. Returns the
 * resolved appearance. Always sets the active palette — even for the default
 * 'dark' — so state never leaks between renders with different appearances.
 */
export declare function applyAppearance(ctx?: AppearanceContext): Appearance;
/**
 * Secondary / "muted" text (headers, captions, footers, totals, chrome). The
 * system historically used ANSI dim (code 2) over the terminal's default
 * foreground — which on a DARK terminal (light default fg) reads as a tasteful
 * gray. On a LIGHT terminal the default fg is dark, so dim *lightens* it into a
 * washed-out near-invisible gray. So: dark keeps the original dim (byte-for-byte
 * unchanged); light uses an explicit dark-slate muted color with real contrast
 * on white. Callers gate on `ctx.color` exactly as they did with `dim`.
 */
export declare function mutedText(text: string): string;
/**
 * Primary body text (chart values, axis numbers, row labels that aren't already
 * tinted to a series). On a DARK terminal this is left untouched so it inherits
 * the terminal's light default foreground (byte-for-byte unchanged). On LIGHT
 * it is colored an explicit deep navy — a light terminal's default fg is dark,
 * but ANSI can't set the *default*, and tools like `freeze` default to a light
 * foreground, so primary text must carry its own color to read on white.
 */
export declare function bodyText(text: string): string;
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
