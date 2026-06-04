# Fixtures

Realistic, real-shaped sample data so every chart kind can be rendered against
data that looks like production analytics (PostHog-style funnels, Highcharts-style
category breakdowns) instead of toy numbers. Each file is a complete agentviz spec
— `chart` is embedded, so you can render it directly:

```sh
# color in a terminal, clean monochrome when piped
bun src/cli.ts < fixtures/funnel-activation.json
bun src/cli.ts bar fixtures/bar-browser-share.json --width 64

# force truecolor (e.g. for screenshots) even when redirected
FORCE_COLOR=1 bun src/cli.ts funnel fixtures/funnel-checkout.json > out.ans
```

## Current set

| File | Kind | Shape |
| --- | --- | --- |
| `funnel-activation.json` | funnel | signup → activation → retention drop-off |
| `funnel-checkout.json` | funnel | e-commerce checkout conversion |
| `bar-browser-share.json` | bar | category breakdown (sessions by browser) |
| `bar-traffic-sources.json` | bar | signups by acquisition channel |
| `bar-revenue-by-plan.json` | bar | MRR by plan (includes a zero row) |
| `line-weekly-active.json` | line | two-series trend (web vs mobile WAU) |
| `line-latency.json` | line | single-series area chart (`options.area`) |
| `retention-weekly.json` | retention | jagged weekly cohort heatmap |
| `stacked-plan-mix.json` | stacked | signups by plan over weeks (colored stack) |
| `grouped-engagement.json` | grouped | grouped columns per week (3 series) |
| `waterfall-mrr-bridge.json` | waterfall | MRR bridge (gains green / drops red) |
| `bignumber-signups.json` | bignumber | KPI tile (value · delta · sparkline) |

More kinds (line, sparkline, heatmap/retention, scatter, stacked, grouped,
waterfall, dashboards) land alongside the renderers that adopt the shared
component system in subsequent PRs.
