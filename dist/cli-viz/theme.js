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
//
// There are two tuned palettes — one for DARK terminal backgrounds and one for
// LIGHT — built from the same blue family so the product reads the same either
// way. The light palette is NOT a naive inversion: ink goes dark, the blue ramp
// is deepened so even its pale end stays legible on white, the heat ramp's
// lowest cell sits ≈ the light background (so a cold cell reads as empty, not
// as a filled dark block), the track is a faint pale gray, and the semantic
// green/red/amber are deepened so they pop on white.
//
// Exactly one palette is "active" at a time (a module-level switch flipped by
// setAppearance / applyAppearance). THEME, ramp, heat, rampShade and
// categorical all read the active palette, so every chart kind adapts with zero
// per-kind changes the moment appearance is resolved at the render boundary.
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
// ── classic theme ──────────────────────────────────────────────────────────
// The original blue-family palettes, preserved verbatim as the `classic` theme
// so the prior look is never lost — `staub` is the default, classic is one
// `--theme classic` (or setTheme('classic')) away.
// Tuned for DARK backgrounds (the original, unchanged values — no regression).
const CLASSIC_DARK_PALETTE = {
    accent: rgb(61, 110, 255), // #3d6eff
    muted: rgb(96, 105, 130), // #606982
    track: rgb(54, 60, 82), // #363c52
    ink: rgb(232, 238, 255),
    text: rgb(232, 238, 255), // unused on dark (bodyText leaves text uncolored)
    positive: rgb(45, 198, 130), // #2dc682
    negative: rgb(240, 80, 110), // #f0506e
    warn: rgb(240, 168, 48), // #f0a830
    // Deep saturated → light. On dark, the pale end still reads against the bg.
    rampStops: [
        rgb(29, 74, 255), // #1d4aff
        rgb(75, 124, 255), // #4b7cff
        rgb(125, 165, 255), // #7da5ff
        rgb(183, 204, 255), // #b7ccff
    ],
    // Cold/dark (≈ dark bg) → hot/bright blue. White ink reads on every cell.
    heatStops: [
        rgb(32, 38, 58), // #20263a near-background (lowest)
        rgb(38, 64, 140), // #26408c
        rgb(56, 104, 224), // #3868e0
        rgb(96, 150, 255), // #6096ff (hottest)
    ],
    categorical: [
        rgb(61, 110, 255), // blue
        rgb(25, 195, 178), // teal
        rgb(139, 92, 246), // violet
        rgb(240, 168, 48), // amber
        rgb(240, 80, 110), // rose
        rgb(56, 193, 114), // green
        rgb(96, 165, 250), // sky
        rgb(244, 114, 182), // pink
    ],
};
// Tuned for LIGHT backgrounds. Same blue family, re-balanced for white:
//  · accent/ink go deep so titles, borders and on-fill text read on white;
//  · the blue ramp is deepened (its palest stop is still a clear mid-blue, not
//    a near-white wash) so descending bars stay visible to the last row;
//  · the heat ramp's lowest cell ≈ the light background (cold = empty, not a
//    filled dark block), rising to a vivid mid-blue — dark ink reads across it;
//  · the track is a faint pale gray that reads as a subtle channel on white;
//  · green/red/amber are deepened so the semantic accents pop on white.
const CLASSIC_LIGHT_PALETTE = {
    accent: rgb(40, 82, 224), // #2852e0 — deep royal blue, strong on white
    muted: rgb(74, 82, 104), // #4a5268 — dark slate, real contrast on white
    track: rgb(212, 219, 233), // #d4dbe9 — faint pale channel on white
    ink: rgb(20, 35, 63), // #14233f — deep navy text for on-fill labels
    text: rgb(31, 42, 68), // #1f2a44 — primary body text, strong on white
    positive: rgb(18, 138, 82), // #128a52 — deep green
    negative: rgb(208, 42, 74), // #d02a4a — deep red
    warn: rgb(176, 112, 8), // #b07008 — deep amber
    // Deep → mid. Even the palest stop stays a clear blue against white.
    rampStops: [
        rgb(27, 63, 214), // #1b3fd6 (deepest)
        rgb(47, 95, 232), // #2f5fe8
        rgb(79, 124, 240), // #4f7cf0
        rgb(111, 151, 243), // #6f97f3 (palest, still visible on white)
    ],
    // Faint-but-visible blue (a low cell still reads as a tinted cell on white,
    // not a blank) → vivid mid-blue. Capped short of navy so the deep-navy ink
    // reads on the hottest cell; jagged/empty cells get no fill (a muted dot), so
    // "low" (faint blue block) stays distinct from "absent" (no block).
    heatStops: [
        rgb(218, 230, 251), // #dae6fb faint visible tint (lowest)
        rgb(168, 200, 247), // #a8c8f7
        rgb(108, 158, 242), // #6c9ef2
        rgb(57, 116, 236), // #3974ec (hottest)
    ],
    categorical: [
        rgb(40, 82, 224), // blue
        rgb(15, 148, 136), // teal
        rgb(124, 58, 237), // violet
        rgb(181, 118, 10), // amber
        rgb(208, 42, 74), // rose
        rgb(18, 138, 82), // green
        rgb(45, 116, 214), // sky
        rgb(198, 59, 134), // pink
    ],
};
// ── staub theme (default) ────────────────────────────────────────────────────
// Staub's brand: SUNSET ON THE OCEAN. Warm coral / sunset tones meeting a deep
// ocean blue at the horizon. The sequential ramp is that horizon literalized —
// coral → sunset gold → teal → ocean blue — so every bar, line, and funnel reads
// as one Staub gradient. Semantic accents (positive/negative) and the faint
// track channel are kept neutral and shared with `classic` (a sea-green and a
// sunset-rose already sit inside the palette), so good/bad never gets lost in
// the brand hues.
//
// Two tunings, same family: DARK is sunset over a night ocean; LIGHT is sunrise
// over a paler sea, deepened so coral/ocean read on white (the #13 light-bg
// lesson) — accent/ink go deep, the ramp is deepened, the heat ramp's lowest
// cell sits ≈ the white background (a cold cell reads as empty, not a dark block).
// Sunset over a night ocean.
const STAUB_DARK_PALETTE = {
    accent: rgb(255, 111, 97), // #ff6f61 — Staub coral, the brand signature
    muted: rgb(120, 134, 158), // #78869e — dusk slate (ocean at twilight)
    track: rgb(54, 60, 82), // #363c52 — deep channel (shared w/ classic; reads as empty)
    ink: rgb(255, 244, 238), // #fff4ee — warm white, on coral/heat fills
    text: rgb(255, 244, 238), // unused on dark (bodyText leaves text uncolored)
    positive: rgb(45, 198, 130), // #2dc682 — sea green
    negative: rgb(240, 80, 110), // #f0506e — sunset rose
    warn: rgb(245, 176, 66), // #f5b042 — sunset gold
    // The horizon: coral → sunset gold → teal → ocean blue. ramp(0) is coral.
    rampStops: [
        rgb(255, 111, 97), // #ff6f61 coral (deepest/boldest)
        rgb(255, 150, 99), // #ff9663 sunset orange
        rgb(247, 178, 103), // #f7b267 horizon gold
        rgb(91, 163, 184), // #5ba3b8 teal sea
        rgb(47, 111, 166), // #2f6fa6 ocean blue
    ],
    // Cold deep-ocean (≈ dark bg) → hot coral. Warm-white ink reads on every cell.
    heatStops: [
        rgb(30, 42, 60), // #1e2a3c near-background deep ocean (lowest)
        rgb(38, 90, 120), // #265a78 ocean blue
        rgb(217, 138, 94), // #d98a5e warm sand
        rgb(255, 122, 89), // #ff7a59 hot coral (hottest)
    ],
    // Coral-led so a multi-series chart is unmistakably Staub, spread across the
    // full sunset-to-ocean arc.
    categorical: [
        rgb(255, 111, 97), // coral
        rgb(255, 158, 94), // sunset orange
        rgb(245, 196, 94), // sun gold
        rgb(79, 176, 160), // sea teal
        rgb(63, 143, 191), // ocean blue
        rgb(138, 111, 174), // dusk violet
        rgb(240, 143, 176), // sunset pink
        rgb(46, 116, 181), // deep blue
    ],
};
// Sunrise over a paler sea — deepened so coral/ocean read on white.
const STAUB_LIGHT_PALETTE = {
    accent: rgb(214, 77, 60), // #d64d3c — deep coral, strong on white
    muted: rgb(92, 84, 94), // #5c545e — warm slate, real contrast on white
    track: rgb(212, 219, 233), // #d4dbe9 — faint pale channel (shared w/ classic)
    ink: rgb(38, 28, 30), // #261c1e — deep warm near-black for on-fill labels
    text: rgb(40, 32, 38), // #282026 — primary body text, strong on white
    positive: rgb(18, 138, 82), // #128a52 — deep sea green
    negative: rgb(208, 42, 74), // #d02a4a — deep sunset red
    warn: rgb(176, 108, 16), // #b06c10 — deep amber
    // Same horizon, deepened: even the ocean end stays a clear blue on white.
    rampStops: [
        rgb(201, 69, 58), // #c9453a deep coral (deepest)
        rgb(224, 116, 74), // #e0744a coral-orange
        rgb(199, 138, 40), // #c78a28 deep gold
        rgb(63, 138, 168), // #3f8aa8 teal-ocean
        rgb(42, 106, 158), // #2a6a9e ocean blue (still clear on white)
    ],
    // Faint warm tint (a low cell reads as tinted, not blank) → hot coral; deep
    // warm ink reads on the hottest cell.
    heatStops: [
        rgb(235, 225, 220), // #ebe1dc faint warm tint (lowest)
        rgb(243, 195, 168), // #f3c3a8 warm sand
        rgb(232, 149, 106), // #e8956a coral-orange
        rgb(214, 90, 60), // #d65a3c hot coral (hottest)
    ],
    categorical: [
        rgb(214, 77, 60), // coral
        rgb(224, 116, 74), // sunset orange
        rgb(199, 138, 30), // sun gold
        rgb(31, 138, 134), // sea teal
        rgb(42, 106, 158), // ocean blue
        rgb(111, 79, 150), // dusk violet
        rgb(200, 90, 134), // sunset pink
        rgb(31, 95, 158), // deep blue
    ],
};
/** The name used when no theme is selected (and the fallback for unknown names). */
export const DEFAULT_THEME = 'staub';
const THEMES = {
    staub: { dark: STAUB_DARK_PALETTE, light: STAUB_LIGHT_PALETTE },
    classic: { dark: CLASSIC_DARK_PALETTE, light: CLASSIC_LIGHT_PALETTE },
};
// The active theme + background appearance. Module-level on purpose: a render
// pass is synchronous, and every kind reads the active palette through
// THEME/ramp/etc., so flipping these once at the render boundary adapts the
// whole system. The default theme is `staub`, so an unconfigured render is
// already on-brand.
let activeTheme = DEFAULT_THEME;
let activeAppearance = 'dark';
let activePalette = THEMES[DEFAULT_THEME].dark;
/** Resolve the palette pair for a theme name, falling back to the default. */
function themePair(name) {
    return THEMES[name] ?? THEMES[DEFAULT_THEME];
}
/** Switch the active palette. Called at the render boundary, not per kind. */
export function setAppearance(appearance) {
    activeAppearance = appearance;
    activePalette = themePair(activeTheme)[appearance];
}
/** Switch the active theme, keeping the current appearance. */
export function setTheme(name) {
    activeTheme = THEMES[name] ? name : DEFAULT_THEME;
    activePalette = themePair(activeTheme)[activeAppearance];
}
/** The currently-active theme name. */
export function getTheme() {
    return activeTheme;
}
/** All registered theme names (built-ins + any registerTheme'd). */
export function listThemes() {
    return Object.keys(THEMES);
}
/** Resolve a theme name to a known one, falling back to the default. */
export function resolveTheme(name) {
    return name && THEMES[name] ? name : DEFAULT_THEME;
}
/**
 * Resolve a theme name (default `staub` when unset/unknown) and make it active.
 * Mirrors applyAppearance: called once at the render boundary so an unset theme
 * resets to the brand default and never leaks across renders.
 */
