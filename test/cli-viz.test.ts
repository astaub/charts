import { describe, expect, it } from 'vitest';
import {
  renderBarChart,
  renderFilterSummary,
  renderFunnelBars,
  renderLineChart,
  renderRetentionHeatmap,
  renderSparkline,
  renderTable,
  resolveColorEnabled,
  stripAnsi,
} from '../src/cli-viz';

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/;

describe('cli-viz primitives', () => {
  it('renders table goldens at standard widths', () => {
    const rows = [
      {
        source: 'Organic search with a very long descriptive label',
        qualified: 12345,
        activated: 6789,
        rate: 0.55,
        note: 'Mostly self-serve traffic with stable week over week conversion',
      },
      {
        source: 'Partner referral',
        qualified: 320,
        activated: 74,
        rate: 0.231,
        note: 'High touch',
      },
    ];
    const columns = [
      { key: 'source', label: 'Source' },
      { key: 'qualified', label: 'Qualified', format: 'number' as const },
      { key: 'activated', label: 'Activated', format: 'number' as const },
      { key: 'rate', label: 'Rate', format: 'percent' as const },
      { key: 'note', label: 'Note', wrap: true },
    ];

    expect(renderTable(rows, columns, { width: 96 })).toMatchInlineSnapshot(`
      "Source                                            Qualified  Activated  Rate  Note
      ------------------------------------------------  ---------  ---------  ----  ------------------
      Organic search with a very long descriptive lab~     12,345      6,789   55%  Mostly self-serve
                                                                                    traffic with
                                                                                    stable week over
                                                                                    week conversion
      Partner referral                                        320         74   23%  High touch"
    `);
    expect(renderTable(rows, columns, { width: 54 })).toMatchInlineSnapshot(`
      "Source           Qualified  Activated  Rate  Note
      ---------------  ---------  ---------  ----  ---------
      Organic search~     12,345      6,789   55%  Mostly
                                                   self-serv
                                                   e traffic
                                                   with stab
                                                   le week
                                                   over week
                                                   conversio
                                                   n
      Partner referr~        320         74   23%  High touc
                                                   h"
    `);
    expect(renderTable(rows, columns, { width: 40 })).toMatchInlineSnapshot(`
      "1.
       Source: Organic search with a very
      long descriptive label
       Qualified: 12,345
       Activated: 6,789
       Rate: 55%
       Note: Mostly self-serve traffic with
      stable week over week conversion

      2.
       Source: Partner referral
       Qualified: 320
       Activated: 74
       Rate: 23%
       Note: High touch"
    `);
    expect(renderTable(rows, columns, { width: 12 })).toMatchInlineSnapshot(`
      "1.
       Source: Organic search with a
      very long descriptive label
       Qualified: 12,345
       Activated: 6,789
       Rate: 55%
       Note: Mostly self-serve
      traffic with stable week over
      week conversion

      2.
       Source: Partner referral
       Qualified: 320
       Activated: 74
       Rate: 23%
       Note: High touch"
    `);

    for (const line of renderTable(rows, columns, { width: 40 }).split('\n')) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(40);
    }

    for (const line of renderTable(
      [{ name: 'averyverylongunbrokenlabelthatwilloverflow' }],
      [{ key: 'name', label: 'Name', wrap: true }],
      { width: 32 },
    ).split('\n')) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(32);
    }
  });

  it('preserves table exact counts and supports truncation and max rows', () => {
    const output = renderTable(
      [
        { name: 'A very long metric label that should truncate', count: 1234567, ratio: [12345, 67890] },
        { name: 'second', count: 2, ratio: [1, 4] },
      ],
      [
        { key: 'name', label: 'Metric' },
        { key: 'count', label: 'Count', format: 'number' },
        { key: 'ratio', label: 'Exact ratio', format: 'ratio' },
      ],
      { width: 64, maxRows: 1 },
    );

    expect(output).toContain('1,234,567');
    expect(output).toContain('12,345 / 67,890');
    expect(output).toContain('... 1 more rows');
    expect(output).toContain('~');
  });

  it('renders sparkline edge cases deterministically', () => {
    expect(renderSparkline([1, 2, 3, 4, 5], { width: 40 })).toBe('Sparkline: _▂▄▆█ 1 → 5');
    expect(renderSparkline([7, 7, 7], { width: 40 })).toBe('Sparkline: ▄▄▄ 7 → 7');
    expect(renderSparkline([], { width: 40 })).toBe('No sparkline data.');
    expect(renderSparkline([-5, 0, 5], { width: 40 })).toBe('Sparkline: _▄█ -5 → 5');
    expect(renderSparkline([0, 0, 0, 1, 0], { width: 40 })).toBe('Sparkline: ___█_ 0 → 0');
    expect(renderSparkline([1, 2, 3, 4, 5, 6, 7, 8], { width: 12 })).toBe('Sparkline: _▁▂▃▅▆▇█ 1 → 8');
  });

  it('renders multi-series line charts with labels and a narrow sparkline fallback', () => {
    const series = [
      {
        label: '$direct',
        points: [
          { label: '2026-01', value: 68 },
          { label: '2026-02', value: 74 },
          { label: '2026-03', value: 80 },
        ],
      },
      {
        label: 'BD referral',
        points: [
          { label: '2026-01', value: 43 },
          { label: '2026-02', value: 49 },
          { label: '2026-03', value: 57 },
        ],
      },
    ];

    const output = renderLineChart(series, { width: 72, height: 6 });

    expect(output).toContain('80 |');
    expect(output).toContain('2026-01');
    expect(output).toContain('Legend: ● $direct ◆ BD referral');
    expect(output).toContain('●');
    expect(output).toContain('◆');

    for (const line of output.split('\n')) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(72);
    }

    const narrow = renderLineChart(series, { width: 40 });

    expect(narrow).toContain('$direct:');
    expect(narrow).toContain('BD referral:');
    expect(narrow).toContain('68 → 80');
  });

  it('renders source-agnostic filters and suggested filters', () => {
    const output = renderFilterSummary([
      {
        scope: 'event',
        field: '$pageview',
        source: 'PostHog',
      },
      {
        scope: 'property',
        field: '$current_url',
        operator: 'contains',
        value: '/setups/founders',
      },
      {
        scope: 'cohort',
        field: 'company_age_hours',
        operator: '<=',
        value: 24,
        reason: 'first-day activation',
      },
    ], {
      width: 72,
      suggestions: [
        {
          scope: 'property',
          field: 'actor_role',
          operator: 'in',
          value: ['founder', 'admin'],
          reason: 'remove internal helper traffic',
        },
      ],
    });

    expect(output).toContain('Filters');
    expect(output).toContain('- event: $pageview (PostHog)');
    expect(output).toContain('property: $current_url contains /setups/founders');
    expect(output).toContain('cohort: company_age_hours <= 24 - first-day activation');
    expect(output).toContain('Suggested filters');
    expect(output).toContain('property: actor_role in [founder, admin] - remove internal helper');
    expect(output).toContain('traffic');
    for (const line of output.split('\n')) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(72);
    }
  });

  it('preserves line chart bucket order instead of sorting labels alphabetically', () => {
    const output = renderLineChart([
      {
        label: 'retention',
        points: [
          { label: 'W1', value: 10 },
          { label: 'W2', value: 20 },
          { label: 'W10', value: 30 },
        ],
      },
    ], { width: 72, height: 4 });

    expect(output.indexOf('W1')).toBeLessThan(output.indexOf('W2'));
    expect(output.indexOf('W2')).toBeLessThan(output.indexOf('W10'));
  });

  it('does not synthesize zeroes for sparse line series in the narrow fallback', () => {
    const output = renderLineChart([
      {
        label: 'A',
        points: [
          { label: 'Jan', value: 10 },
          { label: 'Mar', value: 20 },
        ],
      },
      {
        label: 'B',
        points: [
          { label: 'Feb', value: 30 },
        ],
      },
    ], { width: 40 });

    expect(output).toContain('A: _█ 10 → 20');
    expect(output).toContain('B: ▄ 30 → 30');
    expect(output).not.toContain('10 → 0');
  });

  it('drops non-finite line chart points instead of coercing them to zero', () => {
    const output = renderLineChart([
      {
        label: 'A',
        points: [
          { label: 'bad', value: Number.NaN },
          { label: 'good', value: 5 },
        ],
      },
    ], { width: 72, height: 4 });

    expect(output).toContain('good');
    expect(output).not.toContain('bad');
  });

  it('keeps decimal y-axis labels readable for rate-like line charts', () => {
    const output = renderLineChart([
      {
        label: 'activation rate',
        points: [
          { label: 'Jan', value: 0.31 },
          { label: 'Feb', value: 0.48 },
        ],
      },
    ], { width: 72, height: 4 });

    expect(output).toContain('0.48 |');
    expect(output).toContain('0.32 |');
    expect(output).not.toContain('    0 |\n    0 |');
  });

  it('keeps small decimal y-axis labels distinct for low-rate line charts', () => {
    const output = renderLineChart([
      {
        label: 'activation rate',
        points: [
          { label: 'Jan', value: 0.01 },
          { label: 'Feb', value: 0.02 },
        ],
      },
    ], { width: 72, height: 4 });

    expect(output).toContain('0.02 |');
    expect(output).toContain('0.013 |');
    expect(output).not.toContain('    0 |\n    0 |\n    0 |');
  });

  it('sanitizes line chart labels for transcript-safe direct use', () => {
    const output = renderLineChart([
      {
        label: '<script>alert(1)</script>',
        points: [
          { label: '<b>Jan</b>', value: 10 },
          { label: '<b>Feb</b>', value: 20 },
        ],
      },
    ], { width: 72, height: 4 });
    const narrow = renderLineChart([
      {
        label: '<script>alert(1)</script>',
        points: [
          { label: '<b>Jan</b>', value: 10 },
          { label: '<b>Feb</b>', value: 20 },
        ],
      },
    ], { width: 40 });

    expect(output).not.toContain('<');
    expect(output).not.toContain('>');
    expect(output).toContain('bJan/b');
    expect(output).toContain('scriptalert(1)/script');
    expect(narrow).not.toContain('<');
    expect(narrow).not.toContain('>');
  });

  it('renders a vline marker at the matched bucket with a label above the chart', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
          { label: 'Mar', value: 3 },
        ],
      },
    ];

    const output = renderLineChart(series, {
      width: 72,
      height: 6,
      vlines: [{ at: 'Feb', label: 'launch', position: 'above' }],
    });

    expect(output).toContain('│');
    expect(output).toContain('launch');
    // Label line appears above the first axis row.
    const lines = output.split('\n');
    const labelLineIndex = lines.findIndex((line) => line.includes('launch'));
    const firstAxisLineIndex = lines.findIndex((line) => /\s\|\s/.test(line));
    expect(labelLineIndex).toBeGreaterThanOrEqual(0);
    expect(labelLineIndex).toBeLessThan(firstAxisLineIndex);
  });

  it('skips unmatched vline at values silently', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
        ],
      },
    ];

    const output = renderLineChart(series, {
      width: 72,
      height: 6,
      vlines: [
        { at: 'Mar', label: 'missing' },
        { at: 'Feb', label: 'present' },
      ],
    });

    expect(output).toContain('present');
    expect(output).not.toContain('missing');
    expect(output).toContain('│');
  });

  it('drops a vline label rather than overwriting a neighbor label', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
          { label: 'Mar', value: 3 },
        ],
      },
    ];

    const output = renderLineChart(series, {
      width: 60,
      height: 4,
      vlines: [
        { at: 'Feb', label: 'launch' },
        { at: 'Mar', label: 'pricing' },
      ],
    });

    // The second label may be dropped due to collision, but no run-together
    // strings like "launcpricing" or "launchpricing" allowed.
    expect(output).not.toMatch(/launch[a-z]/);
    expect(output).not.toMatch(/launcp/);
  });

  it('places vline label below the chart when position is below', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
          { label: 'Mar', value: 3 },
        ],
      },
    ];

    const output = renderLineChart(series, {
      width: 72,
      height: 6,
      vlines: [{ at: 'Feb', label: 'below-marker', position: 'below' }],
    });

    const lines = output.split('\n');
    const labelIndex = lines.findIndex((line) => line.includes('below-marker'));
    const firstAxisLineIndex = lines.findIndex((line) => /\s\|\s/.test(line));
    expect(labelIndex).toBeGreaterThan(firstAxisLineIndex);
  });

  it('shades a from-to range with the requested pattern and lists it in the shade legend', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
          { label: 'Mar', value: 3 },
          { label: 'Apr', value: 4 },
        ],
      },
    ];

    const grayOutput = renderLineChart(series, {
      width: 72,
      height: 6,
      shades: [{ from: 'Jan', to: 'Feb', label: 'pre-launch', pattern: 'gray' }],
    });
    expect(grayOutput).toContain('░');
    expect(grayOutput).toContain('Shaded:');
    expect(grayOutput).toContain('pre-launch');

    const hatchOutput = renderLineChart(series, {
      width: 72,
      height: 6,
      shades: [{ from: 'Jan', to: 'Feb', pattern: 'hatch' }],
    });
    expect(hatchOutput).toContain('▒');
    // Shade with no label does not get a legend line.
    expect(hatchOutput).not.toContain('Shaded:');

    const dottedOutput = renderLineChart(series, {
      width: 72,
      height: 6,
      shades: [{ from: 'Jan', to: 'Feb', pattern: 'dotted' }],
    });
    expect(dottedOutput).toContain('·');
  });

  it('keeps vline visible inside a shaded region', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 1 },
          { label: 'Mar', value: 1 },
          { label: 'Apr', value: 1 },
          { label: 'May', value: 1 },
        ],
      },
    ];

    const output = renderLineChart(series, {
      width: 96,
      height: 6,
      shades: [{ from: 'Jan', to: 'May', pattern: 'gray' }],
      vlines: [{ at: 'Mar', label: 'launch' }],
    });

    expect(output).toContain('│');
  });

  it('keeps series markers visible inside a shaded region', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
          { label: 'Mar', value: 3 },
        ],
      },
    ];

    const output = renderLineChart(series, {
      width: 72,
      height: 6,
      shades: [{ from: 'Jan', to: 'Mar', pattern: 'gray' }],
    });
    // Markers are still drawn (not overwritten by shade chars).
    expect(output).toContain('●');
  });

  it('prints footer below the legend, wrapped at width', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
        ],
      },
    ];

    const output = renderLineChart(series, {
      width: 72,
      height: 4,
      footer: 'queried 2026-05-18 from prod readonly | n=28,661',
    });

    expect(output).toContain('queried 2026-05-18');
    expect(output).toContain('n=28,661');
    const lines = output.split('\n');
    const legendIndex = lines.findIndex((line) => line.startsWith('Legend:'));
    const footerIndex = lines.findIndex((line) => line.includes('queried 2026-05-18'));
    expect(footerIndex).toBeGreaterThan(legendIndex);
  });

  it('narrow-width sparkline fallback still prints footer below the body', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
          { label: 'Mar', value: 3 },
        ],
      },
    ];

    const narrow = renderLineChart(series, {
      width: 40,
      footer: 'queried 2026-05-18 | n=28,661',
    });

    expect(narrow).toContain('rate:');
    expect(narrow).toContain('queried 2026-05-18');
    expect(narrow).toContain('n=28,661');
    const lines = narrow.split('\n');
    const bodyIndex = lines.findIndex((line) => line.startsWith('rate:'));
    const footerIndex = lines.findIndex((line) => line.includes('queried 2026-05-18'));
    expect(footerIndex).toBeGreaterThan(bodyIndex);
    for (const line of lines) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(40);
    }
  });

  it('narrow-width sparkline fallback collapses labelled vlines into a Marks line', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
          { label: 'Mar', value: 3 },
        ],
      },
    ];

    const narrow = renderLineChart(series, {
      width: 40,
      vlines: [
        { at: 'Feb', label: 'launch' },
        { at: 'Mar', label: 'experiment' },
        { at: 'Missing', label: 'never-renders' },
      ],
    });

    expect(narrow).toContain('Marks:');
    expect(narrow).toContain('Feb=launch');
    expect(narrow).toContain('Mar=experiment');
    expect(narrow).not.toContain('never-renders');
    for (const line of narrow.split('\n')) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(40);
    }
  });

  it('narrow-width sparkline fallback collapses labelled shades into a Shaded line', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
          { label: 'Mar', value: 3 },
          { label: 'Apr', value: 4 },
        ],
      },
    ];

    const narrow = renderLineChart(series, {
      width: 40,
      shades: [
        { from: 'Feb', to: 'Mar', label: 'promo', pattern: 'hatch' },
      ],
    });

    expect(narrow).toContain('Shaded:');
    expect(narrow).toContain('Feb-Mar=promo');
    expect(narrow).toContain('▒');
    for (const line of narrow.split('\n')) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(40);
    }
  });

  it('narrow-width shade summary normalizes reversed from/to endpoints to bucket order', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
          { label: 'Mar', value: 3 },
          { label: 'Apr', value: 4 },
        ],
      },
    ];

    // Caller passes from/to reversed. Wide mode normalizes via Math.min/max
    // on bucket indices; narrow mode must mirror that so the printed span
    // always reads in bucket order.
    const narrow = renderLineChart(series, {
      width: 40,
      shades: [
        { from: 'Mar', to: 'Feb', label: 'promo', pattern: 'hatch' },
      ],
    });

    expect(narrow).toContain('Feb-Mar=promo');
    expect(narrow).not.toContain('Mar-Feb');
  });

  it('narrow-width fallback with no annotations stays unchanged (back-compat)', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
          { label: 'Mar', value: 3 },
        ],
      },
    ];

    const narrow = renderLineChart(series, { width: 40 });

    expect(narrow).not.toContain('Marks:');
    expect(narrow).not.toContain('Shaded:');
    expect(narrow.split('\n')).toHaveLength(1);
    expect(narrow).toContain('rate:');
  });

  it('full-width chart at width 54 keeps the full grid render (threshold boundary)', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 2 },
        ],
      },
    ];

    const output = renderLineChart(series, {
      width: 54,
      footer: 'n=10',
      vlines: [{ at: 'Feb', label: 'launch' }],
    });

    // At >= NARROW_WIDTH the full grid render is used: legend appears and
    // the narrow Marks summary does not.
    expect(output).toContain('Legend:');
    expect(output).not.toContain('Marks:');
    expect(output).toContain('n=10');
  });

  it('stagger x-axis labels print on two alternating rows', () => {
    const points = Array.from({ length: 8 }, (_, index) => ({
      label: `B${index + 1}`,
      value: index + 1,
    }));
    const output = renderLineChart([{ label: 'rate', points }], {
      width: 96,
      height: 4,
      xAxisLabels: 'stagger',
    });

    const lines = output.split('\n');
    const axisFloorIndex = lines.findIndex((line) => /^\s+\+\s+-/.test(line));
    expect(axisFloorIndex).toBeGreaterThan(0);
    const rowA = lines[axisFloorIndex + 1] ?? '';
    const rowB = lines[axisFloorIndex + 2] ?? '';
    expect(rowA).toContain('B1');
    expect(rowB).toContain('B2');
    expect(rowA).toContain('B3');
    expect(rowB).toContain('B4');
  });

  it('skip:N x-axis labels render only every Nth bucket label', () => {
    const points = Array.from({ length: 10 }, (_, index) => ({
      label: `M${(index + 1).toString().padStart(2, '0')}`,
      value: index,
    }));
    const output = renderLineChart([{ label: 'rate', points }], {
      width: 96,
      height: 4,
      xAxisLabels: { skipEvery: 3 },
    });

    expect(output).toContain('M01');
    expect(output).toContain('M04');
    expect(output).toContain('M07');
    expect(output).not.toContain('M02');
    expect(output).not.toContain('M05');
  });

  it('auto x-axis labels never corrupts a neighbor at very dense widths', () => {
    const points = Array.from({ length: 40 }, (_, index) => ({
      label: `bucket${(index + 1).toString().padStart(2, '0')}`,
      value: index,
    }));
    const dense = renderLineChart([{ label: 'rate', points }], {
      width: 60,
      height: 4,
      xAxisLabels: 'auto',
    });

    // Each printed label must be one of the original 7-char prefixes; no
    // run-together strings like "bubucket" allowed.
    const validPrefixes = new Set(points.map((point) => point.label.slice(0, 7)));
    const printedFragments = dense
      .split('\n')
      .filter((line) => line.includes('bucket'))
      .join(' ')
      .match(/bucket\d+/g) ?? [];
    for (const fragment of printedFragments) {
      expect(validPrefixes.has(fragment)).toBe(true);
    }
  });

  it('auto x-axis labels detects collisions and falls back to skipEvery', () => {
    const points = Array.from({ length: 14 }, (_, index) => ({
      label: `B${(index + 1).toString().padStart(2, '0')}`,
      value: index,
    }));
    const dense = renderLineChart([{ label: 'rate', points }], {
      width: 60,
      height: 4,
      xAxisLabels: 'auto',
    });

    // With 14 buckets at width 60 some labels are dropped to avoid overlap.
    const printedLabels = points.filter((point) => dense.includes(point.label));
    expect(printedLabels.length).toBeLessThan(points.length);
    expect(printedLabels.length).toBeGreaterThan(0);
  });

  it('lineStyle step renders horizontal and vertical segments without diagonals', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 1 },
          { label: 'Mar', value: 5 },
          { label: 'Apr', value: 5 },
          { label: 'May', value: 2 },
        ],
      },
    ];
    const stepped = renderLineChart(series, { width: 72, height: 8, lineStyle: 'step' });
    expect(stepped).toContain('─');
    expect(stepped).toContain('│');
    expect(stepped).not.toContain('╱');
    expect(stepped).not.toContain('╲');
  });

  it('lineStyle markers-only skips the connecting line entirely', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 3 },
          { label: 'Mar', value: 2 },
          { label: 'Apr', value: 4 },
        ],
      },
    ];
    const markersOnly = renderLineChart(series, { width: 72, height: 6, lineStyle: 'markers-only' });
    expect(markersOnly).not.toContain('╱');
    expect(markersOnly).not.toContain('╲');
    expect(markersOnly).not.toContain('─');
    expect(markersOnly).not.toContain('│');
    expect(markersOnly).toContain('●');
  });

  it('lineStyle linear default matches existing diagonal-interpolation behavior', () => {
    const series = [
      {
        label: 'rate',
        points: [
          { label: 'Jan', value: 1 },
          { label: 'Feb', value: 4 },
          { label: 'Mar', value: 2 },
        ],
      },
    ];
    const explicit = renderLineChart(series, { width: 72, height: 6, lineStyle: 'linear' });
    const implicit = renderLineChart(series, { width: 72, height: 6 });
    expect(explicit).toBe(implicit);
  });

  it('lineStyle step connects the corner between horizontal run and vertical riser', () => {
    // Sharp jump from flat 1 to flat 10: the row at value=1 should contain a
    // vertical-bar cell at the rightmost column of the horizontal run so the
    // step is visually connected (no gap at the corner).
    const stepped = renderLineChart(
      [
        {
          label: 'v',
          points: [
            { label: 'a', value: 1 },
            { label: 'b', value: 1 },
            { label: 'c', value: 10 },
            { label: 'd', value: 10 },
          ],
        },
      ],
      { width: 60, height: 8, lineStyle: 'step' },
    );
    // The row that ends with "│" (corner connection) must exist; if the bug
    // returns, the lowest row will end at "─" with a gap before the riser.
    const lines = stepped.split('\n');
    const hasCornerRow = lines.some((line) => /─│\s*$/.test(line));
    expect(hasCornerRow).toBe(true);
  });

  it('lineStyle markers-only at narrow widths renders dots only, not a sparkline', () => {
    const narrow = renderLineChart(
      [
        {
          label: 'rate',
          points: [
            { label: 'Jan', value: 1 },
            { label: 'Feb', value: 3 },
            { label: 'Mar', value: 2 },
            { label: 'Apr', value: 4 },
          ],
        },
      ],
      { width: 40, lineStyle: 'markers-only' },
    );
    expect(narrow).toContain('●');
    // Sparkline block characters should not appear in markers-only mode at any width.
    expect(narrow).not.toMatch(/[▁▂▃▄▅▆▇█]/);
  });

  it('lineStyle step keeps multi-series renders readable without diagonal scribble', () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const stepped = renderLineChart(
      [
        { label: 'A', points: months.map((m, i) => ({ label: m, value: i + 1 })) },
        { label: 'B', points: months.map((m, i) => ({ label: m, value: 6 - i })) },
      ],
      { width: 96, height: 10, lineStyle: 'step' },
    );
    expect(stepped).not.toContain('╱');
    expect(stepped).not.toContain('╲');
    expect(stepped).toContain('─');
    expect(stepped).toContain('│');
    expect(stepped).toContain('●');
    expect(stepped).toContain('◆');
  });

  it('preserves backwards compat when new line chart options are absent', () => {
    const baseline = renderLineChart(
      [
        {
          label: 'rate',
          points: [
            { label: 'Jan', value: 1 },
            { label: 'Feb', value: 2 },
            { label: 'Mar', value: 3 },
          ],
        },
      ],
      { width: 72, height: 6 },
    );
    expect(baseline).not.toContain('│');
    expect(baseline).not.toContain('░');
    expect(baseline).not.toContain('Shaded:');
    expect(baseline).toContain('Legend: ● rate');
  });

  it('renders bar chart exact denominators, narrow fallback, and zero max', () => {
    const rows = [
      { label: 'Organic', value: 320, denominator: 512 },
      { label: 'BD referral', value: 118, denominator: 512 },
    ];

    // Wide layout: bordered panel, color-coded label · capped block meter ·
    // value · share. Mono (no color option) degrades to clean Unicode blocks.
    expect(renderBarChart(rows, { width: 96 })).toMatchInlineSnapshot(`
      "╭──────────────────────────────────────────────────────────────────────────────────────────────╮
      │                                                                                 Value  Share │
      │                                                                                              │
      │ Organic      ████████████████████████                                             320    63% │
      │ BD referral  ████████▉░░░░░░░░░░░░░░░                                             118    23% │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────╯"
    `);
    expect(renderBarChart(rows, { width: 40 })).toMatchInlineSnapshot(`
      "1. Organic
       value: 320 / 512 (63%)

      2. BD referral
       value: 118 / 512 (23%)"
    `);
    // A zero-value bar reads as an empty track (mono uses the ░ shade).
    expect(renderBarChart([{ label: 'No hits', value: 0, denominator: 100 }], { width: 54 })).toContain('░░░░');

    for (const line of renderBarChart([{ label: 'Huge', value: 123456789012345, denominator: 987654321098765 }], { width: 32 }).split('\n')) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(32);
    }
    const hugeBarAtBoundary = renderBarChart([{ label: 'Huge', value: 123456789012345, denominator: 987654321098765 }], { width: 54 });
    expect(hugeBarAtBoundary).toContain('123,456,789,012,345');
    expect(hugeBarAtBoundary).not.toContain('~');
    expect(renderBarChart([{ label: 'Zero baseline', value: 10, denominator: 0 }], { width: 54 })).toContain('0%');
  });

  it('renders funnel bars with retention and from-previous percentages', () => {
    const steps = [
      { label: 'Visited pricing page', count: 1000 },
      { label: 'Started signup', count: 420 },
      { label: 'Activated workspace', count: 84 },
    ];

    // Wide layout: bordered panel, step label color-coded deep → light as the
    // funnel drains · capped block meter · count · retain-of-first · from-prev.
    expect(renderFunnelBars(steps, { width: 96 })).toMatchInlineSnapshot(`
      "╭──────────────────────────────────────────────────────────────────────────────────────────────╮
      │                                                                         Count  Retain   Prev │
      │                                                                                              │
      │ Visited pricing page  ████████████████████████                          1,000    100%  start │
      │ Started signup        ██████████▏░░░░░░░░░░░░░                            420     42%    42% │
      │ Activated workspace   ██░░░░░░░░░░░░░░░░░░░░░░                             84    8.4%    20% │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────╯"
    `);
    expect(renderFunnelBars(steps, { width: 40 })).toMatchInlineSnapshot(`
      "1. Visited pricing page
       count: 1,000 / 1,000 (100%)
         of first step: 100%

      2. Started signup
       count: 420 / 1,000 (42%)
         from previous: 42%
         of first step: 42%

      3. Activated workspace
       count: 84 / 1,000 (8.4%)
         from previous: 20%
         of first step: 8.4%"
    `);
    const onlyStep = renderFunnelBars([{ label: 'Only step', count: 10 }], { width: 54 });
    expect(onlyStep).toContain('Only step');
    expect(onlyStep).toContain('100%');
    expect(renderFunnelBars([], { width: 54 })).toBe('No funnel steps.');

    for (const line of renderFunnelBars([
      { label: 'Huge first step', count: 123456789012345, denominator: 987654321098765 },
      { label: 'Tiny second step', count: 1 },
    ], { width: 32 }).split('\n')) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(32);
    }
    const hugeFunnelAtBoundary = renderFunnelBars([
      { label: 'Huge first step', count: 123456789012345, denominator: 987654321098765 },
      { label: 'Tiny second step', count: 1 },
    ], { width: 54 });
    expect(hugeFunnelAtBoundary).toContain('123,456,789,012,345 / 987,654,321,098,765');
    expect(hugeFunnelAtBoundary).not.toContain('~');
    expect(renderFunnelBars([{ label: 'Zero baseline', count: 10, denominator: 0 }], { width: 54 })).toContain('100%');
  });

  it('renders retention heatmap jagged cohorts, missing periods, and narrow fallback', () => {
    const cohorts = [
      {
        label: 'Week 0',
        size: 120,
        periods: [
          { label: 'W0', count: 120, rate: 1 },
          { label: 'W1', count: 68, rate: 0.5667 },
          { label: 'W2', count: 49, rate: 0.4083 },
        ],
      },
      {
        label: 'Week 1',
        size: 80,
        periods: [
          { label: 'W0', count: 80, rate: 1 },
          { label: 'W2', count: 20, rate: 0.25 },
        ],
      },
    ];

    expect(renderRetentionHeatmap(cohorts, { width: 96 })).toMatchInlineSnapshot(`
      "Cohort  Size            W0          W1          W2
      ------  ----  ------------  ----------  ----------
      Week 0   120  █ 120 (100%)  ▒ 68 (57%)  ▒ 49 (41%)
      Week 1    80   █ 80 (100%)           -  ░ 20 (25%)"
    `);
    expect(renderRetentionHeatmap(cohorts, { width: 40 })).toMatchInlineSnapshot(`
      "1. Week 0
         size: 120
       W0: █ 120 (100%)
       W1: ▒ 68 (57%)
       W2: ▒ 49 (41%)

      2. Week 1
         size: 80
       W0: █ 80 (100%)
       W1: -
       W2: ░ 20 (25%)"
    `);
    expect(renderRetentionHeatmap([], { width: 54 })).toBe('No retention cohorts.');
    expect(renderRetentionHeatmap([{ label: 'Week 0', size: 10, periods: [] }], { width: 54 })).toBe('No retention periods.');
    expect(renderRetentionHeatmap([{ label: 'Week 0', size: 100, periods: [{ label: 'W1', rate: 0.56 }] }], { width: 54 })).toContain('▒ - (56%)');
  });

  it('keeps default output ANSI-free and disables color for NO_COLOR, non-TTY auto, and color never', () => {
    const cohorts = [{
      label: 'Week 0',
      size: 10,
      periods: [{ label: 'W0', count: 10, rate: 1 }],
    }];

    expect(renderRetentionHeatmap(cohorts, { width: 80 })).not.toMatch(ANSI_PATTERN);
    expect(renderRetentionHeatmap(cohorts, { width: 80, color: 'always', env: { NO_COLOR: undefined } })).toMatch(ANSI_PATTERN);
    expect(resolveColorEnabled({ color: 'never', isTTY: true })).toBe(false);
    expect(resolveColorEnabled({ color: 'auto', isTTY: false })).toBe(false);
    expect(resolveColorEnabled({ color: 'auto', isTTY: true, env: { NO_COLOR: undefined } })).toBe(true);
    expect(resolveColorEnabled({ color: 'always', env: { NO_COLOR: '1' } })).toBe(false);
    expect(stripAnsi('\u001B[32mgreen\u001B[0m')).toBe('green');
  });
});
