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
}
export declare function renderDashboard(rows: DashboardRow[], options?: DashboardOptions): string;
