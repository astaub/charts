// Terminal dashboard — compose KPI tiles + charts into one multi-panel grid.
//
// This is where the design system pays off: every kind already renders as a
// self-contained bordered panel of a known width, so a dashboard is just
// layout — render each cell at a column width, lay cells side-by-side into
// rows, stack the rows. The shared components make the panels read as one view.
//
// Depends on the kind renderers (one-way; index.ts does not import this), so
// there is no cycle.
import { renderBarChart, renderBigNumber, renderFunnelBars, renderGroupedBarChart, renderLineChart, renderRetentionHeatmap, renderScatterPlot, renderStackedBarChart, renderWaterfallChart, } from './index.js';
import { THEME, bold, dim, fg } from './theme.js';
import { makeRenderCtx, visualWidth } from './render-context.js';
const DEFAULT_WIDTH = 100;
const GAP = 2;
export function renderDashboard(rows, options = {}) {
    const ctx = makeRenderCtx(options);
    const width = Math.max(40, Math.floor(options.width ?? DEFAULT_WIDTH));
    if (!Array.isArray(rows) || rows.length === 0)
        return 'No dashboard panels.';
    const lines = [];
    if (options.title) {
        const title = sanitize(options.title);
        lines.push(ctx.color ? bold(fg(THEME.accent, title)) : title);
    }
    if (options.subtitle) {
        const subtitle = sanitize(options.subtitle);
        lines.push(ctx.color ? dim(subtitle) : subtitle);
    }
    if (lines.length > 0)
        lines.push('');
    rows.forEach((row, rowIndex) => {
        const panels = row.panels ?? [];
        if (panels.length === 0)
            return;
        // Split the width evenly across the row's cells (last cell absorbs the
        // rounding remainder so the row fills the full width).
        const count = panels.length;
        const base = Math.floor((width - GAP * (count - 1)) / count);
        const cellWidths = panels.map((_, i) => (i === count - 1 ? width - (base + GAP) * (count - 1) : base));
        const blocks = panels.map((panel, i) => renderCell(panel, cellWidths[i] ?? base, options).split('\n'));
        if (rowIndex > 0)
            lines.push('');
        lines.push(...joinHorizontal(blocks, GAP));
    });
    return lines.join('\n');
}
// Lay rendered blocks side-by-side: pad each to its own width and to the row's
// max height (blank lines below), then concatenate line-by-line with a gap.
function joinHorizontal(blocks, gap) {
    const widths = blocks.map((block) => Math.max(0, ...block.map((line) => visualWidth(line))));
    const height = Math.max(0, ...blocks.map((block) => block.length));
    const sep = ' '.repeat(gap);
    const out = [];
    for (let row = 0; row < height; row += 1) {
        out.push(blocks
            .map((block, i) => padEndVisual(block[row] ?? '', widths[i] ?? 0))
            .join(sep)
            .replace(/\s+$/u, ''));
    }
    return out;
}
function padEndVisual(value, width) {
    const w = visualWidth(value);
    return w >= width ? value : value + ' '.repeat(width - w);
}
// Render one cell (a chart kind) at a fixed column width, inheriting the
// dashboard's color decision so the whole board is colored consistently.
function renderCell(panel, width, dash) {
    const options = {
        ...(panel.options ?? {}),
        width,
        color: dash.color,
        isTTY: dash.isTTY,
        env: dash.env,
        ...(panel.title ? { title: panel.title } : {}),
    };
    const arr = (v) => (Array.isArray(v) ? v : []);
    switch (panel.chart) {
        case 'bar':
            return renderBarChart(arr(panel.rows ?? panel.data), options);
        case 'funnel':
            return renderFunnelBars(arr(panel.steps ?? panel.data), options);
        case 'line':
            return renderLineChart(arr(panel.series ?? panel.data), options);
        case 'retention':
            return renderRetentionHeatmap(arr(panel.cohorts ?? panel.data), options);
        case 'stacked':
            return renderStackedBarChart(arr(panel.buckets ?? panel.data), options);
        case 'grouped':
            return renderGroupedBarChart(arr(panel.buckets ?? panel.data), options);
        case 'waterfall':
            return renderWaterfallChart(arr(panel.steps ?? panel.data), options);
        case 'scatter':
            return renderScatterPlot(arr(panel.points ?? panel.data), options);
        case 'bignumber':
            return renderBigNumber(typeof panel.value === 'number' ? panel.value : Number(panel.data ?? 0), options);
        default:
            return '';
    }
}
function sanitize(value) {
    return value
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .replace(/\r?\n/g, ' ')
        .replace(/[<>]/g, '')
        .trim();
}
