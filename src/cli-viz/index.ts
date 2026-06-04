const DEFAULT_WIDTH = 80;
const NARROW_WIDTH = 54;
const MIN_WIDTH = 32;
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const SPARKLINE_BUCKETS = ['_', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const HEAT_BUCKETS = ['.', '░', '▒', '▓', '█'];

export {
  renderScatterPlot,
  type ScatterPlotOptions,
  type ScatterPlotPoint,
  type ScatterQuadrantLabels,
  type ScatterValueFormat,
} from './scatter.js';
export {
  renderStackedBarChart,
  type StackedBarBucketDatum,
  type StackedBarChartOptions,
  type StackedBarSegmentDatum,
} from './stacked.js';
export {
  renderGroupedBarChart,
  type GroupedBarBucketDatum,
  type GroupedBarChartOptions,
  type GroupedBarMarker,
  type GroupedBarSeriesDatum,
  type GroupedBarUnit,
  type GroupedBarValueFormat,
} from './grouped.js';
export {
  renderWaterfallChart,
  type WaterfallChartOptions,
  type WaterfallStep,
  type WaterfallStepKind,
} from './waterfall.js';
export {
  renderBigNumber,
  type BigNumberColorMode,
  type BigNumberFormat,
  type BigNumberOptions,
  type BigNumberUnit,
} from './bignumber.js';
import { BrailleCanvas } from './braille.js';
export { BrailleCanvas } from './braille.js';
import { THEME, rampShade, resolveColor, type ColorMode } from './theme.js';
import { meterTable, panel, type MeterRow, type RenderCtx } from './components.js';
export * from './theme.js';
export {
  colorLabel,
  legend,
  meter,
  meterTable,
  panel,
  swatch,
  type LegendItem,
  type MeterRow,
  type MeterTableSpec,
  type PanelOptions,
  type RenderCtx,
} from './components.js';

export type CliVizColorMode = 'never' | 'auto' | 'always';
export type CliVizAlign = 'left' | 'right';
export type CliVizFormat = 'text' | 'number' | 'percent' | 'ratio';

export interface CliVizOptions {
  width?: number;
  color?: CliVizColorMode;
  isTTY?: boolean;
  env?: Record<string, string | undefined>;
  barStyle?: 'ascii' | 'blocks';
  /** Panel title drawn into the top border (paneled charts only). */
  title?: string;
  /** Dim subtitle drawn just under the title. */
  subtitle?: string;
}

export interface SparklineOptions extends CliVizOptions {
  label?: string;
  emptyLabel?: string;
}

export interface BarChartDatum {
  label: string;
  value: number;
  denominator?: number;
}

export interface BarChartOptions extends CliVizOptions {
  denominator?: number;
}

export interface LineChartPoint {
  label: string;
  value: number;
}

export interface LineChartSeries {
  label: string;
  points: LineChartPoint[];
}

export type LineChartVlinePosition = 'above' | 'below';
export type LineChartShadePattern = 'hatch' | 'gray' | 'dotted';
export type LineChartXAxisLabels = 'auto' | 'stagger' | { skipEvery: number };
export type LineChartLineStyle = 'linear' | 'step' | 'markers-only' | 'braille';

export interface LineChartVline {
  at: string;
  label?: string;
  position?: LineChartVlinePosition;
}

export interface LineChartShade {
  from: string;
  to: string;
  label?: string;
  pattern?: LineChartShadePattern;
}

/** Format applied to y-axis values: 'percent' treats values as 0–1 ratios. */
export type LineChartValueFormat = 'number' | 'percent';

/** Unit affixes for y-axis values, e.g. { prefix: '$' } or { suffix: ' ms' }. */
export interface LineChartUnit {
  prefix?: string;
  suffix?: string;
}

export interface LineChartOptions extends CliVizOptions {
  height?: number;
  maxSeries?: number;
  vlines?: LineChartVline[];
  shades?: LineChartShade[];
  footer?: string;
  xAxisLabels?: LineChartXAxisLabels;
  lineStyle?: LineChartLineStyle;
  /** Horizontal target line drawn across the plot (e.g. a KPI goal). */
  goal?: number;
  /** Label for the goal line; defaults to "goal". */
  goalLabel?: string;
  /** Y-axis value format. 'percent' renders 0–1 ratios as percentages. */
  valueFormat?: LineChartValueFormat;
  /** Y-axis unit affixes applied to axis labels (ignored when valueFormat='percent'). */
  unit?: LineChartUnit;
}

export type FilterValue = string | number | boolean | null | Array<string | number | boolean | null>;

export interface FilterDatum {
  field: string;
  operator?: string;
  value?: FilterValue;
  scope?: string;
  source?: string;
  reason?: string;
}

export interface SuggestedFilterDatum extends FilterDatum {
  reason: string;
}

export interface FilterSummaryOptions extends CliVizOptions {
  title?: string;
  emptyLabel?: string;
  suggestions?: SuggestedFilterDatum[];
  maxFilters?: number;
  maxSuggestions?: number;
}

export interface TableColumn {
  key: string;
  label?: string;
  align?: CliVizAlign;
  format?: CliVizFormat;
  wrap?: boolean;
}

export type TableRow = Record<string, unknown>;

export interface TableOptions extends CliVizOptions {
  maxRows?: number;
}

export interface FunnelStepDatum {
  label: string;
  count: number;
  denominator?: number;
  /**
   * Authoritative conversion from the previous step (0–1). When provided, the
   * "Prev" column uses it verbatim instead of recomputing count/previous —
   * so source-defined funnel semantics (windows, unique-user math) survive.
   * Ignored for the first step.
   */
  previousRate?: number;
}

export interface RetentionPeriodDatum {
  label: string;
  count?: number;
  rate?: number;
}

export interface RetentionCohortDatum {
  label: string;
  size: number;
  periods: RetentionPeriodDatum[];
}

export function renderSparkline(values: number[], options: SparklineOptions = {}): string {
  const width = clampWidth(options.width);
  const label = sanitizeText(options.label ?? 'Sparkline');
  const emptyLabel = sanitizeText(options.emptyLabel ?? 'No sparkline data.');
  const finiteValues = values.filter(Number.isFinite);

  if (finiteValues.length === 0) return truncateLine(emptyLabel, width);

  const prefix = `${label}: `;
  const suffix = ` ${formatNumber(finiteValues[0] ?? 0)} → ${formatNumber(finiteValues[finiteValues.length - 1] ?? 0)}`;
  const available = Math.max(1, width - visualWidth(prefix) - visualWidth(suffix));
  const sampled = sampleSeries(finiteValues, available);
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const sparkline = sampled.map((value) => sparkChar(value, min, max)).join('');

  return fitLine(`${prefix}${sparkline}${suffix}`, width);
}

export function renderBarChart(rows: BarChartDatum[], options: BarChartOptions = {}): string {
  const width = clampWidth(options.width);
  if (rows.length === 0) return 'No bar chart data.';

  const optionDenominator = options.denominator === undefined ? undefined : numeric(options.denominator);
  const cleanRows = rows.map((row) => ({
    label: sanitizeText(row.label),
    value: numeric(row.value),
    denominator: row.denominator === undefined ? optionDenominator : numeric(row.denominator),
  }));
  const fallbackDenominator = cleanRows.reduce((sum, row) => sum + row.value, 0);
  const maxValue = Math.max(...cleanRows.map((row) => row.value), 0);

  const labelWidth = Math.min(24, Math.max(8, longest(cleanRows.map((row) => row.label))));

  // Beautiful paneled layout: color-coded label · capped sub-cell meter · value
  // · share, built on the shared meterTable so every bar-style chart matches.
  const ctx = makeRenderCtx(options);
  const meterRows: MeterRow[] = cleanRows.map((row, index) => ({
    label: row.label,
    color: rampShade(index, cleanRows.length),
    fraction: ratio(row.value, maxValue),
    values: [formatNumber(row.value), formatPercent(ratio(row.value, row.denominator ?? fallbackDenominator))],
  }));
  const body = meterTable(ctx, {
    rows: meterRows,
    headers: ['Value', 'Share'],
    labelWidth,
    inner: width - 4,
  });

  // Fall back to the plain stacked list when the panel can't host a legible meter.
  if (body === null || width < NARROW_WIDTH) {
    return renderBarChartBlocks(cleanRows, fallbackDenominator, width);
  }

  return panel(ctx, {
    body,
    width,
    accent: THEME.accent,
    ...(options.title ? { title: sanitizeText(options.title) } : {}),
    ...(options.subtitle ? { subtitle: sanitizeText(options.subtitle) } : {}),
  }).join('\n');
}

export function renderLineChart(series: LineChartSeries[], options: LineChartOptions = {}): string {
  const width = clampWidth(options.width);
  const cleanSeries = series
    .map((entry) => ({
      label: sanitizeText(entry.label),
      points: entry.points
        .filter((point) => Number.isFinite(point.value))
        .map((point) => ({
          label: sanitizeText(point.label),
          value: numeric(point.value),
        }))
    }))
    .filter((entry) => entry.points.length > 0)
    .slice(0, Math.max(1, options.maxSeries ?? 6));

  if (cleanSeries.length === 0) return 'No line chart data.';

  const buckets = lineChartBuckets(cleanSeries);
  if (buckets.length === 0) return 'No line chart buckets.';

  if (width < NARROW_WIDTH) {
    const narrowStyle: LineChartLineStyle = options.lineStyle ?? 'linear';
    const bodyLines: string[] = cleanSeries.map((entry) => {
      const values = entry.points.map((point) => point.value);
      if (narrowStyle === 'markers-only') {
        // Markers-only at narrow widths: render dots without a connecting
        // sparkline so the option's "no line" promise holds at every width.
        const dots = values.map(() => '●').join(' ');
        return fitLine(`${entry.label}: ${dots}`, width);
      }
      // 'step' falls through to the standard sparkline; its block characters
      // are inherently step-shaped (no diagonal interpolation), so the
      // step intent is already honored at narrow widths.
      return renderSparkline(values, { ...options, label: entry.label, width });
    });

    const annotationLines: string[] = [];

    // Vline summary: print labelled vlines as a compact tick listing so the
    // caller's product-change markers still surface at narrow widths even
    // though the chart body cannot draw the actual vertical bar.
    const narrowVlines = (options.vlines ?? []).filter(
      (vline) => buckets.includes(vline.at) && sanitizeText(vline.label ?? '').length > 0,
    );
    if (narrowVlines.length > 0) {
      const entries = narrowVlines.map((vline) => `${sanitizeText(vline.at)}=${sanitizeText(vline.label ?? '')}`);
      annotationLines.push(...wrapLine(`Marks: ${entries.join('  ')}`, width));
    }

    // Shade summary: print labelled shades as a compact span listing so the
    // not-comparable regions still surface even when the shade fill cannot.
    // Normalize endpoint order the same way the wide path does (see
    // resolveLineChartShades): callers can pass from/to in either order and
    // the rendered span should always read in bucket order.
    const narrowShades = (options.shades ?? [])
      .map((shade) => {
        const fromIndex = buckets.indexOf(shade.from);
        const toIndex = buckets.indexOf(shade.to);
        if (fromIndex < 0 || toIndex < 0) return undefined;
        const label = sanitizeText(shade.label ?? '');
        if (label.length === 0) return undefined;
        const startBucket = fromIndex <= toIndex ? shade.from : shade.to;
        const endBucket = fromIndex <= toIndex ? shade.to : shade.from;
        return {
          start: sanitizeText(startBucket),
          end: sanitizeText(endBucket),
          pattern: shade.pattern ?? 'gray',
          label,
        };
      })
      .filter((shade): shade is { start: string; end: string; pattern: LineChartShadePattern; label: string } => shade !== undefined);
    if (narrowShades.length > 0) {
      const entries = narrowShades.map(
        (shade) => `${shadePatternChar(shade.pattern)} ${shade.start}-${shade.end}=${shade.label}`,
      );
      annotationLines.push(...wrapLine(`Shaded: ${entries.join('  ')}`, width));
    }

    // Goal: surface the target as a compact annotation since the narrow body
    // (sparklines) cannot draw a horizontal reference line.
    if (typeof options.goal === 'number' && Number.isFinite(options.goal)) {
      annotationLines.push(...wrapLine(`${goalLabel(options)}: ${formatGoalValue(options.goal, options)}`, width));
    }

    // Footer: always render so provenance lines survive narrow widths. This
    // is the load-bearing fix per #1622 — callers attach query timestamps and
    // row counts here and lose audit-trail value when the footer disappears.
    if (typeof options.footer === 'string' && options.footer.trim().length > 0) {
      annotationLines.push(...wrapLine(options.footer, width));
    }

    const lines = annotationLines.length > 0 ? [...bodyLines, ...annotationLines] : bodyLines;
    return lines.map((line) => fitLine(line, width).trimEnd()).join('\n');
  }

  const values = cleanSeries.flatMap((entry) => buckets.map((bucket) => lineChartValue(entry, bucket)).filter((value): value is number => value !== undefined));
  const goal = typeof options.goal === 'number' && Number.isFinite(options.goal) ? options.goal : undefined;
  const rangeValues = goal === undefined ? values : [...values, goal];
  const minValue = Math.min(0, ...rangeValues);
  const maxValue = Math.max(...rangeValues, 0);
  const chartHeight = Math.max(4, Math.min(12, Math.floor(options.height ?? 8)));
  const axisTicks = lineChartAxisTicks(minValue, maxValue, chartHeight);
  const axisLabels = axisTicks.map((value) => formatLineChartAxisLabel(value, minValue, maxValue, options));
  const labelWidth = Math.max(5, longest(axisLabels));
  const plotWidth = Math.min(width - labelWidth - 3, Math.max(12, buckets.length * 16));
  const xPositions = lineChartXPositions(buckets.length, plotWidth);

  // Braille mode: render the plot body at 2×4 sub-cell resolution for smooth,
  // dense curves. Axis, x-labels, legend, and footer are assembled the same way
  // as the default renderer. The goal degrades to a legend annotation, and
  // vlines/shades degrade to compact marks — none are drawn into the braille
  // body (a dot row would be indistinguishable from a series).
  if ((options.lineStyle ?? 'linear') === 'braille') {
    return renderBrailleLineChart({
      cleanSeries,
      buckets,
      xPositions,
      plotWidth,
      chartHeight,
      labelWidth,
      axisLabels,
      minValue,
      maxValue,
      goal,
      width,
      options,
    });
  }

  const grid = Array.from({ length: chartHeight }, () => Array.from({ length: plotWidth }, () => ' '));

  // 1. Shades are drawn first so series and vlines paint on top.
  const resolvedShades = resolveLineChartShades(options.shades, buckets, xPositions);
  for (const shade of resolvedShades) {
    drawShade(grid, shade.startX, shade.endX, shadePatternChar(shade.pattern));
  }

  // 2. Vlines drawn before series so series markers win on collisions.
  const resolvedVlines = resolveLineChartVlines(options.vlines, buckets, xPositions);
  for (const vline of resolvedVlines) {
    drawVline(grid, vline.x);
  }

  const lineStyle: LineChartLineStyle = options.lineStyle ?? 'linear';

  cleanSeries.forEach((entry, seriesIndex) => {
    const marker = lineChartMarker(seriesIndex);
    const plotted = buckets
      .map((bucket, index) => {
        const value = lineChartValue(entry, bucket);
        if (value === undefined) return undefined;
        return {
          x: xPositions[index] ?? 0,
          y: lineChartY(value, minValue, maxValue, chartHeight),
        };
      })
      .filter((point): point is { x: number; y: number } => point !== undefined);

    if (lineStyle !== 'markers-only') {
      for (let index = 1; index < plotted.length; index += 1) {
        if (lineStyle === 'step') {
          drawStepSegment(grid, plotted[index - 1], plotted[index]);
        } else {
          drawLineSegment(grid, plotted[index - 1], plotted[index]);
        }
      }
    }

    for (const point of plotted) {
      plotChar(grid, point.x, point.y, marker);
    }
  });

  // Goal line: a dashed horizontal reference drawn only on empty cells, so
  // series lines and markers always win on a collision.
  if (goal !== undefined) {
    const goalRow = grid[lineChartY(goal, minValue, maxValue, chartHeight)];
    if (goalRow) {
      for (let x = 0; x < goalRow.length; x += 1) {
        if (goalRow[x] === ' ') goalRow[x] = '╌';
      }
    }
  }

  const lines: string[] = [];

  // Top vline labels (position: 'above', or default).
  const aboveLabels = renderVlineLabelLine(
    resolvedVlines.filter((vline) => (vline.position ?? 'above') === 'above'),
    labelWidth,
    plotWidth,
  );
  if (aboveLabels) lines.push(aboveLabels);

  for (let row = 0; row < chartHeight; row += 1) {
    lines.push(`${padCell(axisLabels[row] ?? '0', labelWidth, 'right')} | ${grid[row]?.join('').trimEnd() ?? ''}`);
  }
  lines.push(`${repeat(' ', labelWidth)} + ${repeat('-', Math.max(1, plotWidth))}`);

  const xAxisStrategy = options.xAxisLabels ?? 'auto';
  lines.push(...lineChartBucketLabelLines(buckets, xPositions, labelWidth, plotWidth, xAxisStrategy));

  // Below vline labels.
  const belowLabels = renderVlineLabelLine(
    resolvedVlines.filter((vline) => vline.position === 'below'),
    labelWidth,
    plotWidth,
  );
  if (belowLabels) lines.push(belowLabels);

  lines.push(...lineChartLegendLines(cleanSeries, width));

  // Goal legend.
  if (goal !== undefined) {
    lines.push(...goalLegendLine(goal, options, width));
  }

  // Shade legend.
  const shadeLegendLines = renderShadeLegendLines(options.shades, resolvedShades, width);
  if (shadeLegendLines.length > 0) lines.push(...shadeLegendLines);

  // Footer.
  if (typeof options.footer === 'string' && options.footer.trim().length > 0) {
    lines.push('');
    lines.push(...wrapLine(options.footer, width));
  }

  return lines.map((line) => fitLine(line, width).trimEnd()).join('\n');
}

export function renderFilterSummary(filters: FilterDatum[], options: FilterSummaryOptions = {}): string {
  const width = clampWidth(options.width);
  const cleanFilters = filters.map(normalizeFilter).filter((filter) => filter.field.length > 0);
  const cleanSuggestions = (options.suggestions ?? [])
    .map(normalizeSuggestedFilter)
    .filter((filter) => filter.field.length > 0 && filter.reason.length > 0);
  const maxFilters = Math.max(0, options.maxFilters ?? cleanFilters.length);
  const maxSuggestions = Math.max(0, options.maxSuggestions ?? cleanSuggestions.length);

  if (cleanFilters.length === 0 && cleanSuggestions.length === 0) {
    return truncateLine(options.emptyLabel ?? 'No filters.', width);
  }

  const lines: string[] = [];
  const title = sanitizeText(options.title ?? 'Filters');
  if (title) lines.push(truncateLine(title, width));

  if (cleanFilters.length > 0) {
    for (const filter of cleanFilters.slice(0, maxFilters)) {
      lines.push(...bulletLines(formatFilter(filter), width));
    }
    if (cleanFilters.length > maxFilters) {
      lines.push(...bulletLines(`${formatNumber(cleanFilters.length - maxFilters)} more filter(s)`, width));
    }
  }

  if (cleanSuggestions.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(truncateLine('Suggested filters', width));
    for (const filter of cleanSuggestions.slice(0, maxSuggestions)) {
      lines.push(...bulletLines(formatFilter(filter), width));
    }
    if (cleanSuggestions.length > maxSuggestions) {
      lines.push(...bulletLines(`${formatNumber(cleanSuggestions.length - maxSuggestions)} more suggestion(s)`, width));
    }
  }

  return lines.map((line) => fitLine(line, width).trimEnd()).join('\n');
}

export function renderTable(rows: TableRow[], columns: TableColumn[], options: TableOptions = {}): string {
  const width = clampWidth(options.width);
  const visibleRows = rows.slice(0, Math.max(0, options.maxRows ?? rows.length));
  const safeColumns = columns.map((column) => ({
    ...column,
    label: sanitizeText(column.label ?? titleize(column.key)),
  }));

  if (safeColumns.length === 0) return 'No columns.';
  if (visibleRows.length === 0) return 'No rows.';

  if (width < NARROW_WIDTH || shouldRenderTableAsBlocks(visibleRows, safeColumns, width)) {
    return renderTableBlocks(visibleRows, safeColumns, rows.length, width);
  }

  const widths = tableColumnWidths(visibleRows, safeColumns, width);
  const lines = [
    safeColumns.map((column, index) => padCell(column.label ?? column.key, widths[index] ?? 0, 'left')).join('  '),
    widths.map((columnWidth) => repeat('-', columnWidth)).join('  '),
  ];

  for (const row of visibleRows) {
    const cellLines = safeColumns.map((column, index) => {
      const formatted = formatTableValue(row[column.key], column.format);
      return column.wrap ? wrapLine(formatted, widths[index] ?? 0) : [truncateLine(formatted, widths[index] ?? 0)];
    });
    const height = Math.max(...cellLines.map((cell) => cell.length));
    for (let lineIndex = 0; lineIndex < height; lineIndex += 1) {
      lines.push(
        safeColumns
          .map((column, columnIndex) => {
            const value = cellLines[columnIndex]?.[lineIndex] ?? '';
            return padCell(value, widths[columnIndex] ?? 0, column.align ?? inferAlign(row[column.key]));
          })
          .join('  '),
      );
    }
  }

  if (rows.length > visibleRows.length) {
    lines.push(`... ${formatNumber(rows.length - visibleRows.length)} more rows`);
  }

  return lines.map((line) => fitLine(line, width).trimEnd()).join('\n');
}

export function renderFunnelBars(steps: FunnelStepDatum[], options: CliVizOptions = {}): string {
  const width = clampWidth(options.width);
  if (steps.length === 0) return 'No funnel steps.';

  const cleanSteps = steps.map((step) => ({
    label: sanitizeText(step.label),
    count: numeric(step.count),
    denominator: step.denominator === undefined ? undefined : numeric(step.denominator),
    previousRate: step.previousRate === undefined ? undefined : numeric(step.previousRate),
  }));
  const firstCount = cleanSteps[0]?.count ?? 0;
  const maxCount = Math.max(...cleanSteps.map((step) => step.count), 0);

  const labelWidth = Math.min(22, Math.max(8, longest(cleanSteps.map((step) => step.label))));

  // Beautiful paneled funnel: color-coded step (deep → light as it drains) ·
  // capped sub-cell meter · count · retain-of-first · from-previous conversion.
  const ctx = makeRenderCtx(options);
  const meterRows: MeterRow[] = cleanSteps.map((step, index) => {
    const previous = index === 0 ? undefined : cleanSteps[index - 1]?.count ?? 0;
    const prev = previous === undefined ? 'start' : formatPercent(step.previousRate ?? ratio(step.count, previous));
    return {
      label: step.label,
      color: rampShade(index, cleanSteps.length),
      fraction: ratio(step.count, maxCount),
      values: [formatNumber(step.count), formatPercent(ratio(step.count, firstCount)), prev],
    };
  });
  const body = meterTable(ctx, {
    rows: meterRows,
    headers: ['Count', 'Retain', 'Prev'],
    labelWidth,
    inner: width - 4,
  });

  if (body === null || width < NARROW_WIDTH) {
    return renderFunnelBlocks(cleanSteps, firstCount, width);
  }

  return panel(ctx, {
    body,
    width,
    accent: THEME.accent,
    ...(options.title ? { title: sanitizeText(options.title) } : {}),
    ...(options.subtitle ? { subtitle: sanitizeText(options.subtitle) } : {}),
  }).join('\n');
}

export function renderRetentionHeatmap(cohorts: RetentionCohortDatum[], options: CliVizOptions = {}): string {
  const width = clampWidth(options.width);
  if (cohorts.length === 0) return 'No retention cohorts.';

  const colorEnabled = resolveColorEnabled(options);
  const cleanCohorts = cohorts.map((cohort) => ({
    label: sanitizeText(cohort.label),
    size: numeric(cohort.size),
    periods: cohort.periods.map((period) => ({
      label: sanitizeText(period.label),
      count: period.count === undefined ? undefined : numeric(period.count),
      rate: period.rate,
    })),
  }));
  const periodLabels = retentionPeriodLabels(cleanCohorts);
  if (periodLabels.length === 0) return 'No retention periods.';

  const labelWidth = Math.min(18, Math.max(6, longest(cleanCohorts.map((cohort) => cohort.label))));
  const sizeWidth = Math.max(4, longest(cleanCohorts.map((cohort) => formatNumber(cohort.size))));
  const periodWidths = periodLabels.map((periodLabel) => {
    const values = cleanCohorts.map((cohort) => formatRetentionCell(findRetentionPeriod(cohort, periodLabel), cohort.size, false));
    return Math.max(visualWidth(periodLabel), ...values.map(visualWidth));
  });
  const tableWidth = labelWidth + sizeWidth + periodWidths.reduce((sum, next) => sum + next, 0) + (periodLabels.length + 1) * 2;

  if (width < NARROW_WIDTH || tableWidth > width) {
    return cleanCohorts
      .flatMap((cohort, index) => [
        ...(index > 0 ? [''] : []),
        `${index + 1}. ${truncateLine(cohort.label, width - 3)}`,
        `   size: ${formatNumber(cohort.size)}`,
        ...periodLabels.flatMap((periodLabel) => wrapLine(`   ${periodLabel}: ${formatRetentionCell(findRetentionPeriod(cohort, periodLabel), cohort.size, false)}`, width)),
      ])
      .join('\n');
  }

  const lines = [
    [
      padCell('Cohort', labelWidth, 'left'),
      padCell('Size', sizeWidth, 'right'),
      ...periodLabels.map((periodLabel, index) => padCell(periodLabel, periodWidths[index] ?? 0, 'right')),
    ].join('  '),
    [
      repeat('-', labelWidth),
      repeat('-', sizeWidth),
      ...periodWidths.map((periodWidth) => repeat('-', periodWidth)),
    ].join('  '),
  ];

  for (const cohort of cleanCohorts) {
    lines.push(
      [
        padCell(cohort.label, labelWidth, 'left'),
        padCell(formatNumber(cohort.size), sizeWidth, 'right'),
        ...periodLabels.map((periodLabel, index) =>
          padDisplayCell(formatRetentionCell(findRetentionPeriod(cohort, periodLabel), cohort.size, colorEnabled), periodWidths[index] ?? 0, 'right'),
        ),
      ].join('  '),
    );
  }

  return lines.map((line) => (colorEnabled ? fitAnsiLine(line, width) : fitLine(line, width)).trimEnd()).join('\n');
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

export function resolveColorEnabled(options: CliVizOptions = {}): boolean {
  const env = options.env ?? process.env;
  if (options.color === 'never') return false;
  if (env.NO_COLOR !== undefined) return false;
  if (options.color === 'always') return true;
  if (options.color === 'auto') return options.isTTY ?? process.stdout.isTTY === true;
  return false;
}

// Bundles the color decision and the (single) display-width helpers into the
// context the shared components draw with. Every paneled chart builds one of
// these so chrome, color, and width math stay consistent across kinds.
function makeRenderCtx(options: CliVizOptions): RenderCtx {
  return {
    color: resolveColor({ color: options.color as ColorMode | undefined, isTTY: options.isTTY, env: options.env }),
    visualWidth,
    truncate: truncateLine,
  };
}

function renderBarChartBlocks(
  rows: Array<{ label: string; value: number; denominator?: number }>,
  fallbackDenominator: number,
  width: number,
): string {
  return rows
    .flatMap((row, index) => {
      const denominator = row.denominator ?? fallbackDenominator;
      return [
        ...(index > 0 ? [''] : []),
        `${index + 1}. ${truncateLine(row.label, width - 3)}`,
        ...wrapLine(`   value: ${formatCountRatio(row.value, denominator)}`, width),
      ];
    })
    .join('\n');
}

function renderFunnelBlocks(
  steps: Array<{ label: string; count: number; denominator?: number; previousRate?: number }>,
  firstCount: number,
  width: number,
): string {
  return steps
    .flatMap((step, index) => {
      const denominator = step.denominator ?? firstCount;
      const previous = index === 0 ? undefined : steps[index - 1]?.count ?? 0;
      return [
        ...(index > 0 ? [''] : []),
        `${index + 1}. ${truncateLine(step.label, width - 3)}`,
        ...wrapLine(`   count: ${formatCountRatio(step.count, denominator)}`, width),
        ...(previous === undefined ? [] : [`   from previous: ${formatPercent(step.previousRate ?? ratio(step.count, previous))}`]),
        `   of first step: ${formatPercent(ratio(step.count, firstCount))}`,
      ];
    })
    .join('\n');
}

function renderTableBlocks(rows: TableRow[], columns: TableColumn[], totalRows: number, width: number): string {
  const lines: string[] = [];
  rows.forEach((row, rowIndex) => {
    if (rowIndex > 0) lines.push('');
    lines.push(`${rowIndex + 1}.`);
    for (const column of columns) {
      const label = sanitizeText(column.label ?? column.key);
      const value = formatTableValue(row[column.key], column.format);
      lines.push(...wrapLine(`  ${label}: ${value}`, width));
    }
  });

  if (totalRows > rows.length) {
    lines.push(`... ${formatNumber(totalRows - rows.length)} more rows`);
  }

  return lines.join('\n');
}

function lineChartBuckets(series: LineChartSeries[]): string[] {
  const seen = new Set<string>();
  for (const entry of series) {
    for (const point of entry.points) seen.add(point.label);
  }
  return [...seen];
}

function lineChartValue(series: LineChartSeries, bucket: string): number | undefined {
  return series.points.find((point) => point.label === bucket)?.value;
}

function lineChartAxisTicks(minValue: number, maxValue: number, height: number): number[] {
  return Array.from({ length: height }, (_, row) =>
    maxValue - (row / Math.max(1, height - 1)) * (maxValue - minValue)
  );
}

function formatLineChartAxisValue(value: number, minValue: number, maxValue: number): string {
  const maxMagnitude = Math.max(Math.abs(minValue), Math.abs(maxValue));
  if (!Number.isFinite(value)) return '0';
  if (maxMagnitude > 0 && maxMagnitude < 1) {
    const fractionDigits = maxMagnitude >= 0.1 ? 2 : maxMagnitude >= 0.01 ? 3 : maxMagnitude >= 0.001 ? 4 : 6;
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: fractionDigits }).format(value);
  }
  return formatNumber(value);
}

