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
    title?: string;
    xLabel?: string;
    yLabel?: string;
    xFormat?: ScatterValueFormat;
    yFormat?: ScatterValueFormat;
    xThreshold?: number;
    yThreshold?: number;
    quadrantLabels?: ScatterQuadrantLabels;
    includeTable?: boolean;
    color?: 'never' | 'auto' | 'always';
    isTTY?: boolean;
    env?: Record<string, string | undefined>;
    /** Self-frame in the panel box. Default true; `false` emits a bare body. */
    frame?: boolean;
}
export declare function renderScatterPlot(points: ScatterPlotPoint[], options?: ScatterPlotOptions): string;
