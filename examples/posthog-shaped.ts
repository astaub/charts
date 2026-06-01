import { renderBarChart, renderFilterSummary, renderFunnelBars, renderLineChart, renderTable } from '../src/cli-viz';

const trendRows = [
  { label: '2026-05-01', value: 1200, denominator: 1200 },
  { label: '2026-05-02', value: 1312, denominator: 1312 },
  { label: '2026-05-03', value: 1268, denominator: 1268 },
];

const funnelRows = [
  { label: 'Visited signup', count: 920 },
  { label: 'Started signup', count: 340 },
  { label: 'Completed signup', count: 178 },
];

console.log('Trend');
console.log(renderBarChart(trendRows, { width: 72 }));
console.log('');
console.log('Line');
console.log(renderLineChart([
  {
    label: 'Page views',
    points: [
      { label: '2026-05-01', value: 1200 },
      { label: '2026-05-02', value: 1312 },
      { label: '2026-05-03', value: 1268 },
    ],
  },
  {
    label: 'Published profile',
    points: [
      { label: '2026-05-01', value: 178 },
      { label: '2026-05-02', value: 204 },
      { label: '2026-05-03', value: 196 },
    ],
  },
], { width: 72, height: 5 }));
console.log('');
console.log(renderFilterSummary([
  { scope: 'event', field: '$pageview', source: 'PostHog' },
  { scope: 'property', field: '$current_url', operator: 'contains', value: '/setup/example' },
  { scope: 'event', field: 'profile_published', source: 'PostHog' },
], {
  width: 72,
  suggestions: [
    {
      scope: 'cohort',
      field: 'account_age_hours',
      operator: '<=',
      value: 24,
      reason: 'focus on first-day activation',
    },
  ],
}));
console.log('');
console.log('Funnel');
console.log(renderFunnelBars(funnelRows, { width: 72 }));
console.log('');
console.log('Source table');
console.log(renderTable(
  [
    { source: 'Organic', visitors: 820, conversion: 0.21 },
    { source: 'Referral', visitors: 240, conversion: 0.32 },
  ],
  [
    { key: 'source', label: 'Source' },
    { key: 'visitors', label: 'Visitors', format: 'number' },
    { key: 'conversion', label: 'Conversion', format: 'percent' },
  ],
  { width: 72 },
));