export function applyTheme(name) {
    setTheme(resolveTheme(name));
    return activeTheme;
}
/**
 * Register (or override) a named theme with its own {dark, light} palette pair.
 * The honest "palettes are overridable" affordance — `staub` is just the default.
 */
export function registerTheme(name, palettes) {
    THEMES[name] = palettes;
}
/** The currently-active background appearance. */
export function getAppearance() {
    return activeAppearance;
}
/** The currently-active palette (the raw colors behind THEME/ramp/heat). */
export function activeThemePalette() {
    return activePalette;
}
// THEME is a live view onto the active palette: `THEME.accent` always reflects
// whichever background is active. (Getters, not a snapshot, so a single import
// adapts when appearance flips — no per-kind rewrite.)
export const THEME = {
    get accent() {
        return activePalette.accent;
    },
    get muted() {
        return activePalette.muted;
    },
    get track() {
        return activePalette.track;
    },
    get ink() {
        return activePalette.ink;
    },
    get text() {
        return activePalette.text;
    },
    get positive() {
        return activePalette.positive;
    },
    get negative() {
        return activePalette.negative;
    },
    get warn() {
        return activePalette.warn;
    },
};
/** Sample the active blue ramp at t in [0,1] (0 = deepest, 1 = lightest). */
export function ramp(t) {
    const stops = activePalette.rampStops;
    const clamped = Math.max(0, Math.min(1, t));
    const scaled = clamped * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(scaled));
    return mix(stops[i], stops[i + 1], scaled - i);
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
/** Sample the active heat ramp at t in [0,1] (0 = cold/low, 1 = hot/high). */
export function heat(t) {
    const stops = activePalette.heatStops;
    const clamped = Math.max(0, Math.min(1, t));
    const scaled = clamped * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(scaled));
    return mix(stops[i], stops[i + 1], scaled - i);
}
/**
 * The default theme's dark categorical hues, exported for back-compat. Prefer
 * `categorical()`, which is theme- and appearance-aware (it reads the active
 * palette's set).
 */
