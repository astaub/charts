// Design-system primitives shared by every chart kind: a color/degrade layer,
// one canonical palette, and the Unicode glyph sets. Keeping these in one place
// is what makes the charts read as a single product instead of a pile of
// independently-styled plotters.
//
// Nothing here knows about charts — it only knows about color and glyphs.
// Components (border/title/legend/bar) build on top in ./components.ts.
// ---------------------------------------------------------------------------
// Color resolution — truecolor when the destination wants it, clean monochrome
// Unicode otherwise. NO_COLOR always wins (https://no-color.org).
// ---------------------------------------------------------------------------
export function resolveColor(ctx = {}) {
    const env = ctx.env ?? process.env;
    if (env.NO_COLOR !== undefined && env.NO_COLOR !== '')
        return false;
    if (ctx.color === 'never')
        return false;
    if (ctx.color === 'always')
        return true;
    if (ctx.color === 'auto')
        return ctx.isTTY ?? process.stdout?.isTTY === true;
    return false;
}
/**
 * Boundary color resolution for an executable (the CLI). Unlike the library
 * default (off unless asked), this honors the conventions a terminal user
 * expects: NO_COLOR off, FORCE_COLOR on, otherwise follow the TTY.
 */
export function resolveCliColorMode(ctx = {}) {
    const env = ctx.env ?? process.env;
    if (env.NO_COLOR !== undefined && env.NO_COLOR !== '')
        return 'never';
    const force = env.FORCE_COLOR;
    if (force !== undefined && force !== '' && force !== '0' && force !== 'false')
        return 'always';
    const isTTY = ctx.isTTY ?? process.stdout?.isTTY === true;
    return isTTY ? 'always' : 'never';
}
// ---------------------------------------------------------------------------
// Truecolor ANSI. We emit 24-bit sequences; terminals without truecolor still
// approximate, and the mono path skips color entirely.
// ---------------------------------------------------------------------------
const RESET = '[0m';
export function fg(color, text) {
    return `[38;2;${color.r};${color.g};${color.b}m${text}${RESET}`;
}
export function bg(color, text) {
    return `[48;2;${color.r};${color.g};${color.b}m${text}${RESET}`;
}
/** Foreground + background in one sequence — used for solid color cells. */
export function fgBg(fgColor, bgColor, text) {
    return `[38;2;${fgColor.r};${fgColor.g};${fgColor.b};48;2;${bgColor.r};${bgColor.g};${bgColor.b}m${text}${RESET}`;
}
export function bold(text) {
    return `[1m${text}${RESET}`;
}
export function dim(text) {
    return `[2m${text}${RESET}`;
}
// ---------------------------------------------------------------------------
// The canonical palette. One clean blue ramp drives every sequential chart so
// the whole system shares a visual signature. A small categorical set covers
// multi-series charts without leaving the family.
// ---------------------------------------------------------------------------
function rgb(r, g, b) {
    return { r, g, b };
}
function mix(a, b, t) {
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    return {
        r: clamp(a.r + (b.r - a.r) * t),
        g: clamp(a.g + (b.g - a.g) * t),
        b: clamp(a.b + (b.b - a.b) * t),
    };
}
export const THEME = {
    /** Primary accent — used for titles, the deepest ramp stop, key swatches. */
    accent: rgb(61, 110, 255), // #3d6eff
    /** Dim chrome: borders, tracks, secondary text. */
    muted: rgb(96, 105, 130), // #606982
    /** Faint track behind bars. */
    track: rgb(54, 60, 82), // #363c52
    /** Bright text on accent fills. */
    ink: rgb(232, 238, 255),
    /** Positive / negative semantic accents (reused across kinds). */
    positive: rgb(45, 198, 130), // #2dc682
    negative: rgb(240, 80, 110), // #f0506e
    warn: rgb(240, 168, 48), // #f0a830
};
// Sequential blue ramp: deep saturated → light. ramp(0) is the boldest.
const RAMP_STOPS = [
    rgb(29, 74, 255), // #1d4aff
    rgb(75, 124, 255), // #4b7cff
    rgb(125, 165, 255), // #7da5ff
    rgb(183, 204, 255), // #b7ccff
];
/** Sample the canonical ramp at t in [0,1] (0 = deepest, 1 = lightest). */
export function ramp(t) {
    const clamped = Math.max(0, Math.min(1, t));
    const scaled = clamped * (RAMP_STOPS.length - 1);
    const i = Math.min(RAMP_STOPS.length - 2, Math.floor(scaled));
    return mix(RAMP_STOPS[i], RAMP_STOPS[i + 1], scaled - i);
}
/**
 * Ramp shade for item `index` of `count`. Earlier items render deeper so a
 * descending bar chart or a draining funnel reads as a coherent gradient.
 */
export function rampShade(index, count) {
    if (count <= 1)
        return ramp(0.12);
    // Keep within [0.05, 0.78] so even the last item stays legible (not too pale).
    return ramp(0.05 + (index / (count - 1)) * 0.73);
}
// Coherent categorical hues for multi-series charts. Blue-led, evenly spread.
export const CATEGORICAL = [
    rgb(61, 110, 255), // blue
    rgb(25, 195, 178), // teal
    rgb(139, 92, 246), // violet
    rgb(240, 168, 48), // amber
    rgb(240, 80, 110), // rose
    rgb(56, 193, 114), // green
    rgb(96, 165, 250), // sky
    rgb(244, 114, 182), // pink
];
export function categorical(index) {
    return CATEGORICAL[((index % CATEGORICAL.length) + CATEGORICAL.length) % CATEGORICAL.length];
}
// ---------------------------------------------------------------------------
// Glyphs. Eighth blocks give sub-cell precision for horizontal bars; the box
// set draws panel chrome; shades cover heat/track fills.
// ---------------------------------------------------------------------------
/** Left-anchored eighth blocks, index 0..8 (0 = empty cell, 8 = full block). */
export const EIGHTHS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'];
export const FULL_BLOCK = '█';
/** Faint track glyph used behind unfilled bar space in mono / colored modes. */
export const TRACK_GLYPH = '░'; // ░
export const SHADES = [' ', '░', '▒', '▓', '█']; // ░▒▓█
export const BOX = {
    topLeft: '╭', // ╭
    topRight: '╮', // ╮
    bottomLeft: '╰', // ╰
    bottomRight: '╯', // ╯
    horizontal: '─', // ─
    vertical: '│', // │
    teeLeft: '├', // ├
    teeRight: '┤', // ┤
};
/**
 * Render a sub-cell-precise horizontal bar as a raw glyph string (no color):
 * `cells` columns wide, filled proportional to `fraction` in [0,1], with the
 * remainder drawn as faint track glyphs. Color is applied by the component
 * layer so a single glyph string can degrade cleanly to monochrome.
 */
export function barGlyphs(fraction, cells) {
    if (cells <= 0)
        return { filled: '', track: '' };
    const clamped = Math.max(0, Math.min(1, fraction));
    const totalEighths = Math.round(clamped * cells * 8);
    const fullCells = Math.floor(totalEighths / 8);
    const remainder = totalEighths - fullCells * 8;
    let filled = FULL_BLOCK.repeat(Math.min(cells, fullCells));
    let used = Math.min(cells, fullCells);
    if (remainder > 0 && used < cells) {
        filled += EIGHTHS[remainder];
        used += 1;
    }
    const track = TRACK_GLYPH.repeat(Math.max(0, cells - used));
    return { filled, track };
}