/**
 * Axis-label formatter that honors valueFormat / unit. Percentages assume the
 * value is a 0–1 ratio; otherwise the magnitude-aware base format is wrapped
 * in the caller's unit prefix/suffix.
 */
function formatLineChartAxisLabel(
  value: number,
  minValue: number,
  maxValue: number,
  options: LineChartOptions,
): string {
  if (options.valueFormat === 'percent') return formatPercent(value);
  const base = formatLineChartAxisValue(value, minValue, maxValue);
  return `${options.unit?.prefix ?? ''}${base}${options.unit?.suffix ?? ''}`;
}

/** Goal-label formatter that does not depend on the axis min/max scaling. */
function formatGoalValue(goal: number, options: LineChartOptions): string {
  if (options.valueFormat === 'percent') return formatPercent(goal);
  return `${options.unit?.prefix ?? ''}${formatNumber(goal)}${options.unit?.suffix ?? ''}`;
}

function goalLabel(options: LineChartOptions): string {
  return sanitizeText(options.goalLabel ?? 'Goal');
}

/** The dashed goal legend line used by the wide and braille renderers. */
function goalLegendLine(goal: number, options: LineChartOptions, width: number): string[] {
  return wrapLine(`${goalLabel(options)} ╌ ${formatGoalValue(goal, options)}`, width);
}

