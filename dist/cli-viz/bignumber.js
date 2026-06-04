// Big-number widget — the single most-used analytics dashboard tile.
//
// Renders one aggregate value large and legible, with an optional
// period-over-period delta (up/down arrow + % change) and an optional
// sparkline of the underlying series. Inspired by PostHog's "Number" insight.
// Like the rest of agentviz it is text-first: no color is emitted unless
// explicitly enabled, so the output survives an agent transcript, copy/paste,
// and the web renderer.
import { THEME, bold, fg, mutedText } from './theme.js';
import { deltaBadge, inlineSparkline, panel } from './components.js';
import { makeRenderCtx } from './render-context.js';
const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-?]*[ -/]*[@-~]`, 'g');
// C0/C1 control characters and DEL, excluding the line breaks handled separately.
const CONTROL_PATTERN = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]', 'g');
const SPARKLINE_BUCKETS = ['_', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
// A composable KPI tile: heading (panel title) · big value · semantic delta ·
// mini-sparkline. Built on the shared panel + the deltaBadge / inlineSparkline
// growth primitives, so it reads as one product with the charts and drops into
// a dashboard grid. Color degrades to clean monochrome.
export function renderBigNumber(value, options = {}) {
    const width = clampWidth(options.width);
    const ctx = makeRenderCtx(options);
    const heading = sanitizeText(options.title ?? options.label ?? '');
    // Line 1: the big value (bold) + the period-over-period delta beside it. The
    // delta's color is semantic (good vs bad), honoring goodDirection.
    const valueText = formatValue(value, options);
    const bigValue = ctx.color ? bold(fg(THEME.ink, valueText)) : valueText;
    const hasPrevious = options.previous !== undefined && Number.isFinite(options.previous);
    const headParts = [bigValue];
    if (hasPrevious) {
        const previous = options.previous;
        const change = previous === 0 ? Number.POSITIVE_INFINITY : (value - previous) / Math.abs(previous);
        headParts.push(deltaBadge(ctx, change, { goodDirection: options.goodDirection ?? 'up' }));
    }
    const body = [headParts.join('   ')];
    // Line 2 (optional): mini-sparkline + a dim "vs <previous>" caption.
    const captionParts = [];
    if (options.sparkline && options.sparkline.length > 0) {
        const spark = inlineSparkline(ctx, options.sparkline);
        if (spark.length > 0)
            captionParts.push(spark);
    }
    if (hasPrevious) {
        const prevText = `vs ${formatValue(options.previous, options)}`;
        captionParts.push(ctx.color ? mutedText(prevText) : prevText);
    }
    if (captionParts.length > 0)
        body.push(captionParts.join('   '));
    return panel(ctx, {
        body,
        width,
        accent: THEME.accent,
        ...(heading ? { title: heading } : {}),
    }).join('\n');
}
function formatValue(value, options) {
    // Unit affixes are caller-supplied and flow into the (optionally colored)
    // delta line, which preserves ANSI. Strip ESC/control sequences here so a
    // unit like an OSC hyperlink can't smuggle terminal escapes into output.
    const prefix = safeAffix(options.unit?.prefix ?? '');
    const suffix = safeAffix(options.unit?.suffix ?? '');
    return `${prefix}${formatNumber(value, options.format)}${suffix}`;
}
function safeAffix(value) {
    return stripAnsi(value).replace(CONTROL_PATTERN, '').replace(/\r?\n/g, ' ');
}
// The delta indicator and mini-sparkline now come from the shared growth
// primitives (deltaBadge / inlineSparkline in ./components).
// --------------------------------------------------------------------------
// Self-contained helpers (modules in this package do not share a util file)
// --------------------------------------------------------------------------
export function resolveColorEnabled(options = {}) {
    const env = options.env ?? process.env;
    if (options.color === 'never')
        return false;
    if (env.NO_COLOR !== undefined)
        return false;
    if (options.color === 'always')
        return true;
    if (options.color === 'auto')
        return options.isTTY ?? process.stdout.isTTY === true;
    return false;
}
function formatNumber(value, format) {
    if (!Number.isFinite(value))
        return '0';
    if (format === 'percent') {
        return new Intl.NumberFormat('en-US', {
            maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 0.1 ? 1 : 0,
            style: 'percent',
        }).format(value);
    }
    if (format === 'compact') {
        return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
    }
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
}
function sparkChar(value, min, max) {
    if (max === min)
        return '▄';
    const index = Math.round(((value - min) / (max - min)) * (SPARKLINE_BUCKETS.length - 1));
    return SPARKLINE_BUCKETS[Math.max(0, Math.min(SPARKLINE_BUCKETS.length - 1, index))] ?? '_';
}
function sampleSeries(values, maxPoints) {
    if (values.length <= maxPoints)
        return values;
    if (maxPoints <= 1)
        return [values[values.length - 1] ?? 0];
    const sampled = [];
    for (let index = 0; index < maxPoints; index += 1) {
        const sourceIndex = Math.round((index / (maxPoints - 1)) * (values.length - 1));
        sampled.push(values[sourceIndex] ?? 0);
    }
    return sampled;
}
function stripAnsi(value) {
    return value.replace(ANSI_PATTERN, '');
}
function sanitizeText(value) {
    return stripAnsi(value)
        .replace(/[<>]/g, '')
        .replace(/\r?\n/g, ' ')
        .replace(CONTROL_PATTERN, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function truncateLine(value, width, allowAnsi = false) {
    if (allowAnsi && visualWidth(value) <= width)
        return value.replace(/\r?\n/g, ' ');
    const text = stripAnsi(value).replace(/\r?\n/g, ' ').replace(CONTROL_PATTERN, '');
    if (visualWidth(text) <= width)
        return text;
    if (width <= 1)
        return text.slice(0, Math.max(0, width));
    return `${text.slice(0, width - 1)}~`;
}
function visualWidth(value) {
    let width = 0;
    for (const _char of stripAnsi(value))
        width += 1;
    return width;
}
function clampWidth(width) {
    if (width === undefined)
        return 80;
    return Math.max(16, Math.floor(width));
}
