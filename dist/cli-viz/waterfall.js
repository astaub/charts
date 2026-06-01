const DEFAULT_WIDTH = 80;
const NARROW_WIDTH = 54;
const MIN_WIDTH = 32;
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
export function renderWaterfallChart(steps, options = {}) {
    const width = clampWidth(options.width);
    const cleanSteps = normalizeSteps(steps);
    if (cleanSteps.length === 0) {
        return truncateLine(sanitizeText(options.emptyLabel ?? 'No waterfall data.'), width);
    }
    const segments = waterfallSegments(cleanSteps);
    if (width < NARROW_WIDTH)
        return renderWaterfallBlocks(segments, width);
    const labelWidth = Math.min(30, Math.max(8, longest(segments.map((segment) => segment.label))));
    const valueWidth = Math.max(8, longest(segments.map((segment) => formatNumber(segment.value))));
    const changeWidth = Math.max(8, longest(segments.map((segment) => formatChange(segment))));
    const totalWidth = Math.max(8, longest(segments.map((segment) => formatNumber(segment.total))));
    const fixedWidth = labelWidth + valueWidth + changeWidth + totalWidth + 10;
    if (fixedWidth + 6 > width)
        return renderWaterfallBlocks(segments, width);
    const barWidth = Math.max(6, width - fixedWidth);
    const lines = [
        [
            padCell('Step', labelWidth, 'left'),
            padCell('Value', valueWidth, 'right'),
            padCell('Change', changeWidth, 'right'),
            padCell('Total', totalWidth, 'right'),
            'Bar',
        ].join('  '),
        [
            repeat('-', labelWidth),
            repeat('-', valueWidth),
            repeat('-', changeWidth),
            repeat('-', totalWidth),
            repeat('-', barWidth),
        ].join('  '),
    ];
    for (const segment of segments) {
        lines.push([
            padCell(segment.label, labelWidth, 'left'),
            padCell(formatNumber(segment.value), valueWidth, 'right'),
            padCell(formatChange(segment), changeWidth, 'right'),
            padCell(formatNumber(segment.total), totalWidth, 'right'),
            waterfallBar(segment, segments, barWidth),
        ].join('  '));
    }
    return lines.map((line) => truncateLine(line, width).trimEnd()).join('\n');
}
function normalizeSteps(steps) {
    return steps
        .filter((step) => Number.isFinite(step.value))
        .map((step, index) => ({
        label: sanitizeText(step.label),
        value: numeric(step.value),
        kind: step.kind ?? (index === 0 ? 'start' : step.value < 0 ? 'negative' : 'positive'),
    }))
        .filter((step) => step.label.length > 0);
}
function waterfallSegments(steps) {
    let running = 0;
    return steps.map((step, index) => {
        const kind = normalizeKind(step.kind, index);
        if (kind === 'start' || kind === 'end') {
            const previous = running;
            running = step.value;
            return {
                ...step,
                kind,
                base: 0,
                delta: running - previous,
                total: running,
            };
        }
        const signedDelta = kind === 'negative' ? -Math.abs(step.value) : Math.abs(step.value);
        const base = running;
        running += signedDelta;
        return {
            ...step,
            kind,
            base,
            delta: signedDelta,
            total: running,
        };
    });
}
function normalizeKind(kind, index) {
    if (index === 0 && kind !== 'start')
        return kind;
    return kind;
}
function renderWaterfallBlocks(segments, width) {
    return segments
        .flatMap((segment, index) => {
        const prefix = `${index + 1}. `;
        return [
            ...(index > 0 ? [''] : []),
            `${prefix}${truncateLine(segment.label, width - visualWidth(prefix))}`,
            ...wrapLine(`   value: ${formatNumber(segment.value)}`, width),
            ...wrapLine(`   change: ${formatChange(segment)}`, width),
            ...wrapLine(`   total: ${formatNumber(segment.total)}`, width),
            ...wrapLine(`   ${waterfallCompactLine(segment)}`, width),
        ];
    })
        .join('\n');
}
function waterfallCompactLine(segment) {
    if (segment.kind === 'start')
        return `█ start ${formatNumber(segment.total)}`;
    if (segment.kind === 'end')
        return `█ end ${formatNumber(segment.total)}`;
    if (segment.kind === 'negative')
        return `░ ${formatNumber(segment.base)} to ${formatNumber(segment.total)}`;
    return `# ${formatNumber(segment.base)} to ${formatNumber(segment.total)}`;
}
function waterfallBar(segment, segments, width) {
    const bounds = waterfallBounds(segments);
    const min = bounds.min;
    const max = bounds.max;
    if (width <= 0)
        return '';
    if (max === min)
        return repeat('█', Math.min(width, 1));
    const start = segment.kind === 'start' || segment.kind === 'end' ? Math.min(0, segment.total) : Math.min(segment.base, segment.total);
    const end = segment.kind === 'start' || segment.kind === 'end' ? Math.max(0, segment.total) : Math.max(segment.base, segment.total);
    const left = scalePosition(start, min, max, width);
    const right = Math.max(left, scalePosition(end, min, max, width));
    const fill = segment.kind === 'negative' ? '░' : segment.kind === 'positive' ? '#' : '█';
    const chars = Array.from({ length: width }, () => ' ');
    for (let index = left; index <= right && index < chars.length; index += 1) {
        if (index >= 0)
            chars[index] = fill;
    }
    const zero = scalePosition(0, min, max, width);
    if (zero >= 0 && zero < chars.length && chars[zero] === ' ')
        chars[zero] = '|';
    return chars.join('').trimEnd();
}
function waterfallBounds(segments) {
    const values = segments.flatMap((segment) => [0, segment.base, segment.total]);
    return {
        min: Math.min(...values),
        max: Math.max(...values),
    };
}
function scalePosition(value, min, max, width) {
    if (width <= 1 || max === min)
        return 0;
    const scaled = ((value - min) / (max - min)) * (width - 1);
    return Math.max(0, Math.min(width - 1, Math.round(scaled)));
}
function formatChange(segment) {
    if (segment.kind === 'start')
        return 'start';
    if (segment.kind === 'end')
        return 'end';
    const prefix = segment.delta > 0 ? '+' : '';
    return `${prefix}${formatNumber(segment.delta)}`;
}
function padCell(value, width, align) {
    const text = truncateLine(sanitizeText(value), width);
    const padding = repeat(' ', Math.max(0, width - visualWidth(text)));
    return align === 'right' ? `${padding}${text}` : `${text}${padding}`;
}
function truncateLine(value, width) {
    const text = cleanDisplayLine(value);
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
    return cleanDisplayLine(value)
        .replace(/\r?\n/g, ' ')
        .replace(/[<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function stripAnsi(value) {
    return value.replace(ANSI_PATTERN, '');
}
function cleanDisplayLine(value) {
    return stripAnsi(value)
        .replace(/\r?\n/g, ' ')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
}
function formatNumber(value) {
    if (!Number.isFinite(value))
        return '0';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
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
