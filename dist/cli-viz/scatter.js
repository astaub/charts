import { THEME, bodyText, fg, getAppearance, mutedText } from './theme.js';
import { panel } from './components.js';
import { makeRenderCtx } from './render-context.js';
const DEFAULT_WIDTH = 80;
const NARROW_WIDTH = 54;
const MIN_WIDTH = 32;
const MAX_GRID_POINTS = 35;
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const AXIS_CHARS = new Set(['|', '-', '+']);
// Quadrant analysis colors: top-right (high/high) reads as winners (green),
// bottom-left (low/low) as laggards (red), the mixed quadrants stay accent.
function quadrantColor(x, y, xThreshold, yThreshold) {
    const right = x >= xThreshold;
    const top = y >= yThreshold;
    if (right && top)
        return THEME.positive;
    if (!right && !top)
        return THEME.negative;
    return THEME.accent;
}
export function renderScatterPlot(points, options = {}) {
    const width = clampWidth(options.width);
    const cleanPoints = points
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .map((point, index) => ({
        id: pointId(index),
        label: sanitizeText(point.label),
        x: numeric(point.x),
        y: numeric(point.y),
    }));
    if (cleanPoints.length === 0)
        return 'No scatter plot data.';
    const xLabel = sanitizeText(options.xLabel ?? 'X');
    const yLabel = sanitizeText(options.yLabel ?? 'Y');
    const xFormat = options.xFormat ?? 'number';
    const yFormat = options.yFormat ?? 'number';
    const xThreshold = Number.isFinite(options.xThreshold) ? numeric(options.xThreshold) : median(cleanPoints.map((point) => point.x));
    const yThreshold = Number.isFinite(options.yThreshold) ? numeric(options.yThreshold) : median(cleanPoints.map((point) => point.y));
    const includeTable = options.includeTable !== false;
    const renderContext = { width, xLabel, yLabel, xFormat, yFormat, xThreshold, yThreshold, options };
    if (width < NARROW_WIDTH || cleanPoints.length > MAX_GRID_POINTS) {
        return renderScatterBlocks(cleanPoints, renderContext);
    }
    const ctx = makeRenderCtx(options);
    const contentWidth = width - 4; // inside the panel border + padding
    const xRange = expandedRange(cleanPoints.map((point) => point.x), xThreshold, xFormat);
    const yRange = expandedRange(cleanPoints.map((point) => point.y), yThreshold, yFormat);
    const yTicks = [yRange.max, midpoint(yRange.min, yRange.max), yRange.min];
    const yTickWidth = Math.max(...yTicks.map((tick) => visualWidth(formatValue(tick, yFormat))));
    const plotWidth = Math.max(20, contentWidth - yTickWidth - 3);
    const plotHeight = width >= 72 ? 10 : 8;
    const grid = makeGrid(plotHeight, plotWidth, ' ');
    // Parallel color grid: each plotted point cell carries its quadrant color.
    const colorGrid = Array.from({ length: plotHeight }, () => Array.from({ length: plotWidth }, () => null));
    const xReferenceColumn = valueToColumn(xThreshold, xRange.min, xRange.max, plotWidth);
    const yReferenceRow = valueToRow(yThreshold, yRange.min, yRange.max, plotHeight);
    for (let row = 0; row < plotHeight; row += 1) {
        grid[row][xReferenceColumn] = '|';
    }
    for (let column = 0; column < plotWidth; column += 1) {
        grid[yReferenceRow][column] = '-';
    }
    grid[yReferenceRow][xReferenceColumn] = '+';
    for (const point of cleanPoints) {
        const row = valueToRow(point.y, yRange.min, yRange.max, plotHeight);
        const column = valueToColumn(point.x, xRange.min, xRange.max, plotWidth);
        const current = grid[row][column] ?? ' ';
        grid[row][column] = current.trim() && !AXIS_CHARS.has(current) ? '*' : point.id;
        colorGrid[row][column] = quadrantColor(point.x, point.y, xThreshold, yThreshold);
    }
    const dimText = (text) => (ctx.color ? mutedText(text) : text);
    // Color a plotted grid row: threshold cross in the warn accent (a reference
    // line, like a goal), points in their quadrant color, collisions muted.
    const colorRow = (row) => {
        const cells = grid[row];
        let out = '';
        for (let col = 0; col < cells.length; col += 1) {
            const ch = cells[col] ?? ' ';
            if (ch === ' ') {
                out += ' ';
                continue;
            }
            if (!ctx.color) {
                out += ch;
                continue;
            }
            if (AXIS_CHARS.has(ch))
                out += fg(THEME.warn, ch);
            else if (ch === '*')
                out += fg(THEME.muted, ch);
            else
                out += fg(colorGrid[row][col] ?? THEME.accent, ch);
        }
        return out;
    };
    const body = [dimText(fitLine(yLabel, contentWidth))];
    for (let row = 0; row < plotHeight; row += 1) {
        const tick = tickForRow(row, plotHeight, yTicks, yFormat);
        body.push(`${dimText(padCell(tick, yTickWidth, 'right'))} ${dimText('|')}${colorRow(row)}`);
    }
    body.push(dimText(`${repeat(' ', yTickWidth)} +${repeat('-', plotWidth)}`));
    body.push(dimText(`${repeat(' ', yTickWidth + 2)}${formatValue(xRange.min, xFormat)}${centerAxisLabel(xLabel, plotWidth, formatValue(xRange.min, xFormat), formatValue(xRange.max, xFormat))}${formatValue(xRange.max, xFormat)}`));
    if (includeTable) {
        body.push('');
        body.push(...renderCoordinateTable(cleanPoints, { ...renderContext, width: contentWidth, color: ctx.color }));
    }
    const title = sanitizeText(options.title ?? `${yLabel} vs ${xLabel}`);
    return panel(ctx, {
        body,
        width,
        accent: THEME.accent,
        ...(title ? { title } : {}),
    }).join('\n');
}
function renderScatterBlocks(points, context) {
    return points
        .flatMap((point, index) => {
        const prefix = `${index + 1}. `;
        return [
            ...(index > 0 ? [''] : []),
            `${prefix}${truncateLine(point.label, context.width - visualWidth(prefix))}`,
            ...wrapIndentedLine(`${context.xLabel}: ${formatValue(point.x, context.xFormat)}`, context.width),
            ...wrapIndentedLine(`${context.yLabel}: ${formatValue(point.y, context.yFormat)}`, context.width),
            ...wrapIndentedLine(`quadrant: ${quadrantLabel(point, context.xThreshold, context.yThreshold, context.options)}`, context.width),
        ];
    })
        .join('\n');
}
function renderCoordinateTable(points, context) {
    // Secondary table text needs explicit color on a light background (the muted
    // header/quadrant, the body-text rows) — uncolored text falls back to the
    // terminal/freeze default fg, which is pale on white. On dark the table was
    // (and stays) uncolored; bodyText is a no-op on dark, and muted is applied
    // light-only, so dark output is byte-identical. Mono leaves everything plain.
    const muted = (text) => (context.color && getAppearance() === 'light' ? mutedText(text) : text);
    const primary = (text) => (context.color ? bodyText(text) : text);
    const labelWidth = Math.min(24, Math.max(6, longest(points.map((point) => point.label))));
    const xValues = points.map((point) => formatValue(point.x, context.xFormat));
    const yValues = points.map((point) => formatValue(point.y, context.yFormat));
    const xWidth = Math.max(visualWidth(context.xLabel), ...xValues.map(visualWidth));
    const yWidth = Math.max(visualWidth(context.yLabel), ...yValues.map(visualWidth));
    const quadrantHeader = 'Quadrant';
    const quadrantValues = points.map((point) => quadrantLabel(point, context.xThreshold, context.yThreshold, context.options));
    const remaining = context.width - labelWidth - xWidth - yWidth - 8;
    if (remaining < 8) {
        return renderScatterBlocks(points, context).split('\n');
    }
    const quadrantWidth = Math.max(8, Math.min(Math.max(visualWidth(quadrantHeader), longest(quadrantValues)), remaining));
    const lines = [
        muted([
            padCell('ID', 2, 'left'),
            padCell('Label', labelWidth, 'left'),
            padCell(context.xLabel, xWidth, 'right'),
            padCell(context.yLabel, yWidth, 'right'),
            padCell(quadrantHeader, quadrantWidth, 'left'),
        ].join('  ')),
        muted([
            repeat('-', 2),
            repeat('-', labelWidth),
            repeat('-', xWidth),
            repeat('-', yWidth),
            repeat('-', quadrantWidth),
        ].join('  ')),
    ];
    for (const point of points) {
        lines.push([
            primary(padCell(point.id, 2, 'left')),
            primary(padCell(point.label, labelWidth, 'left')),
            primary(padCell(formatValue(point.x, context.xFormat), xWidth, 'right')),
            primary(padCell(formatValue(point.y, context.yFormat), yWidth, 'right')),
            muted(padCell(quadrantLabel(point, context.xThreshold, context.yThreshold, context.options), quadrantWidth, 'left')),
        ].join('  '));
    }
    return lines;
}
function quadrantLabel(point, xThreshold, yThreshold, options) {
    const highX = point.x >= xThreshold;
    const highY = point.y >= yThreshold;
    const labels = options.quadrantLabels ?? {};
    if (highX && highY)
        return sanitizeText(labels.topRight ?? 'high x / high y');
    if (!highX && highY)
        return sanitizeText(labels.topLeft ?? 'low x / high y');
    if (highX && !highY)
        return sanitizeText(labels.bottomRight ?? 'high x / low y');
    return sanitizeText(labels.bottomLeft ?? 'low x / low y');
}
function expandedRange(values, threshold, format) {
    let min = Math.min(...values, threshold);
    let max = Math.max(...values, threshold);
    if (min === max) {
        const delta = Math.max(format === 'percent' ? 0.01 : 1, Math.abs(min) * 0.1);
        min -= delta;
        max += delta;
    }
    const padding = (max - min) * 0.08;
    return { min: min - padding, max: max + padding };
}
function valueToColumn(value, min, max, width) {
    if (max === min)
        return 0;
    const normalized = (value - min) / (max - min);
    return Math.max(0, Math.min(width - 1, Math.round(normalized * (width - 1))));
}
function valueToRow(value, min, max, height) {
    if (max === min)
        return 0;
    const normalized = (value - min) / (max - min);
    return Math.max(0, Math.min(height - 1, Math.round((1 - normalized) * (height - 1))));
}
function tickForRow(row, plotHeight, ticks, format) {
    if (row === 0)
        return formatValue(ticks[0] ?? 0, format);
    if (row === Math.floor(plotHeight / 2))
        return formatValue(ticks[1] ?? 0, format);
    if (row === plotHeight - 1)
        return formatValue(ticks[2] ?? 0, format);
    return '';
}
function centerAxisLabel(label, width, left, right) {
    const available = Math.max(1, width - visualWidth(left) - visualWidth(right));
    const text = truncateLine(` ${label} `, available);
    const leftPad = Math.max(0, Math.floor((available - visualWidth(text)) / 2));
    const rightPad = Math.max(0, available - visualWidth(text) - leftPad);
    return `${repeat(' ', leftPad)}${text}${repeat(' ', rightPad)}`;
}
function makeGrid(rows, columns, value) {
    return Array.from({ length: rows }, () => Array.from({ length: columns }, () => value));
}
function pointId(index) {
    if (index < 9)
        return String(index + 1);
    return String.fromCharCode(65 + ((index - 9) % 26));
}
function formatValue(value, format) {
    if (format === 'percent')
        return formatPercent(value);
    return formatNumber(value);
}
function midpoint(min, max) {
    return min + (max - min) / 2;
}
function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (sorted.length === 0)
        return 0;
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1)
        return sorted[middle] ?? 0;
    return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}
