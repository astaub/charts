export type GaugeColorMode = 'never' | 'auto' | 'always';
export interface GaugeOptions {
    width?: number;
    color?: GaugeColorMode;
    isTTY?: boolean;
    env?: Record<string, string | undefined>;
    /** Label drawn to the left of the bar. */
    label?: string;
    /** Maximum value used for the denominator and bar scale. Must be positive. */
    max: number;
    /** Optional threshold marker, scaled against `max`. */
    threshold?: number;
}
export declare function renderGauge(value: number, options: GaugeOptions): string;
