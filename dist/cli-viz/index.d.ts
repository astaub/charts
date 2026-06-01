export { renderScatterPlot, type ScatterPlotOptions, type ScatterPlotPoint, type ScatterQuadrantLabels, type ScatterValueFormat, } from './scatter.js';
export { renderStackedBarChart, type StackedBarBucketDatum, type StackedBarChartOptions, type StackedBarSegmentDatum, } from './stacked.js';
export { renderWaterfallChart, type WaterfallChartOptions, type WaterfallStep, type WaterfallStepKind, } from './waterfall.js';
export { renderBigNumber, type BigNumberColorMode, type BigNumberFormat, type BigNumberOptions, type BigNumberUnit, } from './bignumber.js';
export { BrailleCanvas } from './braille.js';
export type CliVizColorMode = 'never' | 'auto' | 'always';
export type CliVizAlign = 'left' | 'right';
export type CliVizFormat = 'text' | 'number' | 'percent' | 'ratio';
export interface CliVizOptions {
    width?: number;
    color?: CliVizColorMode;
    isTTY?: boolean;
    env?: Record<string, string | undefined>;
    barStyle?: 'ascii' | 'blocks';
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
export type LineChartXAxisLabels = 'auto' | 'stagger' | {
    skipEvery: number;
};
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
export declare function renderSparkline(values: number[], options?: SparklineOptions): string;
export declare function renderBarChart(rows: BarChartDatum[], options?: BarChartOptions): string;
export declare function renderLineChart(series: LineChartSeries[], options?: LineChartOptions): string;
export declare function renderFilterSummary(filters: FilterDatum[], options?: FilterSummaryOptions): string;
export declare function renderTable(rows: TableRow[], columns: TableColumn[], options?: TableOptions): string;
export declare function renderFunnelBars(steps: FunnelStepDatum[], options?: CliVizOptions): string;
export declare function renderRetentionHeatmap(cohorts: RetentionCohortDatum[], options?: CliVizOptions): string;
export declare function stripAnsi(value: string): string;
export declare function resolveColorEnabled(options?: CliVizOptions): boolean;