function padCell(value, width, align) {
    const text = truncateLine(sanitizeText(value), width);
    const padding = repeat(' ', Math.max(0, width - visualWidth(text)));
    return align === 'right' ? `${padding}${text}` : `${text}${padding}`;
}
function fitLine(value, width) {
    return truncateLine(value, width);
}
function truncateLine(value, width) {
    const text = stripAnsi(value)
        .replace(/\r?\n/g, ' ')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .trimEnd();
    if (visualWidth(text) <= width)
        return text;
    if (width <= 1)
        return takeDisplayWidth(text, Math.max(0, width));
    return `${takeDisplayWidth(text, width - 1)}~`;
}
function wrapLine(value, width) {
    const text = sanitizeText(value);
    if (visualWidth(text) <= width)
        return [text];
    const lines = [];
    let remaining = text;
    while (visualWidth(remaining) > width) {
        const hardSlice = takeDisplayWidth(remaining, width);
        const lastSpace = hardSlice.lastIndexOf(' ');
        const breakAt = lastSpace > Math.floor(width / 2) ? lastSpace : hardSlice.length;
        const line = hardSlice.slice(0, breakAt).trimEnd();
        lines.push(line);
        remaining = remaining.slice(hardSlice.slice(0, breakAt).length).trimStart();
    }
    if (remaining.length > 0)
        lines.push(remaining);
    return lines;
}
function wrapIndentedLine(value, width) {
    return wrapLine(value, Math.max(1, width - 3)).map((line) => `   ${line}`);
}
function takeDisplayWidth(value, width) {
    let used = 0;
    let output = '';
    for (const char of value) {
        const charWidth = charDisplayWidth(char);
        if (used + charWidth > width)
            break;
        used += charWidth;
        output += char;
    }
    return output;
}
function visualWidth(value) {
    let width = 0;
    for (const char of stripAnsi(value))
        width += charDisplayWidth(char);
    return width;
}
function charDisplayWidth(char) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0)
        return 0;
    if (code < 32 || (code >= 0x7f && code < 0xa0))
        return 0;
    if (code >= 0x300 && code <= 0x36f)
        return 0;
    if ((code >= 0x1100 && code <= 0x115f) ||
        (code >= 0x2329 && code <= 0x232a) ||
        (code >= 0x2e80 && code <= 0xa4cf) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe10 && code <= 0xfe19) ||
        (code >= 0xfe30 && code <= 0xfe6f) ||
        (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xffe0 && code <= 0xffe6)) {
        return 2;
    }
    return 1;
}
function sanitizeText(value) {
    return stripAnsi(value)
        .replace(/\r?\n/g, ' ')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .replace(/[<>]/g, '')
        .replace(/[|`]/g, '/')
        .replace(/\s+/g, ' ')
        .trim();
}
function stripAnsi(value) {
    return value.replace(ANSI_PATTERN, '');
}
function formatNumber(value) {
    if (!Number.isFinite(value))
        return '0';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
}
function formatPercent(value) {
    if (!Number.isFinite(value))
        return '0%';
    const normalized = Math.abs(value) > 1 ? value / 100 : value;
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: normalized > 0 && normalized < 0.1 ? 1 : 0,
        style: 'percent',
    }).format(normalized);
}
function numeric(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, ''));
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}
function longest(values) {
    return Math.max(0, ...values.map(visualWidth));
}
function repeat(value, count) {
    return value.repeat(Math.max(0, count));
}
function clampWidth(width) {
    if (width === undefined)
        return DEFAULT_WIDTH;
    return Math.max(MIN_WIDTH, Math.floor(width));
}