interface BrailleLineChartArgs {
  cleanSeries: LineChartSeries[];
  buckets: string[];
  xPositions: number[];
  plotWidth: number;
  chartHeight: number;
  labelWidth: number;
  axisLabels: string[];
  minValue: number;
  maxValue: number;
  goal: number | undefined;
  width: number;
  options: LineChartOptions;
}

function renderBrailleLineChart(args: BrailleLineChartArgs): string {
  const {
    cleanSeries, buckets, xPositions, plotWidth, chartHeight,
    labelWidth, axisLabels, minValue, maxValue, goal, width, options,
  } = args;

  const canvas = new BrailleCanvas(plotWidth, chartHeight);
  const dotHeight = canvas.dotHeight;
  const toDotY = (value: number): number => {
    if (maxValue === minValue) return Math.floor((dotHeight - 1) / 2);
    const normalized = (value - minValue) / (maxValue - minValue);
    return Math.max(0, Math.min(dotHeight - 1, Math.round((1 - normalized) * (dotHeight - 1))));
  };

  for (const entry of cleanSeries) {
    const plotted = buckets
      .map((bucket, index) => {
        const value = lineChartValue(entry, bucket);
        if (value === undefined) return undefined;
        return { x: (xPositions[index] ?? 0) * 2, y: toDotY(value) };
      })
      .filter((point): point is { x: number; y: number } => point !== undefined);
    if (plotted.length === 1) {
      const only = plotted[0];
      if (only) canvas.set(only.x, only.y);
    }
    for (let index = 1; index < plotted.length; index += 1) {
      const a = plotted[index - 1];
      const b = plotted[index];
      if (a && b) canvas.line(a.x, a.y, b.x, b.y);
    }
  }

  const bodyRows = canvas.toRows();
  const lines: string[] = [];
  for (let row = 0; row < chartHeight; row += 1) {
    lines.push(`${padCell(axisLabels[row] ?? '0', labelWidth, 'right')} | ${(bodyRows[row] ?? '').trimEnd()}`);
  }
  lines.push(`${repeat(' ', labelWidth)} + ${repeat('-', Math.max(1, plotWidth))}`);
  lines.push(...lineChartBucketLabelLines(buckets, xPositions, labelWidth, plotWidth, options.xAxisLabels ?? 'auto'));
  lines.push(...lineChartLegendLines(cleanSeries, width));

  if (goal !== undefined) {
    lines.push(...goalLegendLine(goal, options, width));
  }

  // vlines/shades are not drawn into the braille body; surface them as compact
  // labelled marks so nothing is silently dropped.
  const markEntries = (options.vlines ?? [])
    .filter((vline) => buckets.includes(vline.at) && sanitizeText(vline.label ?? '').length > 0)
    .map((vline) => `${sanitizeText(vline.at)}=${sanitizeText(vline.label ?? '')}`);
  if (markEntries.length > 0) lines.push(...wrapLine(`Marks: ${markEntries.join('  ')}`, width));
  const shadeEntries = (options.shades ?? [])
    .filter((shade) => buckets.includes(shade.from) && buckets.includes(shade.to) && sanitizeText(shade.label ?? '').length > 0)
    .map((shade) => {
      // Normalize endpoint order so the span always reads in bucket order,
      // matching the narrow non-braille path (callers may pass from/to reversed).
      const fromFirst = buckets.indexOf(shade.from) <= buckets.indexOf(shade.to);
      const start = fromFirst ? shade.from : shade.to;
      const end = fromFirst ? shade.to : shade.from;
      return `${sanitizeText(start)}-${sanitizeText(end)}=${sanitizeText(shade.label ?? '')}`;
    });
  if (shadeEntries.length > 0) lines.push(...wrapLine(`Shaded: ${shadeEntries.join('  ')}`, width));

  if (typeof options.footer === 'string' && options.footer.trim().length > 0) {
    lines.push('');
    lines.push(...wrapLine(options.footer, width));
  }

  return lines.map((line) => fitLine(line, width).trimEnd()).join('\n');
}

