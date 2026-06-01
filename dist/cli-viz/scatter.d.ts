export type ScatterValueFormat = 'number' | 'percent';
export interface ScatterPlotPoint {
    label: string;
    x: number;
    y: number;
}
export interface ScatterQuadrantLabels {
    topRight?: string;
    topLeft?: string;
    bottomRight?: string;
    bottomLeft?: string;
}
export interface ScatterPlotOptions {
    width?: number;
    xLabel?: string;
    yLabel?: string;
    xFormat?: ScatterValueFormat;
    yFormat?: ScatterValueFormat;
    xThreshold?: number;
    yThreshold?: number;
    quadrantLabels?: ScatterQuadrantLabels;
    includeTable?: boolean;
}
export declare function renderScatterPlot(points: ScatterPlotPoint[], options?: ScatterPlotOptions): string;
