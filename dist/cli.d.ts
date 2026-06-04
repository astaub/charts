#!/usr/bin/env node
import { type BarChartDatum, type FilterDatum, type FunnelStepDatum, type GroupedBarMarker, type LineChartLineStyle, type LineChartSeries, type LineChartShade, type LineChartVline, type LineChartXAxisLabels, type RetentionCohortDatum, type ScatterPlotPoint, type StackedBarBucketDatum, type SuggestedFilterDatum, type TableColumn, type TableRow, type WaterfallStep } from './cli-viz/index.js';
type ChartKind = 'bar' | 'bignumber' | 'dashboard' | 'filters' | 'funnel' | 'grouped' | 'line' | 'retention' | 'scatter' | 'sparkline' | 'stacked' | 'table' | 'waterfall';
interface ParsedArgs {
    chart?: ChartKind;
    file?: string;
    width?: number;
    help?: boolean;
    vlines?: LineChartVline[];
    markers?: GroupedBarMarker[];
    shades?: LineChartShade[];
    footer?: string;
    xAxisLabels?: LineChartXAxisLabels;
    lineStyle?: LineChartLineStyle;
    integrity?: boolean;
    verify?: boolean;
}
interface AgentVizSpec {
    chart?: ChartKind;
    title?: string;
    options?: Record<string, unknown>;
    width?: number;
    value?: number;
    values?: number[];
    rows?: TableRow[] | BarChartDatum[];
    data?: unknown;
    columns?: TableColumn[];
    series?: LineChartSeries[];
    steps?: FunnelStepDatum[] | WaterfallStep[];
    cohorts?: RetentionCohortDatum[];
    buckets?: StackedBarBucketDatum[];
    points?: ScatterPlotPoint[];
    filters?: FilterDatum[];
    suggestions?: SuggestedFilterDatum[];
    suggested_filters?: SuggestedFilterDatum[];
    vlines?: LineChartVline[];
    shades?: LineChartShade[];
    footer?: string;
    xAxisLabels?: LineChartXAxisLabels;
    lineStyle?: LineChartLineStyle;
}
interface LineChartOverrides {
    vlines?: LineChartVline[];
    shades?: LineChartShade[];
    footer?: string;
    xAxisLabels?: LineChartXAxisLabels;
    lineStyle?: LineChartLineStyle;
}
export interface RenderAgentVizSpecOptions {
    integrity?: boolean;
    version?: string;
}
export declare function renderAgentVizSpec(spec: unknown, chartHint?: string, cliWidth?: number, lineOverrides?: LineChartOverrides, extra?: RenderAgentVizSpecOptions): string;
export declare function buildCanonicalSpec(spec: AgentVizSpec, chart: ChartKind, width: number | undefined, lineOverrides: LineChartOverrides): Record<string, unknown>;
export declare function parseAgentVizArgs(argv: string[]): ParsedArgs;
export {};