function lineChartXPositions(count: number, plotWidth: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, index) => Math.round((index / (count - 1)) * (plotWidth - 1)));
}

function lineChartY(value: number, minValue: number, maxValue: number, height: number): number {
  if (maxValue === minValue) return Math.floor((height - 1) / 2);
  const normalized = (value - minValue) / (maxValue - minValue);
  return Math.max(0, Math.min(height - 1, Math.round((1 - normalized) * (height - 1))));
}

function lineChartMarker(index: number): string {
  return ['●', '◆', '■', '▲', '✚', '○'][index % 6] ?? '●';
}

function drawStepSegment(grid: string[][], start: { x: number; y: number } | undefined, end: { x: number; y: number } | undefined): void {
  if (!start || !end) return;
  if (start.x === end.x) {
    // Vertical-only step: paint between the two markers (exclusive endpoints).
    const yStart = Math.min(start.y, end.y) + 1;
    const yEnd = Math.max(start.y, end.y) - 1;
    for (let y = yStart; y <= yEnd; y += 1) plotChar(grid, start.x, y, '│', true);
    return;
  }

  const xLeft = Math.min(start.x, end.x);
  const xRight = Math.max(start.x, end.x);
  const leftY = start.x <= end.x ? start.y : end.y;
  const rightY = start.x <= end.x ? end.y : start.y;

  // Horizontal segment at the previous (left) y-level. Stop one cell short of
  // the right endpoint so the vertical riser has somewhere to land without
  // overpainting a marker.
  for (let x = xLeft + 1; x < xRight; x += 1) {
    plotChar(grid, x, leftY, '─', true);
  }

  // Vertical transition at the right edge. Include the old y-level (the
  // corner cell) so the horizontal run connects to the riser without a gap;
  // the endpoint marker at (xRight, rightY) still wins for its own cell via
  // overdraw later. Skip only the new y-level cell to avoid overpainting the
  // marker before it's drawn.
  if (leftY !== rightY) {
    const yStart = Math.min(leftY, rightY);
    const yEnd = Math.max(leftY, rightY);
    for (let y = yStart; y <= yEnd; y += 1) {
      if (y === rightY) continue;
      plotChar(grid, xRight, y, '│', true);
    }
  }
}

