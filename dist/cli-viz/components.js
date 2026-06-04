// Shared visual components — the chrome every chart kind draws from so the
// whole system reads as one product: a bordered panel with a colored title and
// optional subtitle, color-coded legends and labels, and a sub-cell-precise
// meter (bar) with a faint track. Each component degrades to clean monochrome
// Unicode when color is off.
//
// These build on the pure primitives in ./theme.ts and the width-aware string
// helpers passed in from index.ts (so there is exactly one display-width
// implementation in the codebase).
import { BOX, FULL_BLOCK, THEME, bold, dim, fg, barGlyphs, } from './theme.js';
// ---------------------------------------------------------------------------
// Low-level: pad a (possibly colored) cell to a display width.
// ---------------------------------------------------------------------------
export function padEnd(ctx, value, width) {
    const w = ctx.visualWidth(value);
    if (w >= width)
        return value;
    return value + ' '.repeat(width - w);
}
export function padStart(ctx, value, width) {
    const w = ctx.visualWidth(value);
    if (w >= width)
        return value;
    return ' '.repeat(width - w) + value;
}
// ---------------------------------------------------------------------------
// Color-coded label — a label tinted to match its series/segment swatch.
// ---------------------------------------------------------------------------
export function colorLabel(ctx, text, color) {
    return ctx.color ? fg(color, text) : text;
}
/** A filled swatch glyph in the given color (●), or a mono bullet. */
export function swatch(ctx, color) {
    return ctx.color ? fg(color, '●') : '•'; // ● / •
}
// ---------------------------------------------------------------------------
// Meter — a sub-cell-precise horizontal bar with a faint track, colored fill.
// ---------------------------------------------------------------------------
export function meter(ctx, fraction, cells, color) {
    const { filled, track } = barGlyphs(fraction, cells);
    // Mono keeps the ░ track so the channel reads without color. In color mode a
    // smooth dark full-block channel looks far cleaner than the dotted shade.
    if (!ctx.color)
        return filled + track;
    const trackCells = [...track].length;
    const filledPart = filled.length > 0 ? fg(color, filled) : '';
    const trackPart = trackCells > 0 ? fg(THEME.track, FULL_BLOCK.repeat(trackCells)) : '';
    return filledPart + trackPart;
}
/**
 * Returns the body lines (dim header, blank spacer, one line per row) or null
 * when there isn't room for a legible meter — the caller should then fall back
 * to a stacked list.
 */
export function meterTable(ctx, spec) {
    const gapN = spec.gap ?? 2;
    const gap = ' '.repeat(gapN);
    const colCount = spec.headers.length;
    const colWidths = spec.headers.map((header, i) => Math.max(ctx.visualWidth(header), ...spec.rows.map((row) => ctx.visualWidth(row.values[i] ?? ''))));
    const rightFixed = colWidths.reduce((sum, w) => sum + w, 0) + gapN * Math.max(0, colCount - 1);
    const meterMax = spec.meterMax ?? Math.max(10, Math.min(24, Math.floor(spec.inner * 0.5)));
    const meterAvail = spec.inner - spec.labelWidth - gapN * 2 - rightFixed;
    if (meterAvail < 8)
        return null;
    const meterWidth = Math.min(meterAvail, meterMax);
    const spacer = ' '.repeat(spec.inner - spec.labelWidth - gapN - meterWidth - rightFixed);
    const dimCols = spec.dimColumns ?? spec.headers.map((_, i) => i > 0);
    const rightCells = (cells, styled) => cells
        .map((cell, i) => {
        const padded = padStart(ctx, cell, colWidths[i] ?? 0);
        return styled && ctx.color && dimCols[i] ? dim(padded) : padded;
    })
        .join(gap);
    const headerLine = ' '.repeat(spec.labelWidth) + gap + ' '.repeat(meterWidth) + spacer + rightCells(spec.headers, false);
    const lines = [ctx.color ? dim(headerLine) : headerLine, ''];
    for (const row of spec.rows) {
        const label = padEnd(ctx, colorLabel(ctx, ctx.truncate(row.label, spec.labelWidth), row.color), spec.labelWidth);
        const bars = meter(ctx, row.fraction, meterWidth, row.color);
        lines.push(`${label}${gap}${bars}${spacer}${rightCells(row.values, true)}`);
    }
    return lines;
}
export function legend(ctx, items, width) {
    if (items.length === 0)
        return [];
    const parts = items.map((item) => `${swatch(ctx, item.color)} ${colorLabel(ctx, item.label, item.color)}`);
    const sep = '   ';
    const lines = [];
    let current = '';
    let currentWidth = 0;
    for (const part of parts) {
        const partWidth = ctx.visualWidth(part);
        const addWidth = current === '' ? partWidth : partWidth + sep.length;
        if (current !== '' && currentWidth + addWidth > width) {
            lines.push(current);
            current = part;
            currentWidth = partWidth;
        }
        else {
            current = current === '' ? part : current + sep + part;
            currentWidth += addWidth;
        }
    }
    if (current !== '')
        lines.push(current);
    return lines;
}
const PAD = 1; // columns of padding inside the vertical borders
export function panel(ctx, opts) {
    const accent = opts.accent ?? THEME.accent;
    const inner = Math.max(1, opts.width - 2 - PAD * 2);
    const horiz = (text) => (ctx.color ? fg(accent, text) : text);
    const chrome = (text) => (ctx.color ? dim(text) : text);
    const lines = [];
    // Top border with embedded title.
    if (opts.title) {
        const title = ctx.truncate(opts.title, Math.max(0, inner - 2));
        const styledTitle = ctx.color ? bold(fg(accent, title)) : title;
        const left = `${BOX.topLeft}${BOX.horizontal} `;
        const used = 2 + 1 + ctx.visualWidth(title) + 1; // corner+dash + space + title + trailing space
        const fillCount = Math.max(0, opts.width - used - 1); // -1 for right corner
        lines.push(`${horiz(left)}${styledTitle}${horiz(' ' + BOX.horizontal.repeat(fillCount) + BOX.topRight)}`);
    }
    else {
        lines.push(horiz(BOX.topLeft + BOX.horizontal.repeat(opts.width - 2) + BOX.topRight));
    }
    const bodyLine = (content) => {
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
    for (const line of opts.body)
        lines.push(bodyLine(line));
    if (opts.footer) {
        lines.push(bodyLine(''));
        const foot = ctx.truncate(opts.footer, inner);
        lines.push(bodyLine(ctx.color ? dim(foot) : foot));
    }
    // Bottom border.
    lines.push(horiz(BOX.bottomLeft + BOX.horizontal.repeat(opts.width - 2) + BOX.bottomRight));
    return lines;
}
