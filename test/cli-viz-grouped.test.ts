import { describe, expect, it } from 'vitest';
import { renderGroupedBarChart } from '../src/cli-viz/grouped';

const ANSI_PATTERN = /\[[0-?]*[ -/]*[@-~]/;

const weeklyConversion = [
  {
    label: 'W1',
    bars: [
      { key: 'followed', label: 'Followed', value: 40 },
      { key: 'signed_up', label: 'Signed up', value: 12 },
    ],
  },
  {
    label: 'W2',
    bars: [
      { key: 'followed', label: 'Followed', value: 55 },
      { key: 'signed_up', label: 'Signed up', value: 20 },
    ],
  },
  {
    label: 'W3',
    bars: [
      { key: 'followed', label: 'Followed', value: 70 },
      { key: 'signed_up', label: 'Signed up', value: 38 },
    ],
  },
];

function stripAnsi(value: string): string {
  return value.replace(/\[[0-?]*[ -/]*[@-~]/g, '');
}

describe('renderGroupedBarChart', () => {
  it('renders side-by-side bars with a legend for each series', () => {
    const out = renderGroupedBarChart(weeklyConversion, { width: 72 });
    // Both series surface in the legend with distinct symbols.
    expect(out).toContain('Legend:');
    expect(out).toContain('Followed');
    expect(out).toContain('Signed up');
    // Distinct fill symbols (A for the first series, B for the second).
    expect(out).toContain('A');
    expect(out).toContain('B');
    // Bucket labels appear on the x-axis.
    expect(out).toContain('W1');
    expect(out).toContain('W3');
  });

  it('honors seriesOrder for left-to-right placement', () => {
    const out = renderGroupedBarChart(weeklyConversion, { width: 72, seriesOrder: ['signed_up', 'followed'] });
    const legend = out.split('\n').find((line) => line.includes('Legend:')) ?? '';
    expect(legend.indexOf('Signed up')).toBeLessThan(legend.indexOf('Followed'));
  });

  it('draws a vertical marker rule and its label at the named bucket', () => {
    const out = renderGroupedBarChart(weeklyConversion, {
      width: 72,
      markers: [{ at: 'W2', label: 'shipped' }],
    });
    expect(out).toContain('│');
    expect(out).toContain('shipped');
  });

  it('drops a marker whose bucket does not exist without throwing', () => {
    const out = renderGroupedBarChart(weeklyConversion, {
      width: 72,
      markers: [{ at: 'W9', label: 'nope' }],
    });
    expect(out).not.toContain('nope');
    expect(out).toContain('W1');
  });

  it('falls back to a block listing at narrow widths and still surfaces markers', () => {
    const out = renderGroupedBarChart(weeklyConversion, {
      width: 36,
      markers: [{ at: 'W2', label: 'shipped' }],
    });
    expect(out).toContain('W1');
    expect(out).toContain('Followed: 40');
    expect(out).toContain('Marks:');
    expect(out).toContain('shipped');
  });

  it('formats values as percentages when valueFormat is percent', () => {
    const out = renderGroupedBarChart(
      [
        { label: 'W1', bars: [{ key: 'rate', label: 'Conv', value: 0.12 }] },
        { label: 'W2', bars: [{ key: 'rate', label: 'Conv', value: 0.31 }] },
      ],
      { width: 30, valueFormat: 'percent' },
    );
    expect(out).toContain('%');
  });

  it('applies unit affixes to axis labels', () => {
    const out = renderGroupedBarChart(
      [
        { label: 'W1', bars: [{ key: 'mrr', label: 'MRR', value: 1200 }] },
        { label: 'W2', bars: [{ key: 'mrr', label: 'MRR', value: 1800 }] },
      ],
      { width: 30, unit: { prefix: '$' } },
    );
    expect(out).toContain('$');
  });

  it('returns the empty label when there are no buckets', () => {
    expect(renderGroupedBarChart([], { emptyLabel: 'nothing here' })).toBe('nothing here');
  });

  it('returns the empty label when no bar has a usable key', () => {
    const out = renderGroupedBarChart([{ label: 'W1', bars: [{ key: '', value: 5 }] }]);
    expect(out).toBe('No grouped bar chart data.');
  });

  it('never emits ANSI escape codes', () => {
    const out = renderGroupedBarChart(weeklyConversion, {
      width: 72,
      markers: [{ at: 'W2', label: 'shipped' }],
      footer: 'queried 2026-06-01',
    });
    expect(ANSI_PATTERN.test(out)).toBe(false);
  });

  it('every rendered line stays within the requested width', () => {
    const out = renderGroupedBarChart(weeklyConversion, { width: 60, footer: 'queried 2026-06-01' });
    for (const line of stripAnsi(out).split('\n')) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });

  it('renders a footer below the chart body', () => {
    const out = renderGroupedBarChart(weeklyConversion, { width: 72, footer: 'queried 2026-06-01' });
    expect(out).toContain('queried 2026-06-01');
  });
});