function drawLineSegment(grid: string[][], start: { x: number; y: number } | undefined, end: { x: number; y: number } | undefined): void {
  if (!start || !end) return;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps <= 1) return;

  for (let step = 1; step < steps; step += 1) {
    const x = Math.round(start.x + (dx * step) / steps);
    const y = Math.round(start.y + (dy * step) / steps);
    const char = dy === 0 ? '─' : dy > 0 ? '╲' : '╱';
    plotChar(grid, x, y, char, true);
  }
}

const SHADE_OR_VLINE_CHARS = new Set(['│', '░', '▒', '·']);

function plotChar(grid: string[][], x: number, y: number, char: string, lineOnly = false): void {
  const row = grid[y];
  if (!row || x < 0 || x >= row.length) return;
  const current = row[x] ?? ' ';
  if (current !== ' ' && current !== char) {
    // Shade fill and vline annotations are background; lines and markers paint over them cleanly.
    if (SHADE_OR_VLINE_CHARS.has(current)) {
      row[x] = char;
      return;
    }
    if (lineOnly) {
      if (['●', '◆', '■', '▲', '✚', '○'].includes(current)) return;
      row[x] = current;
      return;
    }
    row[x] = '*';
    return;
  }
  row[x] = char;
}

function lineChartBucketLabelLines(
  buckets: string[],
  xPositions: number[],
  labelWidth: number,
  plotWidth: number,
  strategy: LineChartXAxisLabels = 'auto',
): string[] {
  const prefix = `${repeat(' ', labelWidth)}   `;

  if (strategy === 'stagger') {
    const rowA = Array.from({ length: plotWidth }, () => ' ');
    const rowB = Array.from({ length: plotWidth }, () => ' ');
    buckets.forEach((bucket, index) => {
      const target = index % 2 === 0 ? rowA : rowB;
      paintBucketLabel(target, bucket, xPositions[index] ?? 0, plotWidth);
    });
    return [
      `${prefix}${rowA.join('').trimEnd()}`,
      `${prefix}${rowB.join('').trimEnd()}`,
    ];
  }

  const skipEvery = resolveSkipEvery(strategy, buckets, xPositions, plotWidth);
  const line = Array.from({ length: plotWidth }, () => ' ');

  buckets.forEach((bucket, index) => {
    if (skipEvery > 1 && index % skipEvery !== 0) return;
    paintBucketLabel(line, bucket, xPositions[index] ?? 0, plotWidth);
  });

  return [`${prefix}${line.join('').trimEnd()}`];
}