export const CATEGORICAL = THEMES[DEFAULT_THEME].dark.categorical;
export function categorical(index) {
    const set = activePalette.categorical;
    return set[((index % set.length) + set.length) % set.length];
}
/** Parse COLORFGBG into a light/dark guess, or null when it says nothing. */
function appearanceFromColorFgBg(value) {
    if (value === undefined || value === '')
        return null;
    const parts = value.split(';');
    const bgField = parts[parts.length - 1]?.trim();
    if (bgField === undefined)
        return null;
    const bg = Number.parseInt(bgField, 10);
    if (!Number.isFinite(bg))
        return null; // e.g. "default" — say nothing
    // The white slots (7 = white, 15 = bright white) are the light backgrounds;
    // the bright range (9–14) is also high/light. 0–6 and 8 (gray) read as dark.
    return bg === 7 || bg >= 9 ? 'light' : 'dark';
}
/**
 * Resolve the effective appearance. An explicit 'light'/'dark' wins. 'auto'
 * detects from COLORFGBG (and respects NO_COLOR, under which color is off so
 * the choice is moot). Undefined → 'dark', preserving the original behavior.
 */
export function resolveAppearance(ctx = {}) {
    if (ctx.appearance === 'light')
        return 'light';
    if (ctx.appearance === 'dark')
        return 'dark';
    if (ctx.appearance === undefined)
        return 'dark';
    // 'auto' — detect from the environment, defaulting to dark when unknown.
    const env = ctx.env ?? process.env;
    return appearanceFromColorFgBg(env.COLORFGBG) ?? 'dark';
}
/**
 * Resolve appearance from a render option bag and make it active. Called once
 * at the render boundary (the shared render-context builders) so every kind
 * draws against the right palette without any per-kind change. Returns the
 * resolved appearance. Always sets the active palette — even for the default
 * 'dark' — so state never leaks between renders with different appearances.
 */
