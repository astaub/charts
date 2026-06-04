// Design-system primitives shared by every chart kind: a color/degrade layer,
// one canonical palette, and the Unicode glyph sets. Keeping these in one place
// is what makes the charts read as a single product instead of a pile of
// independently-styled plotters.
//
// Nothing here knows about charts — it only knows about color and glyphs.
// Components (border/title/legend/bar) build on top in ./components.ts.

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

// ---------------------------------------------------------------------------
// Color resolution — truecolor when the destination wants it, clean monochrome
// Unicode otherwise. NO_COLOR always wins (https://no-color.org).
// ---------------------------------------------------------------------------

export function resolveColor(ctx: ColorContext = {}): boolean {
  const env = ctx.env ?? process.env;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (ctx.color === 'never') return false;
  if (ctx.color === 'always') return true;
  if (ctx.color === 'auto') return ctx.isTTY ?? process.stdout?.isTTY === true;
  return false;
}

/**
 * Boundary color resolution for an executable (the CLI). Unlike the library
 * default (off unless asked), this honors the conventions a terminal user
 * expects: NO_COLOR off, FORCE_COLOR on, otherwise follow the TTY.
 */
export function resolveCliColorMode(ctx: ColorContext = {}): ColorMode {
  const env = ctx.env ?? process.env;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 'never';
  const force = env.FORCE_COLOR;
  if (force !== undefined && force !== '' && force !== '0' && force !== 'false') return 'always';
  const isTTY = ctx.isTTY ?? process.stdout?.isTTY === true;
  return isTTY ? 'always' : 'never';
}

// ---------------------------------------------------------------------------
// Truecolor ANSI. We emit 24-bit sequences; terminals without truecolor still
// approximate, and the mono path skips color entirely.
// ---------------------------------------------------------------------------

const RESET = '[0m';

export function fg(color: RGB, text: string): string {
  return `[38;2;${color.r};${color.g};${color.b}m${text}${RESET}`;
}

export function bg(color: RGB, text: string): string {
  return `[48;2;${color.r};${color.g};${color.b}m${text}${RESET}`;
}

/** Foreground + background in one sequence — used for solid color cells. */
export function fgBg(fgColor: RGB, bgColor: RGB, text: string): string {
  return `[38;2;${fgColor.r};${fgColor.g};${fgColor.b};48;2;${bgColor.r};${bgColor.g};${bgColor.b}m${text}${RESET}`;
}

export function bold(text: string): string {
  return `[1m${text}${RESET}`;
}