function paintBucketLabel(line: string[], bucket: string, x: number, plotWidth: number): void {
  const label = bucket.slice(0, 7);
  const start = Math.max(0, Math.min(plotWidth - label.length, x - Math.floor(label.length / 2)));
  // Refuse to paint if any target cell is already filled; better to drop
  // this label entirely than corrupt a neighbor by overwriting it.
  for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
    const target = start + charIndex;
    if (target < 0 || target >= line.length) continue;
    if (line[target] !== undefined && line[target] !== ' ') return;
  }
  for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
    const target = start + charIndex;
    if (target >= 0 && target < line.length) line[target] = label[charIndex] ?? ' ';
  }
}

function resolveSkipEvery(
  strategy: LineChartXAxisLabels,
  buckets: string[],
  xPositions: number[],
  plotWidth: number,
): number {
  if (typeof strategy === 'object' && strategy !== null) {
    const requested = Math.floor(strategy.skipEvery);
    return Number.isFinite(requested) && requested > 0 ? requested : 1;
  }
  if (strategy !== 'auto') return 1;

  // auto: pick smallest skipEvery that prevents label overlap. Walk up
  // through all possible skip values (bounded by bucket count) so very
  // dense axes never fall back to a smaller skip that still collides.
  const maxSkip = Math.max(1, buckets.length);
  for (let candidate = 1; candidate <= maxSkip; candidate += 1) {
    if (!labelsCollide(buckets, xPositions, plotWidth, candidate)) return candidate;
  }
  return maxSkip;
}

function labelsCollide(buckets: string[], xPositions: number[], plotWidth: number, skipEvery: number): boolean {
  let previousEnd = -1;
  for (let index = 0; index < buckets.length; index += 1) {
    if (skipEvery > 1 && index % skipEvery !== 0) continue;
    const bucket = buckets[index] ?? '';
    const label = bucket.slice(0, 7);
    if (label.length === 0) continue;
    const x = xPositions[index] ?? 0;
    const start = Math.max(0, Math.min(plotWidth - label.length, x - Math.floor(label.length / 2)));
    const end = start + label.length;
    if (start <= previousEnd) return true;
    previousEnd = end;
  }
  return false;
}

interface ResolvedVline {
  x: number;
  label: string;
  position: LineChartVlinePosition;
}

interface ResolvedShade {
  startX: number;
  endX: number;
  pattern: LineChartShadePattern;
  label: string;
}

