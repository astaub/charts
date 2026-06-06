import type { AppearanceMode, ColorMode, ThemeName } from './theme.js';
export interface HistogramBinDatum {
    label: string;
    min: number;
    max: number;
    count: number;
}
export interface HistogramOptions {
    width?: number;
    height?: number;
    title?: string;
    subtitle?: string;
    emptyLabel?: string;
    bins?: number;
    xLabel?: string;
    yLabel?: string;
    color?: ColorMode;
    isTTY?: boolean;
    env?: Record<string, string | undefined>;
    /** Background appearance the chart is tuned for: 'light' | 'dark' | 'auto'. Default 'dark'. */
    appearance?: AppearanceMode;
    /** Palette (theme) name. Default 'staub' (sunset-on-ocean); 'classic' = blue family. */
    palette?: ThemeName;
    /** Self-frame in the panel box. Default true; `false` emits a bare body. */
    frame?: boolean;
}
export declare function renderHistogram(values: number[], options?: HistogramOptions): string;
export declare function bucketValues(values: number[], requestedBins: number | undefined): HistogramBinDatum[];