export function applyAppearance(ctx = {}) {
    const resolved = resolveAppearance(ctx);
    setAppearance(resolved);
    return resolved;
}
/**
 * Secondary / "muted" text (headers, captions, footers, totals, chrome). The
 * system historically used ANSI dim (code 2) over the terminal's default
 * foreground — which on a DARK terminal (light default fg) reads as a tasteful
 * gray. On a LIGHT terminal the default fg is dark, so dim *lightens* it into a
 * washed-out near-invisible gray. So: dark keeps the original dim (byte-for-byte
 * unchanged); light uses an explicit dark-slate muted color with real contrast
 * on white. Callers gate on `ctx.color` exactly as they did with `dim`.
 */
export function mutedText(text) {
    return activeAppearance === 'light' ? fg(activePalette.muted, text) : dim(text);
}
/**
 * Primary body text (chart values, axis numbers, row labels that aren't already
 * tinted to a series). On a DARK terminal this is left untouched so it inherits
 * the terminal's light default foreground (byte-for-byte unchanged). On LIGHT
 * it is colored an explicit deep navy — a light terminal's default fg is dark,
 * but ANSI can't set the *default*, and tools like `freeze` default to a light
 * foreground, so primary text must carry its own color to read on white.
 */
export function bodyText(text) {
    return activeAppearance === 'light' ? fg(activePalette.text, text) : text;
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
