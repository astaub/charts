import { FULL_BLOCK, THEME, fg, mutedText, rampShade } from './theme.js';
import { panel } from './components.js';
import { makeRenderCtx, sanitizeText, truncateLine, visualWidth } from './render-context.js';
const DEFAULT_WIDTH = 80;
const NARROW_WIDTH = 54;
const MIN_WIDTH = 32;
export function renderHistogram(values, options = {}) {
    const width = clampWidth(options.width);
    const emptyLabel = sanitizeText(options.emptyLabel ?? 'No histogram data.');
    const finiteValues = values.filter(Number.isFinite);
    if (finiteValues.length === 0)
        return truncateLine(emptyLabel, width);
    const bins = bucketValues(finiteValues, options.bins);
    const maxCount = Math.max(...bins.map((bin) => bin.count), 0);
    if (maxCount === 0)
        return truncateLine(emptyLabel, width);
    const chartHeight = Math.max(4, Math.min(12, Math.floor(options.height ?? 8)));
    const axisLabels = axisLabelsFor(maxCount, chartHeight);
    const labelWidth = Math.max(5, longest(axisLabels));
    const contentWidth = width - 4;
    const layout = resolveLayout(bins.length, labelWidth, contentWidth);
    if (layout === undefined)
        return renderHistogramBlocks(bins, width);
    const ctx = makeRenderCtx(options);
    const body = renderHistogramPlot(ctx, bins, layout, chartHeight, maxCount, axisLabels, labelWidth);
    const xLabel = sanitizeText(options.xLabel ?? 'Value');
    if (xLabel.length > 0)
        body.push(dimLine(ctx, `${repeat(' ', labelWidth + 3)}${truncateLine(xLabel, layout.plotWidth)}`));
    const yLabel = sanitizeText(options.yLabel ?? 'Count');
    if (yLabel.length > 0)
        body.unshift(dimLine(ctx, truncateLine(yLabel, contentWidth)));
    return panel(ctx, {
        body,
        width,
        accent: THEME.accent,
        ...(options.title ? { title: sanitizeText(options.title) } : {}),
        ...(options.subtitle ? { subtitle: sanitizeText(options.subtitle) } : {}),
    }).join('\n');
}
export function bucketValues(values, requestedBins) {
    const finiteValues = values.filter(Number.isFinite);
    if (finiteValues.length === 0)
        return [];
    const binCount = normalizeBinCount(requestedBins);
    const min = Math.min(...finiteValues);
    const max = Math.max(...finiteValues);
    const span = max - min;
    if (span === 0) {
        const padding = Math.max(0.5, Math.abs(min) * 0.05);
        return Array.from({ length: binCount }, (_, index) => {
            const binMin = min - padding + (index / binCount) * padding * 2;
            const binMax = min - padding + ((index + 1) / binCount) * padding * 2;
            return {
                min: binMin,
                max: binMax,
                label: formatBinLabel(binMin, binMax),
                count: index === Math.floor(binCount / 2) ? finiteValues.length : 0,
            };
        });
    }
    const step = span / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => {
        const binMin = min + index * step;
        const binMax = index === binCount - 1 ? max : min + (index + 1) * step;
        return { min: binMin, max: binMax, label: formatBinLabel(binMin, binMax), count: 0 };
    });
    for (const value of finiteValues) {
        const rawIndex = Math.floor((value - min) / step);
        const index = Math.max(0, Math.min(binCount - 1, rawIndex));
        const bin = bins[index];
        if (bin)
            bin.count += 1;
    }
    return bins;
}
function normalizeBinCount(value) {
    const parsed = Number(value ?? 10);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return 10;
    return Math.max(1, Math.floor(parsed));
}
function renderHistogramPlot(ctx, bins, layout, chartHeight, maxCount, axisLabels, labelWidth) {
    const { barWidth, gap, plotWidth, centers } = layout;
    const grid = Array.from({ length: chartHeight }, () => Array.from({ length: plotWidth }, () => -1));
    bins.forEach((bin, index) => {
        const barHeight = barCellHeight(bin.count, maxCount, chartHeight);
        const start = index * (barWidth + gap);
        for (let xOffset = 0; xOffset < barWidth; xOffset += 1) {
            const x = start + xOffset;
            for (let row = chartHeight - barHeight; row < chartHeight; row += 1) {
                const gridRow = grid[row];
                if (gridRow && x >= 0 && x < gridRow.length)
                    gridRow[x] = index;
            }
        }
    });
    const lines = [];
    for (let row = 0; row < chartHeight; row += 1) {
        let plot = '';
        for (const owner of grid[row] ?? []) {
            if (owner < 0) {
                plot += ' ';
                continue;
            }
            plot += ctx.color ? fg(rampShade(owner, bins.length), FULL_BLOCK) : FULL_BLOCK;
        }
        lines.push(`${dimLine(ctx, padCell(axisLabels[row] ?? '0', labelWidth, 'right'))} ${dimLine(ctx, '|')} ${plot}`);
    }
    lines.push(`${dimLine(ctx, repeat(' ', labelWidth))} ${dimLine(ctx, '+')} ${dimLine(ctx, repeat('-', Math.max(1, plotWidth)))}`);
    lines.push(...histogramBucketLabelLines(bins, centers, labelWidth, plotWidth).map((line) => dimLine(ctx, line)));
    return lines;
}
function renderHistogramBlocks(bins, width) {
    return bins
        .flatMap((bin, index) => [
        ...(index > 0 ? [''] : []),
        `${index + 1}. ${truncateLine(bin.label, Math.max(1, width - 3))}`,
        ...wrapLine(`   count: ${formatNumber(bin.count)}`, width),
    ])
        .join('\n');
}
function resolveLayout(binCount, labelWidth, width) {
    if (width < NARROW_WIDTH)
        return undefined;
    const available = width - labelWidth - 3;
    if (available < binCount)
        return undefined;
    for (const [barWidth, gap] of [[3, 1], [2, 1], [1, 1], [1, 0]]) {
        const total = binCount * barWidth + Math.max(0, binCount - 1) * gap;
        if (total <= available) {
            return {
                barWidth,
                gap,
                plotWidth: total,
                centers: Array.from({ length: binCount }, (_, index) => index * (barWidth + gap) + Math.floor((barWidth - 1) / 2)),
            };
        }
    }
    return undefined;
}
function histogramBucketLabelLines(bins, centers, labelWidth, plotWidth) {
    const prefix = `${repeat(' ', labelWidth)}   `;
    const line = Array.from({ length: plotWidth }, () => ' ');
    bins.forEach((bin, index) => {
        paintBucketLabel(line, compactBinLabel(bin), centers[index] ?? 0, plotWidth);
    });
    return [`${prefix}${line.join('').trimEnd()}`];
}
function paintBucketLabel(line, label, x, plotWidth) {
    if (label.length === 0)
        return;
    const text = label.slice(0, 7);
    const start = Math.max(0, Math.min(plotWidth - text.length, x - Math.floor(text.length / 2)));
    for (let index = 0; index < text.length; index += 1) {
        const target = start + index;
        if (target < 0 || target >= line.length)
            continue;
        if (line[target] !== undefined && line[target] !== ' ')
            return;
    }
    for (let index = 0; index < text.length; index += 1) {
        const target = start + index;
        if (target >= 0 && target < line.length)
            line[target] = text[index] ?? ' ';
    }
}
function compactBinLabel(bin) {
    return `${formatNumber(bin.min)}-${formatNumber(bin.max)}`;
}
function formatBinLabel(min, max) {
    return `${formatNumber(min)} to ${formatNumber(max)}`;
}
function axisLabelsFor(maxCount, height) {
    return Array.from({ length: height }, (_, row) => {
        const value = maxCount - (row / Math.max(1, height - 1)) * maxCount;
        return formatNumber(value);
    });
}
function barCellHeight(value, maxValue, chartHeight) {
    if (value <= 0 || maxValue <= 0)
        return 0;
    return Math.max(1, Math.min(chartHeight, Math.round((value / maxValue) * chartHeight)));
}
function dimLine(ctx, text) {
    return ctx.color ? mutedText(text) : text;
}
function padCell(value, width, align) {
    const text = truncateLine(value, width);
    const padding = repeat(' ', Math.max(0, width - visualWidth(text)));
    return align === 'right' ? `${padding}${text}` : `${text}${padding}`;
}
function wrapLine(value, width) {
    const text = value.replace(/\s+/g, ' ').trimEnd();
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
        const charWidth = visualWidth(char);
        if (used + charWidth > width)
            break;
        used += charWidth;
        output += char;
    }
    return output;
}
function longest(values) {
    return Math.max(0, ...values.map(visualWidth));
}
function repeat(value, count) {
    return value.repeat(Math.max(0, count));
}
function formatNumber(value) {
    if (!Number.isFinite(value))
        return '0';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
}
function clampWidth(width) {
    if (width === undefined)
        return DEFAULT_WIDTH;
    return Math.max(MIN_WIDTH, Math.floor(width));
}
