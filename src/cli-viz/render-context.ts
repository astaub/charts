// Shared render context + display-width helpers.
//
// The chart renderers each used to carry their own copy of stripAnsi /
// visualWidth / truncate. This module is the one place those live so every kind
// frames text identically (and so the shared components in ./components.ts get a
// consistent, ANSI-aware width model). It depends only on ./theme (no chart
// code), so any renderer can import it without a cycle.

import { applyAppearance, applyTheme, resolveColor, type AppearanceMode, type ColorMode, type ThemeName } from './theme.js';
import type { RenderCtx } from './components.js';

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

/** Terminal display columns for a single code point (0 / 1 / 2). */
export function charDisplayWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code === 0) return 0;
  if (code < 32 || (code >= 0x7f && code < 0xa0)) return 0;
  if (code >= 0x300 && code <= 0x36f) return 0;
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2329 && code <= 0x232a) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  ) {
    return 2;
  }
  return 1;
}

/** Display width of a string, ignoring ANSI escapes. */
export function visualWidth(value: string): number {
  let width = 0;
  for (const char of stripAnsi(value)) width += charDisplayWidth(char);
  return width;
}

/** Longest prefix of `value` that fits within `width` display columns. */
export function takeDisplayWidth(value: string, width: number): string {
  let used = 0;
  let output = '';
  for (const char of value) {
    const charWidth = charDisplayWidth(char);
    if (used + charWidth > width) break;
    used += charWidth;
    output += char;
  }
  return output;
}

/**
 * Truncate to `width` display columns, appending `~` when clipped. Strips ANSI
 * and control characters (the panel/title/label sites pass plain text).
 */
export function truncateLine(value: string, width: number): string {
  const text = stripAnsi(value).replace(/\r?\n/g, ' ').replace(CONTROL_PATTERN, '');
  if (visualWidth(text) <= width) return text;
  if (width <= 1) return takeDisplayWidth(text, Math.max(0, width));
  return `${takeDisplayWidth(text, width - 1)}~`;
}

/** Collapse to a single transcript-safe line (no ANSI, control chars, or angle brackets). */
export function sanitizeText(value: string): string {
  return stripAnsi(value)
    .replace(/[<>]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(CONTROL_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface RenderContextOptions {
  color?: ColorMode;
  isTTY?: boolean;
  env?: Record<string, string | undefined>;
  /** Background appearance: 'light' | 'dark' | 'auto'. Default 'dark'. */
  appearance?: AppearanceMode;
  /** Palette theme. Default 'staub' (sunset-on-ocean); 'classic' = blue family. */
  theme?: ThemeName;
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
export function makeRenderCtx(options: RenderContextOptions = {}): RenderCtx {
  // Theme first (an unset theme resets to the brand default), then appearance —
  // applyAppearance reads the active theme to pick the palette pair.
  applyTheme(options.theme);
  applyAppearance({ appearance: options.appearance, env: options.env });
  return {
    color: resolveColor({ color: options.color, isTTY: options.isTTY, env: options.env }),
    visualWidth,
    truncate: truncateLine,
  };
}
