import { describe, expect, it } from 'vitest';
import {
  barGlyphs,
  ramp,
  rampShade,
  renderBarChart,
  renderFunnelBars,
  resolveCliColorMode,
  resolveColor,
  stripAnsi,
} from '../src/cli-viz/index';

const ESC = '\u001B';

describe('design system — color degrade layer', () => {
  it('resolveColor: NO_COLOR wins, explicit modes, auto follows TTY', () => {
    expect(resolveColor({ color: 'always', env: { NO_COLOR: '1' } })).toBe(false);
    expect(resolveColor({ color: 'always', env: {} })).toBe(true);
    expect(resolveColor({ color: 'never', env: {} })).toBe(false);
    expect(resolveColor({ color: 'auto', isTTY: true, env: {} })).toBe(true);
    expect(resolveColor({ color: 'auto', isTTY: false, env: {} })).toBe(false);
    expect(resolveColor({ env: {} })).toBe(false); // library default: off
  });

  it('resolveCliColorMode: terminal conventions (NO_COLOR/FORCE_COLOR/TTY)', () => {
    expect(resolveCliColorMode({ env: { NO_COLOR: '1' }, isTTY: true })).toBe('never');
    expect(resolveCliColorMode({ env: { FORCE_COLOR: '1' }, isTTY: false })).toBe('always');
    expect(resolveCliColorMode({ env: { FORCE_COLOR: '0' }, isTTY: false })).toBe('never');
    expect(resolveCliColorMode({ env: {}, isTTY: true })).toBe('always');
    expect(resolveCliColorMode({ env: {}, isTTY: false })).toBe('never');
  });

  it('colored output carries truecolor ANSI; mono output carries none', () => {
    const rows = [
      { label: 'Chrome', value: 60 },
      { label: 'Safari', value: 40 },
    ];
    const colored = renderBarChart(rows, { width: 60, color: 'always' });
    const mono = renderBarChart(rows, { width: 60, color: 'never' });
    expect(colored).toContain(`${ESC}[38;2;`); // 24-bit foreground
    expect(mono).not.toContain(ESC);
  });

  it('color and mono lay out to the exact same visual width (one geometry)', () => {
    const rows = [
      { label: 'Chrome', value: 60 },
      { label: 'Safari', value: 40 },
    ];
    const colored = renderBarChart(rows, { width: 64, color: 'always' }).split('\n');
    const mono = renderBarChart(rows, { width: 64, color: 'never' }).split('\n');
    for (const line of colored) expect([...stripAnsi(line)].length).toBe(64);
    for (const line of mono) expect([...line].length).toBe(64);
  });
});

describe('design system — glyphs and palette', () => {
  it('barGlyphs: sub-cell fill, total width always equals cells', () => {
    for (const frac of [0, 0.13, 0.5, 0.99, 1]) {
      const { filled, track } = barGlyphs(frac, 20);
      expect([...filled].length + [...track].length).toBe(20);
    }
    expect(barGlyphs(1, 10).filled).toBe('█'.repeat(10));
    expect(barGlyphs(0, 10).track).toBe('░'.repeat(10));
    // A fraction between cells yields a partial eighth-block glyph.
    expect(barGlyphs(0.5, 4).filled).toContain('█');
  });

  it('ramp stays in gamut and rampShade keeps the last item legible', () => {
    for (const t of [0, 0.25, 0.5, 1]) {
      const c = ramp(t);
      for (const ch of [c.r, c.g, c.b]) expect(ch).toBeGreaterThanOrEqual(0), expect(ch).toBeLessThanOrEqual(255);
    }
    const deep = rampShade(0, 5);
    const pale = rampShade(4, 5);
    // Deep shade is darker/more saturated than the palest shade.
    expect(deep.b).toBeGreaterThanOrEqual(pale.b - 1);
    expect(pale.r).toBeGreaterThan(deep.r);
  });
});

describe('design system — paneled charts', () => {
  it('bar and funnel render a bordered panel with the title in the top edge', () => {
    const bar = renderBarChart([{ label: 'A', value: 1 }], { width: 60, title: 'My bar' });
    expect(bar.split('\n')[0]).toContain('╭─ My bar');
    expect(bar.split('\n').at(-1)?.startsWith('╰')).toBe(true);

    const funnel = renderFunnelBars([{ label: 'A', count: 9 }], { width: 60, title: 'My funnel' });
    expect(funnel.split('\n')[0]).toContain('╭─ My funnel');
  });

  it('falls back to a stacked list when too narrow for a legible meter', () => {
    const out = renderFunnelBars([{ label: 'Visited', count: 120 }, { label: 'Paid', count: 18 }], { width: 36 });
    expect(out).not.toContain('╭');
    expect(out).toContain('1. Visited');
  });
});