function resolveLineChartVlines(
  vlines: LineChartVline[] | undefined,
  buckets: string[],
  xPositions: number[],
): ResolvedVline[] {
  if (!vlines || vlines.length === 0) return [];
  const resolved: ResolvedVline[] = [];
  for (const vline of vlines) {
    const index = buckets.indexOf(vline.at);
    if (index < 0) continue;
    const x = xPositions[index];
    if (x === undefined) continue;
    resolved.push({
      x,
      label: sanitizeText(vline.label ?? ''),
      position: vline.position ?? 'above',
    });
  }
  return resolved;
}

function resolveLineChartShades(
  shades: LineChartShade[] | undefined,
  buckets: string[],
  xPositions: number[],
): ResolvedShade[] {
  if (!shades || shades.length === 0) return [];
  const resolved: ResolvedShade[] = [];
  for (const shade of shades) {
    const fromIndex = buckets.indexOf(shade.from);
    const toIndex = buckets.indexOf(shade.to);
    if (fromIndex < 0 || toIndex < 0) continue;
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);
    const startX = xPositions[startIndex];
    const endX = xPositions[endIndex];
    if (startX === undefined || endX === undefined) continue;
    resolved.push({
      startX,
      endX,
      pattern: shade.pattern ?? 'gray',
      label: sanitizeText(shade.label ?? ''),
    });
  }
  return resolved;
}

function drawShade(grid: string[][], startX: number, endX: number, char: string): void {
  if (endX < startX) return;
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    if (!row) continue;
    for (let x = startX; x <= endX; x += 1) {
      if (x < 0 || x >= row.length) continue;
      if (row[x] === ' ') row[x] = char;
    }
  }
}

function drawVline(grid: string[][], x: number): void {
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    if (!row) continue;
    if (x < 0 || x >= row.length) continue;
    // Vlines paint over shade chars but yield to series lines and markers
    // (those are drawn later via plotChar, which knows how to overpaint a vline).
    const current = row[x] ?? ' ';
    if (current === ' ' || current === '░' || current === '▒' || current === '·') {
      row[x] = '│';
    }
  }
}

function shadePatternChar(pattern: LineChartShadePattern): string {
  if (pattern === 'hatch') return '▒';
  if (pattern === 'dotted') return '·';
  return '░';
}

function renderVlineLabelLine(
  vlines: ResolvedVline[],
  labelWidth: number,
  plotWidth: number,
): string | undefined {
  if (vlines.length === 0) return undefined;
  const printable = vlines.filter((vline) => vline.label.length > 0);
  if (printable.length === 0) return undefined;
  const line = Array.from({ length: plotWidth }, () => ' ');
  for (const vline of printable) {
    const label = vline.label;
    const start = Math.max(0, Math.min(plotWidth - label.length, vline.x - Math.floor(label.length / 2)));
    // Same refusal rule as paintBucketLabel: never overpaint a neighbor.
    // Drop this label entirely if any target cell is already filled.
    let collides = false;
    for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
      const target = start + charIndex;
      if (target < 0 || target >= line.length) continue;
      if (line[target] !== undefined && line[target] !== ' ') {
        collides = true;
        break;
      }
    }
    if (collides) continue;
    for (let charIndex = 0; charIndex < label.length; charIndex += 1) {
      const target = start + charIndex;
      if (target >= 0 && target < line.length) line[target] = label[charIndex] ?? ' ';
    }
  }
  return `${repeat(' ', labelWidth)}   ${line.join('').trimEnd()}`;
}

function renderShadeLegendLines(
  shades: LineChartShade[] | undefined,
  resolved: ResolvedShade[],
  width: number,
): string[] {
  if (!shades || resolved.length === 0) return [];
  const labelled = resolved.filter((shade) => shade.label.length > 0);
  if (labelled.length === 0) return [];
  const entries = labelled.map((shade) => `${shadePatternChar(shade.pattern)} ${shade.label}`);
  return wrapLine(`Shaded: ${entries.join('  ')}`, width);
}

function lineChartLegendLines(series: Array<{ label: string }>, width: number): string[] {
  const legend = series.map((entry, index) => `${lineChartMarker(index)} ${entry.label}`).join('  ');
  return wrapLine(`Legend: ${legend}`, width);
}

function normalizeFilter(filter: FilterDatum): Required<Omit<FilterDatum, 'value'>> & { value?: FilterValue } {
  return {
    field: sanitizeText(filter.field),
    operator: sanitizeOperator(filter.operator ?? ''),
    value: filter.value,
    scope: sanitizeText(filter.scope ?? ''),
    source: sanitizeText(filter.source ?? ''),
    reason: sanitizeText(filter.reason ?? ''),
  };
}

function normalizeSuggestedFilter(filter: SuggestedFilterDatum): Required<Omit<SuggestedFilterDatum, 'value'>> & { value?: FilterValue } {
  return {
    ...normalizeFilter(filter),
    reason: sanitizeText(filter.reason),
  };
}

function formatFilter(filter: Required<Omit<FilterDatum, 'value'>> & { value?: FilterValue }): string {
  const prefix = filter.scope ? `${filter.scope}: ` : '';
  const operator = filter.operator || (filter.value === undefined ? '' : '=');
  const value = filter.value === undefined ? '' : ` ${formatFilterValue(filter.value)}`;
  const source = filter.source ? ` (${filter.source})` : '';
  const reason = filter.reason ? ` - ${filter.reason}` : '';
  return `${prefix}${filter.field}${operator ? ` ${operator}` : ''}${value}${source}${reason}`;
}

function formatFilterValue(value: FilterValue): string {
  if (Array.isArray(value)) return `[${value.map(formatFilterScalar).join(', ')}]`;
  return formatFilterScalar(value);
}

function formatFilterScalar(value: string | number | boolean | null): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return sanitizeText(value);
}

function bulletLines(value: string, width: number): string[] {
  const wrapped = wrapLine(value, Math.max(1, width - 2));
  return wrapped.map((line, index) => `${index === 0 ? '- ' : '  '}${line}`);
}

function shouldRenderTableAsBlocks(rows: TableRow[], columns: TableColumn[], width: number): boolean {
  const separators = Math.max(0, columns.length - 1) * 2;
  const minimum = columns.reduce((sum, column) => {
    if (columnNeedsExactWidth(rows, column)) {
      return sum + naturalColumnWidth(rows, column);
    }
    return sum + Math.min(10, Math.max(4, visualWidth(column.label ?? column.key)));
  }, separators);

  return minimum > width;
}

function tableColumnWidths(rows: TableRow[], columns: TableColumn[], width: number): number[] {
  const natural = columns.map((column) => naturalColumnWidth(rows, column));
  const minimums = columns.map((column) => {
    if (columnNeedsExactWidth(rows, column)) return naturalColumnWidth(rows, column);
    return Math.min(10, Math.max(4, visualWidth(column.label ?? column.key)));
  });
  const separators = Math.max(0, columns.length - 1) * 2;
  const available = Math.max(columns.length * 4, width - separators);
  const naturalTotal = natural.reduce((sum, next) => sum + next, 0);

  if (naturalTotal <= available) return natural;

  const widths = natural.map((columnWidth, index) => Math.max(minimums[index] ?? 4, Math.floor((columnWidth / naturalTotal) * available)));
  let current = widths.reduce((sum, next) => sum + next, 0);

  while (current > available) {
    const index = widestShrinkable(widths, minimums);
    if (index === -1) break;
    widths[index] -= 1;
    current -= 1;
  }

  while (current < available) {
    const index = widestExpandable(widths, natural);
    if (index === -1) break;
    widths[index] += 1;
    current += 1;
  }

  return widths;
}

