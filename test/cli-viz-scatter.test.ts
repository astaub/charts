import { describe, expect, it } from 'vitest';
import { renderScatterPlot } from '../src/cli-viz/scatter';

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/;

const sourceQualityPoints = [
  { label: 'bd_referral', x: 155, y: 0.48 },
  { label: 'founder_referral', x: 101, y: 0.46 },
  { label: 'organic', x: 134, y: 0.31 },
];

describe('cli-viz scatter plot primitive', () => {
  it('renders a source quality quadrant with exact coordinates', () => {
    const output = renderScatterPlot(sourceQualityPoints, {
      width: 80,
      xLabel: 'Qualified',
      yLabel: 'Activation rate',
      yFormat: 'percent',
      xThreshold: 128,
      yThreshold: 0.4,
      quadrantLabels: {
        topRight: 'scale now',
        topLeft: 'high-converting niche',
        bottomRight: 'volume leak',
        bottomLeft: 'low priority',
      },
    });

    expect(output).toMatchInlineSnapshot(`
      "Activation rate
      49% |                                     |
          |                                     |                              1
          |     2                               |
          |                                     |
          |-------------------------------------+------------------------------------
      40% |                                     |
          |                                     |
          |                                     |
          |                                     |     3
      30% |                                     |
          +--------------------------------------------------------------------------
           96.7                            Qualified                            159.3

      ID  Label             Qualified  Activation rate  Quadrant
      --  ----------------  ---------  ---------------  ---------------------
      1   bd_referral             155              48%  scale now
      2   founder_referral        101              46%  high-converting niche
      3   organic                 134              31%  volume leak"
    `);
    expect(output).not.toMatch(ANSI_PATTERN);
    expect(output).toContain('155');
    expect(output).toContain('48%');
  });

  it('falls back to narrow blocks without losing exact values', () => {
    const output = renderScatterPlot(sourceQualityPoints, {
      width: 40,
      xLabel: 'Qualified count',
      yLabel: 'Activation rate',
      yFormat: 'percent',
      xThreshold: 128,
      yThreshold: 0.4,
    });

    expect(output).toMatchInlineSnapshot(`
      "1. bd_referral
         Qualified count: 155
         Activation rate: 48%
         quadrant: high x / high y

      2. founder_referral
         Qualified count: 101
         Activation rate: 46%
         quadrant: low x / high y

      3. organic
         Qualified count: 134
         Activation rate: 31%
         quadrant: high x / low y"
    `);
    for (const line of output.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it('uses block fallback when a wide table would truncate exact coordinates', () => {
    const output = renderScatterPlot([
      { label: 'very-long-source-name', x: 123456789012345, y: 0.487 },
    ], {
      width: 56,
      xLabel: 'Extremely long qualified company count',
      yLabel: 'Extremely long activation percentage',
      yFormat: 'percent',
      quadrantLabels: {
        topRight: 'long quadrant label that should still be preserved',
      },
    });

    expect(output).toContain('123,456,789,012,345');
    expect(output).toContain('49%');
    expect(output).toContain('long quadrant label that should still');
    for (const line of output.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(56);
    }
  });

  it('uses block fallback for dense point sets so point labels stay unique', () => {
    const output = renderScatterPlot(
      Array.from({ length: 37 }, (_, index) => ({ label: `p${index}`, x: index, y: index })),
      { width: 80 },
    );

    expect(output).toContain('1. p0');
    expect(output).toContain('36. p35');
    expect(output).toContain('37. p36');
    expect(output).not.toContain('ID  Label');
  });

  it('keeps dense block labels within width after item numbers become multi-digit', () => {
    const output = renderScatterPlot(
      Array.from({ length: 12 }, (_, index) => ({ label: 'abcdefghijklmnopqrstuvwxyz0123456789', x: index, y: index })),
      { width: 32 },
    );

    for (const line of output.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(32);
    }
  });

  it('pads flat percentage axes proportionally instead of by whole units', () => {
    const output = renderScatterPlot([
      { label: 'bd_referral', x: 155, y: 0.487 },
    ], {
      width: 80,
      xLabel: 'Qualified',
      yLabel: 'Activation rate',
      yFormat: 'percent',
    });

    expect(output).toContain('54% |');
    expect(output).toContain('49%');
    expect(output).toContain('43% |');
    expect(output).not.toContain('149%');
    expect(output).not.toContain('-51%');
  });

  it('preserves point IDs when points land on threshold axes', () => {
    const output = renderScatterPlot([
      { label: 'on axis', x: 5, y: 5 },
    ], {
      width: 60,
      xThreshold: 5,
      yThreshold: 5,
    });
    const grid = output.split('\n\n')[0] ?? '';

    expect(grid).toContain('1');
    expect(grid).not.toContain('*');
  });

  it('sanitizes labels and axis text for transcript-safe output', () => {
    const output = renderScatterPlot(
      [
        { label: '<script>alert(1)</script>\u001B[31m|source`', x: 10, y: 0.2 },
        { label: 'normal\nsource', x: 20, y: 0.4 },
      ],
      {
        width: 96,
        xLabel: '<Qualified>',
        yLabel: 'Activation\u0007 rate',
        yFormat: 'percent',
      },
    );

    expect(output).not.toMatch(ANSI_PATTERN);
    expect(output).not.toContain('<');
    expect(output).not.toContain('>');
    expect(output).not.toContain('\u0007');
    expect(output).not.toContain('`');
    expect(output).toContain('scriptalert(1)/script/s~');
    expect(output).toContain('Activation rate');
    for (const line of output.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(96);
    }
  });

  it('handles empty and non-finite data without throwing', () => {
    expect(renderScatterPlot([], { width: 80 })).toBe('No scatter plot data.');
    expect(renderScatterPlot([
      { label: 'bad x', x: Number.NaN, y: 1 },
      { label: 'bad y', x: 1, y: Number.POSITIVE_INFINITY },
    ], { width: 80 })).toBe('No scatter plot data.');
  });
});
