import { type AppearanceMode, type ThemeName } from './theme.js';
export interface DashboardPanel {
    chart: string;
    title?: string;
    options?: Record<string, unknown>;
    rows?: unknown;
    steps?: unknown;
    series?: unknown;
    cohorts?: unknown;
    buckets?: unknown;
    points?: unknown;
    value?: number;
    data?: unknown;
}
export interface DashboardRow {
    panels: DashboardPanel[];
}
export interface DashboardOptions {
    width?: number;
    title?: string;
    subtitle?: string;
    color?: 'never' | 'auto' | 'always';
    isTTY?: boolean;
    env?: Record<string, string | undefined>;
    /** Background appearance: 'light' | 'dark' | 'auto'. Default 'dark'. */
    appearance?: AppearanceMode;
    /** Palette (theme) name. Default 'staub' (sunset-on-ocean); 'classic' = blue family. */
    palette?: ThemeName;
    /**
     * Self-frame each cell in its panel box. Default true. `false` emits bare,
     * unpanelled cell bodies so a host can draw its own chrome (avoids double-framing).
     */
    frame?: boolean;
}
export declare function renderDashboard(rows: DashboardRow[], options?: DashboardOptions): string;