function naturalColumnWidth(rows: TableRow[], column: TableColumn): number {
  return Math.max(
    visualWidth(column.label ?? column.key),
    ...rows.flatMap((row) => {
      const value = formatTableValue(row[column.key], column.format);
      return column.wrap ? wrapLine(value, 24).map(visualWidth) : [visualWidth(value)];
    }),
  );
}

function columnNeedsExactWidth(rows: TableRow[], column: TableColumn): boolean {
  if (column.format === 'number' || column.format === 'percent' || column.format === 'ratio') return true;
  return rows.some((row) => typeof row[column.key] === 'number');
}

function formatTableValue(value: unknown, format: CliVizFormat | undefined): string {
  if (value === null || value === undefined) return '-';
  if (format === 'number') return formatNumber(numeric(value));
  if (format === 'percent') return formatPercent(numeric(value));
  if (format === 'ratio' && Array.isArray(value) && value.length >= 2) {
    return formatCountRatio(numeric(value[0]), numeric(value[1]));
  }
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return sanitizeText(String(value));
}

function inferAlign(value: unknown): CliVizAlign {
  return typeof value === 'number' ? 'right' : 'left';
}

function formatRetentionCell(
  period: { count?: number; rate?: number } | undefined,
  cohortSize: number,
  colorEnabled: boolean,
): string {
  if (!period) return '-';
  const hasCount = period.count !== undefined;
  const count = hasCount ? numeric(period.count) : 0;
  const retention = period.rate === undefined ? ratio(count, cohortSize) : normalizePercent(period.rate);
  const marker = heatMarker(retention, colorEnabled);
  return `${marker} ${hasCount ? formatNumber(count) : '-'} (${formatPercent(retention)})`;
}

function retentionPeriodLabels(cohorts: Array<{ periods: Array<{ label: string }> }>): string[] {
  const labels = new Set<string>();
  for (const cohort of cohorts) {
    for (const period of cohort.periods) labels.add(period.label);
  }
  return [...labels];
}

function findRetentionPeriod<T extends { periods: Array<{ label: string }> }>(cohort: T, label: string): T['periods'][number] | undefined {
  return cohort.periods.find((period) => period.label === label);
}

function heatMarker(rate: number, colorEnabled: boolean): string {
  const normalized = Math.max(0, Math.min(1, rate));
  const marker = HEAT_BUCKETS[Math.min(HEAT_BUCKETS.length - 1, Math.floor(normalized * HEAT_BUCKETS.length))] ?? '.';
  if (!colorEnabled) return marker;
  if (normalized >= 0.75) return `\u001B[32m${marker}\u001B[0m`;
  if (normalized >= 0.4) return `\u001B[33m${marker}\u001B[0m`;
  return `\u001B[31m${marker}\u001B[0m`;
}

function formatCountRatio(count: number, denominator: number): string {
  return `${formatNumber(count)} / ${formatNumber(denominator)} (${formatPercent(ratio(count, denominator))})`;
}

function sparkChar(value: number, min: number, max: number): string {
  if (max === min) return '▄';
  const index = Math.round(((value - min) / (max - min)) * (SPARKLINE_BUCKETS.length - 1));
  return SPARKLINE_BUCKETS[Math.max(0, Math.min(SPARKLINE_BUCKETS.length - 1, index))] ?? '_';
}

function sampleSeries(values: number[], maxPoints: number): number[] {
  if (values.length <= maxPoints) return values;
  if (maxPoints <= 1) return [values[values.length - 1] ?? 0];

  const sampled: number[] = [];
  for (let index = 0; index < maxPoints; index += 1) {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * (values.length - 1));
    sampled.push(values[sourceIndex] ?? 0);
  }
  return sampled;
}

function fitLine(value: string, width: number): string {
  return truncateLine(value, width);
}

function padCell(value: string, width: number, align: CliVizAlign): string {
  const text = truncateLine(sanitizeText(value), width);
  const padding = repeat(' ', Math.max(0, width - visualWidth(text)));
  return align === 'right' ? `${padding}${text}` : `${text}${padding}`;
}

function padDisplayCell(value: string, width: number, align: CliVizAlign): string {
  const text = visualWidth(value) <= width ? value : truncateLine(value, width);
  const padding = repeat(' ', Math.max(0, width - visualWidth(text)));
  return align === 'right' ? `${padding}${text}` : `${text}${padding}`;
}

function fitAnsiLine(value: string, width: number): string {
  if (visualWidth(value) <= width) return value.replace(/\r?\n/g, ' ');
  return truncateLine(value, width);
}

function truncateLine(value: string, width: number): string {
  const text = stripAnsi(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  if (visualWidth(text) <= width) return text;
  if (width <= 1) return takeDisplayWidth(text, Math.max(0, width));
  return `${takeDisplayWidth(text, width - 1)}~`;
}

function wrapLine(value: string, width: number): string[] {
  const text = stripAnsi(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trimEnd();
  if (visualWidth(text) <= width) return [text];

  const lines: string[] = [];
  let remaining = text;
  while (visualWidth(remaining) > width) {
    const hardSlice = takeDisplayWidth(remaining, width);
    const lastSpace = hardSlice.lastIndexOf(' ');
    const breakAt = lastSpace > Math.floor(width / 2) ? lastSpace : hardSlice.length;
    const line = hardSlice.slice(0, breakAt).trimEnd();
    lines.push(line);
    remaining = remaining.slice(hardSlice.slice(0, breakAt).length).trimStart();
  }
  if (remaining.length > 0) lines.push(remaining);
  return lines;
}

function takeDisplayWidth(value: string, width: number): string {
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

function visualWidth(value: string): number {
  let width = 0;
  for (const char of stripAnsi(value)) width += charDisplayWidth(char);
  return width;
}

function charDisplayWidth(char: string): number {
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

function sanitizeText(value: string): string {
  return stripAnsi(value)
    .replace(/[<>]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeOperator(value: string): string {
  return stripAnsi(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(value);
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value > 0 && value < 0.1 ? 1 : 0,
    style: 'percent',
  }).format(value);
}

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value > 1 ? value / 100 : value;
}

function ratio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

function numeric(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function titleize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\w\S*/g, (word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`);
}

function widestShrinkable(widths: number[], minimums: number[]): number {
  let index = -1;
  let width = -1;
  widths.forEach((candidate, candidateIndex) => {
    if (candidate > (minimums[candidateIndex] ?? 4) && candidate > width) {
      index = candidateIndex;
      width = candidate;
    }
  });
  return index;
}

function widestExpandable(widths: number[], natural: number[]): number {
  let index = -1;
  let room = 0;
  widths.forEach((candidate, candidateIndex) => {
    const available = (natural[candidateIndex] ?? candidate) - candidate;
    if (available > room) {
      index = candidateIndex;
      room = available;
    }
  });
  return index;
}

function longest(values: string[]): number {
  return Math.max(0, ...values.map(visualWidth));
}

function repeat(value: string, count: number): string {
  return value.repeat(Math.max(0, count));
}

function clampWidth(width: number | undefined): number {
  if (width === undefined) return DEFAULT_WIDTH;
  return Math.max(MIN_WIDTH, Math.floor(width));
}
