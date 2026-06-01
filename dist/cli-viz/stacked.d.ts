export interface StackedBarSegmentDatum {
    key: string;
    label?: string;
    value: number;
}
export interface StackedBarBucketDatum {
    label: string;
    segments: StackedBarSegmentDatum[];
    total?: number;
}
export interface StackedBarChartOptions {
    width?: number;
    title?: string;
    emptyLabel?: string;
    segmentOrder?: string[];
    showLegend?: boolean;
}
export declare function renderStackedBarChart(buckets: StackedBarBucketDatum[], options?: StackedBarChartOptions): string;