export function dim(text: string): string {
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

function rgb(r: number, g: number, b: number): RGB {
  return { r, g, b };
}

function mix(a: RGB, b: RGB, t: number): RGB {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return {
    r: clamp(a.r + (b.r - a.r) * t),
    g: clamp(a.g + (b.g - a.g) * t),
    b: clamp(a.b + (b.b - a.b) * t),
  };
}

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

// Tuned for DARK backgrounds (the original, unchanged values — no regression).
const DARK_PALETTE: Palette = {
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
const LIGHT_PALETTE: Palette = {
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

const PALETTES: Record<Appearance, Palette> = { dark: DARK_PALETTE, light: LIGHT_PALETTE };

// The active background appearance. Module-level on purpose: a render pass is
// synchronous, and every kind reads the active palette through THEME/ramp/etc.,
// so flipping this once at the render boundary adapts the whole system.
let activeAppearance: Appearance = 'dark';
let activePalette: Palette = DARK_PALETTE;

/** Switch the active palette. Called at the render boundary, not per kind. */
export function setAppearance(appearance: Appearance): void {
  activeAppearance = appearance;
  activePalette = PALETTES[appearance];
}

/** The currently-active background appearance. */
export function getAppearance(): Appearance {
  return activeAppearance;
}

/** The currently-active palette (the raw colors behind THEME/ramp/heat). */
export function activeThemePalette(): Palette {
  return activePalette;
}

// THEME is a live view onto the active palette: `THEME.accent` always reflects
// whichever background is active. (Getters, not a snapshot, so a single import
// adapts when appearance flips — no per-kind rewrite.)
export const THEME: {
  readonly accent: RGB;
  readonly muted: RGB;
  readonly track: RGB;
  readonly ink: RGB;
  readonly text: RGB;
  readonly positive: RGB;
  readonly negative: RGB;
  readonly warn: RGB;
} = {
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
export function ramp(t: number): RGB {
  const stops = activePalette.rampStops;
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  return mix(stops[i] as RGB, stops[i + 1] as RGB, scaled - i);
}

/**
 * Ramp shade for item `index` of `count`. Earlier items render deeper so a
 * descending bar chart or a draining funnel reads as a coherent gradient.
 */
export function rampShade(index: number, count: number): RGB {
  if (count <= 1) return ramp(0.12);
  // Keep within [0.05, 0.78] so even the last item stays legible (not too pale).
  return ramp(0.05 + (index / (count - 1)) * 0.73);
}

/** Sample the active heat ramp at t in [0,1] (0 = cold/low, 1 = hot/high). */
export function heat(t: number): RGB {
  const stops = activePalette.heatStops;
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  return mix(stops[i] as RGB, stops[i + 1] as RGB, scaled - i);
}

/**
 * The dark categorical hues, exported for back-compat. Prefer `categorical()`,
 * which is appearance-aware (it reads the active palette's set).
 */
export const CATEGORICAL: RGB[] = DARK_PALETTE.categorical;

export function categorical(index: number): RGB {
  const set = activePalette.categorical;
  return set[((index % set.length) + set.length) % set.length] as RGB;
}

// ---------------------------------------------------------------------------
// Appearance detection. OSC-11 (query the terminal's background) is impractical
// when output is piped, so the practical detectors are an explicit flag/option
// and the COLORFGBG env var (terminals that set it report "fg;bg", sometimes
// "fg;default;bg" — a high bg index, e.g. 7 or 15, means a light background).
// Unknown → dark, preserving the original behavior (no regression).
// ---------------------------------------------------------------------------

export type AppearanceMode = 'light' | 'dark' | 'auto';

export interface AppearanceContext {
  /** Explicit override. 'auto' detects; undefined defaults to 'dark'. */
  appearance?: AppearanceMode;
  /** Environment bag (defaults to process.env) — read for COLORFGBG / NO_COLOR. */
  env?: Record<string, string | undefined>;
}

/** Parse COLORFGBG into a light/dark guess, or null when it says nothing. */
function appearanceFromColorFgBg(value: string | undefined): Appearance | null {
  if (value === undefined || value === '') return null;
  const parts = value.split(';');
  const bgField = parts[parts.length - 1]?.trim();
  if (bgField === undefined) return null;
  const bg = Number.parseInt(bgField, 10);
  if (!Number.isFinite(bg)) return null; // e.g. "default" — say nothing
  // The white slots (7 = white, 15 = bright white) are the light backgrounds;
  // the bright range (9–14) is also high/light. 0–6 and 8 (gray) read as dark.
  return bg === 7 || bg >= 9 ? 'light' : 'dark';
}

/**
 * Resolve the effective appearance. An explicit 'light'/'dark' wins. 'auto'
 * detects from COLORFGBG (and respects NO_COLOR, under which color is off so
 * the choice is moot). Undefined → 'dark', preserving the original behavior.
 */
export function resolveAppearance(ctx: AppearanceContext = {}): Appearance {
  if (ctx.appearance === 'light') return 'light';
  if (ctx.appearance === 'dark') return 'dark';
  if (ctx.appearance === undefined) return 'dark';
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
export function applyAppearance(ctx: AppearanceContext = {}): Appearance {
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
export function mutedText(text: string): string {
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
export function bodyText(text: string): string {
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
export function barGlyphs(fraction: number, cells: number): { filled: string; track: string } {
  if (cells <= 0) return { filled: '', track: '' };
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
