export interface GroupedBarSeriesDatum {
    key: string;
    label?: string;
    value: number;
}
export interface GroupedBarBucketDatum {
    label: string;
    bars: GroupedBarSeriesDatum[];
}
/** Vertical annotation rule drawn at a bucket's x-position (e.g. a ship date). */
export interface GroupedBarMarker {
    at: string;
    label?: string;
}
/** Format applied to y-axis values: 'percent' treats values as 0–1 ratios. */
export type GroupedBarValueFormat = 'number' | 'percent';
/** Unit affixes for y-axis values, e.g. { prefix: '$' } or { suffix: ' ms' }. */
export interface GroupedBarUnit {
    prefix?: string;
    suffix?: string;
}
export interface GroupedBarChartOptions {
    width?: number;
    height?: number;
    title?: string;
    emptyLabel?: string;
    /** Explicit left-to-right series order by key; unlisted keys follow in first-seen order. */
    seriesOrder?: string[];
    showLegend?: boolean;
    /** Vertical rules drawn at the named buckets. */
    markers?: GroupedBarMarker[];
    valueFormat?: GroupedBarValueFormat;
    unit?: GroupedBarUnit;
    footer?: string;
    color?: 'never' | 'auto' | 'always';
    isTTY?: boolean;
    env?: Record<string, string | undefined>;
    /** Self-frame in the panel box. Default true; `false` emits a bare body. */
    frame?: boolean;
}
export declare function renderGroupedBarChart(buckets: GroupedBarBucketDatum[], options?: GroupedBarChartOptions): string;
