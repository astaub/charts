const DEFAULT_WIDTH = 80;
const NARROW_WIDTH = 64;
const MIN_WIDTH = 32;
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const SEGMENT_SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');
export function renderStackedBarChart(buckets, options = {}) {
    const width = clampWidth(options.width);
    const emptyLabel = sanitizeText(options.emptyLabel ?? 'No stacked bar chart data.');
    if (buckets.length === 0)
        return truncateLine(emptyLabel, width);
    const cleanBuckets = cleanStackedBuckets(buckets);
    if (cleanBuckets.length === 0)
        return truncateLine(emptyLabel, width);
    const segments = segmentMetadata(cleanBuckets, options.segmentOrder);
    if (segments.length === 0)
        return truncateLine(emptyLabel, width);
    const title = options.title === undefined ? undefined : sanitizeText(options.title);
    const legend = options.showLegend === false ? undefined : renderLegend(segments, width);
    const body = shouldRenderBlocks(cleanBuckets, segments, width)
        ? renderStackedBlocks(cleanBuckets, segments, width)
        : renderStackedTable(cleanBuckets, segments, width);
    const lines = [
        ...(title ? [truncateLine(title, width), repeat('-', Math.min(width, visualWidth(title)))] : []),
        ...(legend ? [legend, ''] : []),
        body,
    ];
    return lines.filter((line) => line !== undefined).join('\n');
}
function cleanStackedBuckets(buckets) {
    return buckets.map((bucket) => {
        const segments = bucket.segments
            .filter((segment) => Number.isFinite(segment.value))
            .map((segment) => {
            const rawKey = segment.key ?? segment.label ?? '';
            const key = sanitizeText(rawKey);
            return {
                key,
                label: sanitizeText(segment.label ?? key),
                value: numeric(segment.value),
            };
        })
            .filter((segment) => segment.key.length > 0);
        const segmentTotal = segments.reduce((sum, segment) => sum + segment.value, 0);
        const total = bucket.total === undefined || !Number.isFinite(bucket.total) ? segmentTotal : numeric(bucket.total);
        return {
            label: sanitizeText(bucket.label),
            segments,
            total,
        };
    });
}
function segmentMetadata(buckets, segmentOrder) {
    const byKey = new Map();
    for (const bucket of buckets) {
        for (const segment of bucket.segments) {
            if (!byKey.has(segment.key))
                byKey.set(segment.key, segment.label);
        }
    }
    const orderedKeys = [
        ...(segmentOrder ?? []).map(sanitizeText).filter((key) => byKey.has(key)),
        ...[...byKey.keys()].filter((key) => !(segmentOrder ?? []).map(sanitizeText).includes(key)),
    ];
    return orderedKeys.map((key, index) => ({
        key,
        label: byKey.get(key) ?? key,
        symbol: SEGMENT_SYMBOLS[index] ?? '?',
    }));
}
function shouldRenderBlocks(buckets, segments, width) {
    if (width < NARROW_WIDTH)
        return true;
    const bucketWidth = Math.min(16, Math.max(6, longest(buckets.map((bucket) => bucket.label))));
    const totalWidth = Math.max(5, longest(buckets.map((bucket) => formatNumber(bucket.total))));
    const segmentWidths = segments.map((segment) => {
        const values = buckets.map((bucket) => formatSegmentShare(findSegment(bucket, segment.key)?.value ?? 0, bucket.total));
        return Math.min(18, Math.max(visualWidth(segment.label), ...values.map(visualWidth)));
    });
    const fixedWidth = bucketWidth + totalWidth + segmentWidths.reduce((sum, next) => sum + next, 0) + (segments.length + 2) * 2 + 8;
    return fixedWidth > width;
}
function renderStackedTable(buckets, segments, width) {
    const bucketWidth = Math.min(16, Math.max(6, longest(buckets.map((bucket) => bucket.label))));
    const totalWidth = Math.max(5, longest(buckets.map((bucket) => formatNumber(bucket.total))));
    const segmentWidths = segments.map((segment) => {
        const values = buckets.map((bucket) => formatSegmentShare(findSegment(bucket, segment.key)?.value ?? 0, bucket.total));
        return Math.min(18, Math.max(visualWidth(segment.label), ...values.map(visualWidth)));
    });
    const barWidth = Math.max(8, width - bucketWidth - totalWidth - segmentWidths.reduce((sum, next) => sum + next, 0) - (segments.length + 2) * 2);
    const lines = [
        [
            padCell('Bucket', bucketWidth, 'left'),
            padCell('Total', totalWidth, 'right'),
            ...segments.map((segment, index) => padCell(segment.label, segmentWidths[index] ?? 0, 'right')),
            'Mix',
        ].join('  '),
        [
            repeat('-', bucketWidth),
            repeat('-', totalWidth),
            ...segmentWidths.map((segmentWidth) => repeat('-', segmentWidth)),
            repeat('-', barWidth),
        ].join('  '),
    ];
    for (const bucket of buckets) {
        lines.push([
            padCell(bucket.label, bucketWidth, 'left'),
            padCell(formatNumber(bucket.total), totalWidth, 'right'),
            ...segments.map((segment, index) => padCell(formatSegmentShare(findSegment(bucket, segment.key)?.value ?? 0, bucket.total), segmentWidths[index] ?? 0, 'right')),
            renderStack(bucket, segments, barWidth),
        ].join('  '));
    }
    return lines.map((line) => truncateLine(line, width).trimEnd()).join('\n');
}
function renderStackedBlocks(buckets, segments, width) {
    const barWidth = Math.max(8, Math.min(32, width - 8));
    return buckets
        .flatMap((bucket, index) => {
        const prefix = `${index + 1}. `;
        return [
            ...(index > 0 ? [''] : []),
            `${prefix}${truncateLine(bucket.label, width - visualWidth(prefix))}`,
            ...wrapLine(`   total: ${formatNumber(bucket.total)}`, width),
            ...segments.flatMap((segment) => wrapLine(`   ${segment.label}: ${formatSegmentShare(findSegment(bucket, segment.key)?.value ?? 0, bucket.total)}`, width)),
            ...wrapLine(`   mix: ${renderStack(bucket, segments, barWidth)}`, width),
        ];
    })
        .join('\n');
}
function renderLegend(segments, width) {
    return wrapLine(`Legend: ${segments.map((segment) => `${segment.symbol} ${segment.label}`).join(', ')}`, width).join('\n');
}
function renderStack(bucket, segments, width) {
    if (width <= 0)
        return '';
    if (bucket.total <= 0)
        return repeat('.', width);
    const rawWidths = segments.map((segment) => {
        const value = findSegment(bucket, segment.key)?.value ?? 0;
        const exact = (Math.max(0, value) / bucket.total) * width;
        return {
            segment,
            whole: Math.floor(exact),
            remainder: exact - Math.floor(exact),
            value,
        };
    });
    let used = rawWidths.reduce((sum, next) => sum + next.whole, 0);
    const listedTotal = rawWidths.reduce((sum, next) => sum + Math.max(0, next.value), 0);
    const targetUsed = Math.min(width, Math.round((listedTotal / bucket.total) * width));
    const positive = rawWidths.filter((entry) => entry.value > 0);
    const sorted = [...positive].sort((left, right) => right.remainder - left.remainder);
    for (let index = 0; used < targetUsed && sorted.length > 0; index += 1) {
        sorted[index % sorted.length].whole += 1;
        used += 1;
    }
    while (used > width) {
        const shrinkable = rawWidths.find((entry) => entry.whole > 0);
        if (!shrinkable)
            break;
        shrinkable.whole -= 1;
        used -= 1;
    }
    const output = rawWidths.map((entry) => repeat(entry.segment.symbol, entry.whole)).join('');
    return output.length === 0 ? repeat('.', width) : output.padEnd(width, '.').slice(0, width);
}
function findSegment(bucket, key) {
    return bucket.segments.find((segment) => segment.key === key);
}
function formatSegmentShare(value, total) {
    return `${formatNumber(value)} (${formatPercent(ratio(value, total))})`;
}
function padCell(value, width, align) {
    const text = truncateLine(value, width);
    const padding = repeat(' ', Math.max(0, width - visualWidth(text)));
    return align === 'right' ? `${padding}${text}` : `${text}${padding}`;
}
function truncateLine(value, width) {
    const text = cleanDisplayText(value);
    if (visualWidth(text) <= width)
        return text;
    if (width <= 1)
        return takeDisplayWidth(text, Math.max(0, width));
    return `${takeDisplayWidth(text, width - 1)}~`;
}
function wrapLine(value, width) {
    const text = cleanDisplayText(value).replace(/\s+/g, ' ').trimEnd();
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
function sanitizeText(value) {
    return cleanDisplayText(value)
        .replace(/\s+/g, ' ')
        .trim();
}
function cleanDisplayText(value) {
    return stripAnsi(value)
        .replace(/\r?\n/g, ' ')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .replace(/[<>]/g, '');
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
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: value > 0 && value < 0.1 ? 1 : 0,
        style: 'percent',
    }).format(value);
}
function ratio(numerator, denominator) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0)
        return 0;
    return numerator / denominator;
}
function numeric(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return Math.max(0, value);
    if (typeof value === 'string') {
        const parsed = Number(value.replace(/,/g, ''));
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    }
    return 0;
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
