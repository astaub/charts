import { type AppearanceMode, type ColorMode, type ThemeName } from './theme.js';
import type { RenderCtx } from './components.js';
export declare function stripAnsi(value: string): string;
/** Terminal display columns for a single code point (0 / 1 / 2). */
export declare function charDisplayWidth(char: string): number;
/** Display width of a string, ignoring ANSI escapes. */
export declare function visualWidth(value: string): number;
/** Longest prefix of `value` that fits within `width` display columns. */
export declare function takeDisplayWidth(value: string, width: number): string;
/**
 * Truncate to `width` display columns, appending `~` when clipped. Strips ANSI
 * and control characters (the panel/title/label sites pass plain text).
 */
export declare function truncateLine(value: string, width: number): string;
/** Collapse to a single transcript-safe line (no ANSI, control chars, or angle brackets). */
export declare function sanitizeText(value: string): string;
export interface RenderContextOptions {
    color?: ColorMode;
    isTTY?: boolean;
    env?: Record<string, string | undefined>;
    /** Background appearance: 'light' | 'dark' | 'auto'. Default 'dark'. */
    appearance?: AppearanceMode;
    /** Palette (theme) name. Default 'staub' (sunset-on-ocean); 'classic' = blue family. */
    palette?: ThemeName;
}
/**
 * Bundle the color decision and the (single) width helpers into the context the
 * shared components draw with. Every paneled chart builds one of these so
 * chrome, color, and width math stay consistent across kinds.
 *
 * This is also the single place appearance is activated: resolving it here (and
 * flipping the active palette) means every kind that builds a render context
 * adapts to a light/dark background with no per-kind change.
 */
export declare function makeRenderCtx(options?: RenderContextOptions): RenderCtx;
