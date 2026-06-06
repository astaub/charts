import { describe, expect, it } from 'vitest';
import { bucketValues, renderHistogram, stripAnsi } from '../src/cli-viz';
import { renderChartsSpec } from '../src/cli';

describe('histogram chart', () => {
  it('buckets finite values into the requested number of bins', () => {
    expect(bucketValues([0, 1, 1.9, 2, 3.9, 4], 4).map((bin) => bin.count)).toEqual([1, 2, 1, 2]);
  });

  it('renders a vertical bar chart with count and value axes', () => {
    const output = renderHistogram([0, 1, 1.9, 2, 3.9, 4], {
      bins: 4,
      width: 64,
      height: 5,
      title: 'Distribution',
      color: 'never',
    });

    expect(output).toContain('Distribution');
    expect(output).toContain('Count');
    expect(output).toContain('Value');
    expect(output).toContain('2 |');
    expect(output).toContain('+ ---------------');
    expect(output).toMatch(/███/);
    for (const line of output.split('\n')) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(64);
    }
  });

  it('renders histogram specs through the CLI renderer', () => {
    const output = renderChartsSpec({
      chart: 'histogram',
      title: 'Latency spread',
      values: [10, 12, 15, 20, 35, 38],
      options: { bins: 3, height: 4, color: 'never' },
    }, undefined, 60);

    expect(output).toContain('Latency spread');
    expect(output).toContain('Count');
    expect(output).toContain('Value');
  });
});
