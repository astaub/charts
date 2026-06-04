const DEFAULT_WIDTH = 80;
const NARROW_WIDTH = 54;
const MIN_WIDTH = 32;
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const SERIES_SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('');
export function renderGroupedBarChart(buckets, options = {}) {
    const width = clampWidth(options.width);
    const emptyLabel = sanitizeText(options.emptyLabel ?? 'No grouped bar chart data.');
    if (buckets.length === 0)
        return truncateLine(emptyLabel, width);
    const cleanBuckets = cleanGroupedBuckets(buckets);
    if (cleanBuckets.length === 0)
        return truncateLine(emptyLabel, width);
    const series = seriesMetadata(cleanBuckets, options.seriesOrder);
    if (series.length === 0)
        return truncateLine(emptyLabel, width);
    const title = options.title === undefined ? undefined : sanitizeText(options.title);
    const legend = options.showLegend === false ? undefined : renderLegend(series, width);
    const values = cleanBuckets.flatMap((bucket) => bucket.bars.map((bar) => bar.value));
    const maxValue = Math.max(...values, 0);
    const chartHeight = Math.max(4, Math.min(12, Math.floor(options.height ?? 8)));
    const axisLabels = groupedAxisLabels(maxValue, chartHeight, options);
    const labelWidth = Math.max(5, longest(axisLabels));
    const layout = resolveLayout(cleanBuckets.length, series.length, labelWidth, width);
    const body = layout === undefined
        ? renderGroupedBlocks(cleanBuckets, series, options, width)
        : renderGroupedPlot(cleanBuckets, series, options, layout, chartHeight, maxValue, axisLabels, labelWidth, width);
    const lines = [
        ...(title ? [truncateLine(title, width), repeat('-', Math.min(width, visualWidth(title)))] : []),
        ...(legend ? [legend, ''] : []),
        body,
        ...renderFooter(options.footer, width),
    ];
    return lines.filter((line) => line !== undefined).join('\n');
}
function cleanGroupedBuckets(buckets) {
    return buckets.map((bucket) => {
        const bars = (bucket.bars ?? [])
            .filter((bar) => Number.isFinite(bar.value))
            .map((bar) => {
            const rawKey = bar.key ?? bar.label ?? '';
            const key = sanitizeText(rawKey);
            return {
                key,
                label: sanitizeText(bar.label ?? key),
                value: numeric(bar.value),
            };
        })
            .filter((bar) => bar.key.length > 0);
        return {
            label: sanitizeText(bucket.label),
            bars,
        };
    });
}
function seriesMetadata(buckets, seriesOrder) {
    const byKey = new Map();
    for (const bucket of buckets) {
        for (const bar of bucket.bars) {
            if (!byKey.has(bar.key))
                byKey.set(bar.key, bar.label);
        }
    }
    const ordered = (seriesOrder ?? []).map(sanitizeText).filter((key) => byKey.has(key));
    const orderedKeys = [
        ...ordered,
        ...[...byKey.keys()].filter((key) => !ordered.includes(key)),
    ];
    return orderedKeys.map((key, index) => ({
        key,
        label: byKey.get(key) ?? key,
        symbol: SERIES_SYMBOLS[index] ?? '?',
    }));
}
// Returns undefined when the groups cannot fit even at the most compact layout,
// signalling the caller to fall back to the block listing.
function resolveLayout(bucketCount, seriesCount, labelWidth, width) {
    if (width < NARROW_WIDTH)
        return undefined;
    const available = width - labelWidth - 3;
    if (available < seriesCount + 4)
        return undefined;
    // Try progressively more compact layouts before giving up on the plot.
    for (const [barWidth, groupGap] of [[2, 2], [1, 2], [1, 1]]) {
        const groupWidth = seriesCount * barWidth;
        const total = bucketCount * groupWidth + Math.max(0, bucketCount - 1) * groupGap;
        if (total <= available) {
            const positions = groupCenters(bucketCount, groupWidth, groupGap);
            return { barWidth, groupGap, groupWidth, plotWidth: total, positions };
        }
    }
    return undefined;
}
function groupCenters(bucketCount, groupWidth, groupGap) {
    const centers = [];
    let cursor = 0;
    for (let index = 0; index < bucketCount; index += 1) {
        centers.push(cursor + Math.floor((groupWidth - 1) / 2));
        cursor += groupWidth + groupGap;
    }
    return centers;
}
function renderGroupedPlot(buckets, series, options, layout, chartHeight, maxValue, axisLabels, labelWidth, width) {
    const { barWidth, groupWidth, groupGap, plotWidth, positions } = layout;
    const grid = Array.from({ length: chartHeight }, () => Array.from({ length: plotWidth }, () => ' '));
    // Markers first so bars paint over them on collision.
    const markers = resolveMarkers(options.markers, buckets, positions);
    for (const marker of markers)
        drawMarker(grid, marker.x);
    buckets.forEach((bucket, bucketIndex) => {
        const groupStart = (groupWidth + groupGap) * bucketIndex;
        series.forEach((meta, seriesIndex) => {
            const value = findBar(bucket, meta.key)?.value ?? 0;
            const barHeight = barCellHeight(value, maxValue, chartHeight);
            const barStart = groupStart + seriesIndex * barWidth;
            for (let column = 0; column < barWidth; column += 1) {
                const x = barStart + column;
                for (let row = chartHeight - barHeight; row < chartHeight; row += 1) {
                    const gridRow = grid[row];
                    if (gridRow && x >= 0 && x < gridRow.length)
                        gridRow[x] = meta.symbol;
                }
            }
        });
    });
    const lines = [];
    // Marker labels above the plot.
    const aboveLabels = renderMarkerLabelLine(markers, labelWidth, plotWidth);
    if (aboveLabels)
        lines.push(aboveLabels);
    for (let row = 0; row < chartHeight; row += 1) {
        lines.push(`${padCell(axisLabels[row] ?? '0', labelWidth, 'right')} | ${grid[row]?.join('').trimEnd() ?? ''}`);
    }
    lines.push(`${repeat(' ', labelWidth)} + ${repeat('-', Math.max(1, plotWidth))}`);
    lines.push(...groupedBucketLabelLines(buckets, positions, labelWidth, plotWidth));
    return lines.map((line) => truncateLine(line, width).trimEnd()).join('\n');
}
function renderGroupedBlocks(buckets, series, options, width) {
    const markers = (options.markers ?? [])
        .filter((marker) => buckets.some((bucket) => bucket.label === sanitizeText(marker.at)) && sanitizeText(marker.label ?? '').length > 0);
    const blocks = buckets.flatMap((bucket, index) => {
        const prefix = `${index + 1}. `;
        return [
            ...(index > 0 ? [''] : []),
            `${prefix}${truncateLine(bucket.label, width - visualWidth(prefix))}`,
            ...series.flatMap((meta) => wrapLine(`   ${meta.label}: ${formatValue(findBar(bucket, meta.key)?.value ?? 0, options)}`, width)),
        ];
    });
    if (markers.length > 0) {
        const entries = markers.map((marker) => `${sanitizeText(marker.at)}=${sanitizeText(marker.label ?? '')}`);
        blocks.push(...wrapLine(`Marks: ${entries.join('  ')}`, width));
    }
    return blocks.join('\n');
}
function resolveMarkers(markers, buckets, positions) {
    if (!markers || markers.length === 0)
        return [];
    const resolved = [];
    for (const marker of markers) {
        const at = sanitizeText(marker.at);
        const index = buckets.findIndex((bucket) => bucket.label === at);
        if (index < 0)
            continue;
        const x = positions[index];
        if (x === undefined)
            continue;
        resolved.push({ x, label: sanitizeText(marker.label ?? '') });
    }
    return resolved;
}
function drawMarker(grid, x) {
    for (let y = 0; y < grid.length; y += 1) {
        const row = grid[y];
        if (!row || x < 0 || x >= row.length)
            continue;
        if (row[x] === ' ')
            row[x] = '│';
    }
}
function renderMarkerLabelLine(markers, labelWidth, plotWidth) {
    const printable = markers.filter((marker) => marker.label.length > 0);
    if (printable.length === 0)
        return undefined;
    const line = Array.from({ length: plotWidth }, () => ' ');
    for (const marker of printable) {
        const label = marker.label;
        const start = Math.max(0, Math.min(plotWidth - label.length, marker.x - Math.floor(label.length / 2)));
        // Refuse to overpaint a neighbor: drop the label entirely on collision.
        let collides = false;
        for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
            const target = start + charIndex;
            if (target < 0 || target >= line.length)
                continue;
            if (line[target] !== undefined && line[target] !== ' ') {
                collides = true;
                break;
            }
        }
        if (collides)
            continue;
        for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
            const target = start + charIndex;
            if (target >= 0 && target < line.length)
                line[target] = label[charIndex] ?? ' ';
        }
    }
    return `${repeat(' ', labelWidth)}   ${line.join('').trimEnd()}`;
}
function groupedBucketLabelLines(buckets, positions, labelWidth, plotWidth) {
    const prefix = `${repeat(' ', labelWidth)}   `;
    const line = Array.from({ length: plotWidth }, () => ' ');
    buckets.forEach((bucket, index) => {
        paintBucketLabel(line, bucket.label, positions[index] ?? 0, plotWidth);
    });
    return [`${prefix}${line.join('').trimEnd()}`];
}
function paintBucketLabel(line, bucket, x, plotWidth) {
    const label = bucket.slice(0, 7);
    if (label.length === 0)
        return;
    const start = Math.max(0, Math.min(plotWidth - label.length, x - Math.floor(label.length / 2)));
    // Refuse to paint if any target cell is filled; better to drop the label
    // than corrupt a neighbor by overwriting it.
    for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
        const target = start + charIndex;
        if (target < 0 || target >= line.length)
            continue;
        if (line[target] !== undefined && line[target] !== ' ')
            return;
    }
    for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
        const target = start + charIndex;
        if (target >= 0 && target < line.length)
            line[target] = label[charIndex] ?? ' ';
    }
}
function barCellHeight(value, maxValue, chartHeight) {
    if (value <= 0 || maxValue <= 0)
        return 0;
    const exact = (value / maxValue) * chartHeight;
    // Any positive value gets at least one cell so it never silently vanishes.
    return Math.max(1, Math.min(chartHeight, Math.round(exact)));
}
function groupedAxisLabels(maxValue, chartHeight, options) {
    return Array.from({ length: chartHeight }, (_, row) => {
        const value = maxValue - (row / Math.max(1, chartHeight - 1)) * maxValue;
        return formatValue(value, options);
    });
}
function renderLegend(series, width) {
    return wrapLine(`Legend: ${series.map((meta) => `${meta.symbol} ${meta.label}`).join(', ')}`, width).join('\n');
}
function renderFooter(footer, width) {
    if (typeof footer !== 'string' || footer.trim().length === 0)
        return [];
    return ['', ...wrapLine(footer, width)];
}
function findBar(bucket, key) {
    return bucket.bars.find((bar) => bar.key === key);
}
function formatValue(value, options) {
    if (options.valueFormat === 'percent')
        return formatPercent(value);
    return `${options.unit?.prefix ?? ''}${formatNumber(value)}${options.unit?.suffix ?? ''}`;
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
        .replace(/[ ---]/g, '')
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
