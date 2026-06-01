export type BigNumberColorMode = 'never' | 'auto' | 'always';
export type BigNumberFormat = 'number' | 'percent' | 'compact';
export interface BigNumberUnit {
    /** Rendered immediately before the value, e.g. "$". */
    prefix?: string;
    /** Rendered immediately after the value, e.g. " ms" or "/wk". */
    suffix?: string;
}
export interface BigNumberOptions {
    width?: number;
    color?: BigNumberColorMode;
    isTTY?: boolean;
    env?: Record<string, string | undefined>;
    /** Caption above the value. */
    label?: string;
    /** Unit affixes for the value (and the previous-period value). */
    unit?: BigNumberUnit;
    /** How to format the raw number. 'percent' expects a 0-1 ratio. */
    format?: BigNumberFormat;
    /** Prior-period value; when present, a delta line is rendered. */
    previous?: number;
    /** Underlying series; when present, a sparkline is rendered. */
    sparkline?: number[];
    /**
     * Which direction is "good" for color purposes. 'up' (default) paints an
     * increase green; 'down' paints a decrease green (e.g. churn, latency).
     */
    goodDirection?: 'up' | 'down';
}
export declare function renderBigNumber(value: number, options?: BigNumberOptions): string;
export declare function resolveColorEnabled(options?: BigNumberOptions): boolean;
