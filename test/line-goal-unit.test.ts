import { describe, expect, it } from 'vitest';
import { renderLineChart } from '../src/cli-viz';

const series = [
  {
    label: 'Signups',
    points: [
      { label: 'Mon', value: 120 },
      { label: 'Tue', value: 150 },
      { label: 'Wed', value: 90 },
      { label: 'Thu', value: 200 },
      { label: 'Fri', value: 240 },
    ],
  },
];

describe('renderLineChart goal line', () => {
  it('draws a dashed goal line and labels it (wide)', () => {
    const out = renderLineChart(series, { width: 70, goal: 180, goalLabel: 'Q2 target' });
    expect(out).toContain('╌');
    expect(out).toContain('Q2 target ╌ 180');
  });

  it('keeps the goal inside the axis range even when above the data max', () => {
    const out = renderLineChart(series, { width: 70, goal: 5000 });
    // Axis max should accommodate the goal.
    expect(out).toContain('5,000');
  });

  it('surfaces the goal as an annotation at narrow widths', () => {
    const out = renderLineChart(series, { width: 40, goal: 180, goalLabel: 'Target' });
    expect(out).toContain('Target: 180');
  });
});

describe('renderLineChart units & percent', () => {
  it('applies a unit prefix to axis labels and the goal label', () => {
    const out = renderLineChart(series, { width: 70, unit: { prefix: '$' }, goal: 180 });
    expect(out).toContain('$240');
    expect(out).toContain('Goal ╌ $180');
  });

  it('renders percent-formatted axis labels from 0-1 ratios', () => {
    const pct = [
      { label: 'Conv', points: [
        { label: 'W1', value: 0.12 },
        { label: 'W2', value: 0.18 },
        { label: 'W3', value: 0.15 },
      ] },
    ];
    const out = renderLineChart(pct, { width: 64, valueFormat: 'percent', goal: 0.2 });
    expect(out).toContain('20%');
    expect(out).toContain('Goal ╌ 20%');
  });
});
