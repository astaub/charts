export type WaterfallStepKind = 'start' | 'end' | 'positive' | 'negative';
export interface WaterfallStep {
    label: string;
    value: number;
    kind?: WaterfallStepKind;
}
export interface WaterfallChartOptions {
    width?: number;
    emptyLabel?: string;
    title?: string;
    color?: 'never' | 'auto' | 'always';
    isTTY?: boolean;
    env?: Record<string, string | undefined>;
    /** Self-frame in the panel box. Default true; `false` emits a bare body. */
    frame?: boolean;
}
export declare function renderWaterfallChart(steps: WaterfallStep[], options?: WaterfallChartOptions): string;
