import { describe, expect, it } from 'vitest';
import { BrailleCanvas, renderLineChart } from '../src/cli-viz';

describe('BrailleCanvas', () => {
  it('exposes 2x4 dot dimensions per cell', () => {
    const canvas = new BrailleCanvas(3, 2);
    expect(canvas.cols).toBe(3);
    expect(canvas.rows).toBe(2);
    expect(canvas.dotWidth).toBe(6);
    expect(canvas.dotHeight).toBe(8);
  });

  it('sets the top-left dot to U+2801', () => {
    const canvas = new BrailleCanvas(1, 1);
    canvas.set(0, 0);
    expect(canvas.toRows()[0]).toBe('⠁');
  });

  it('sets the bottom-right dot of a cell to U+2880', () => {
    const canvas = new BrailleCanvas(1, 1);
    canvas.set(1, 3);
    expect(canvas.toRows()[0]).toBe('⢀');
  });

  it('ignores out-of-range dots', () => {
    const canvas = new BrailleCanvas(1, 1);
    canvas.set(-1, 0);
    canvas.set(99, 99);
    expect(canvas.toRows()[0]).toBe('');
  });

  it('draws a diagonal line across cells without looping forever', () => {
    const canvas = new BrailleCanvas(4, 2);
    canvas.line(0, 0, 7, 7);
    const rows = canvas.toRows();
    expect(rows).toHaveLength(2);
    expect(rows.join('')).toMatch(/[⠀-⣿]/);
  });
});

describe('renderLineChart braille mode', () => {
  const series = [
    { label: 'Signups', points: Array.from({ length: 12 }, (_, i) => ({ label: `d${i}`, value: 100 + i * 10 })) },
  ];

  it('renders braille glyphs in the plot body', () => {
    const out = renderLineChart(series, { width: 72, lineStyle: 'braille' });
    expect(out).toMatch(/[⠀-⣿]/);
    expect(out).toContain('Legend: ● Signups');
  });

  it('keeps axis labels, goal legend, and footer', () => {
    const out = renderLineChart(series, { width: 72, lineStyle: 'braille', goal: 250, goalLabel: 'target', footer: 'queried 2026-05-28' });
    expect(out).toContain('target ╌ 250');
    expect(out).toContain('queried 2026-05-28');
  });

  it('degrades vlines/shades to compact marks instead of dropping them', () => {
    const out = renderLineChart(series, {
      width: 72,
      lineStyle: 'braille',
      vlines: [{ at: 'd5', label: 'launch' }],
      shades: [{ from: 'd0', to: 'd3', label: 'pre' }],
    });
    expect(out).toContain('Marks: d5=launch');
    expect(out).toContain('Shaded: d0-d3=pre');
  });
});
