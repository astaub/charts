import { describe, expect, it } from 'vitest';
import {
  barGlyphs,
  categorical,
  deltaBadge,
  inlineSparkline,
  makeRenderCtx,
  ramp,
  rampShade,
  renderBarChart,
  renderBigNumber,
  renderFunnelBars,
  renderGroupedBarChart,
  renderLineChart,
  renderRetentionHeatmap,
  renderScatterPlot,
  sparkline,
  renderSparkline,
  renderStackedBarChart,
  renderWaterfallChart,
  resolveCliColorMode,
  resolveColor,
  stripAnsi,
} from '../src/cli-viz/index';
import { THEME, getAppearance, heat, resolveAppearance, setAppearance } from '../src/cli-viz/theme';
import { renderDashboard } from '../src/cli-viz/dashboard';

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
    // The first and last shades are clearly distinct stops, so a descending bar
    // / draining funnel reads as a coherent gradient. (Theme-agnostic: the staub
    // default ramp runs warm coral → cool ocean, so no single channel is
    // monotonic — we only require the ends differ markedly.)
    const channelDistance =
      Math.abs(deep.r - pale.r) + Math.abs(deep.g - pale.g) + Math.abs(deep.b - pale.b);
    expect(channelDistance).toBeGreaterThan(40);
  });

  it('sparkline primitive scales values into compact block glyphs with optional color', () => {
    const mono = makeRenderCtx({ color: 'never' });
    expect(sparkline(mono, [10, 20, 30])).toBe('▁▅█');
    expect(sparkline(mono, [7, 7, 7])).toBe('▅▅▅');
    expect(sparkline(mono, [Number.NaN, Infinity])).toBe('');

    const colored = sparkline(makeRenderCtx({ color: 'always', env: {} }), [10, 20, 30], {
      color: { r: 1, g: 2, b: 3 },
    });
    expect(stripAnsi(colored)).toBe('▁▅█');
    expect(colored).toBe('[38;2;1;2;3m▁[0m[38;2;1;2;3m▅[0m[38;2;1;2;3m█[0m');
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

describe('design system — panel right-border alignment (no ragged edge)', () => {
  // The visible (ANSI-stripped) width of every row in a paneled chart must equal
  // the panel width — otherwise the right border lands at a different column per
  // row (the ragged-edge bug). Braille plot rows are the historical offender:
  // empty cells must be padded (blank braille / uniform width), never trimmed.
  const visW = (line: string) => [...stripAnsi(line)].length;
  const series = [
    { label: 'Web', points: [{ label: 'W1', value: 4200 }, { label: 'W2', value: 4810 }, { label: 'W3', value: 5120 }, { label: 'W4', value: 6880 }] },
    { label: 'Mobile', points: [{ label: 'W1', value: 1800 }, { label: 'W2', value: 2300 }, { label: 'W3', value: 4100 }, { label: 'W4', value: 6010 }] },
  ];
  const cohorts = [
    { label: 'C1', size: 100, periods: [{ label: 'W0', rate: 1 }, { label: 'W1', rate: 0.6 }, { label: 'W2', rate: 0.3 }] },
    { label: 'C2', size: 80, periods: [{ label: 'W0', rate: 1 }, { label: 'W1', rate: 0.5 }] },
  ];
  const width = 72;
  // Built per appearance: the geometry must hold identically on the light and
  // dark palettes (appearance only swaps colors, never column math).
  const casesFor = (appearance: 'light' | 'dark'): Array<[string, string]> => [
    ['bar', renderBarChart([{ label: 'A', value: 9 }, { label: 'B', value: 3 }], { width, title: 't', color: 'always', appearance })],
    ['funnel', renderFunnelBars([{ label: 'Visited', count: 90 }, { label: 'Paid', count: 12 }], { width, title: 't', color: 'always', appearance })],
    ['line-linear', renderLineChart(series, { width, height: 8, title: 't', color: 'always', appearance })],
    ['line-braille', renderLineChart(series, { width, height: 8, lineStyle: 'braille', title: 't', color: 'always', appearance })],
    ['line-area', renderLineChart([series[0]!], { width, height: 8, area: true, title: 't', color: 'always', appearance })],
    ['line-mono', renderLineChart(series, { width, height: 8, lineStyle: 'braille', color: 'never', appearance })],
    ['retention', renderRetentionHeatmap(cohorts, { width, title: 't', color: 'always', appearance })],
    ['stacked', renderStackedBarChart([
      { label: 'W1', segments: [{ key: 'a', label: 'A', value: 60 }, { key: 'b', label: 'B', value: 40 }] },
      { label: 'W2', segments: [{ key: 'a', label: 'A', value: 30 }, { key: 'b', label: 'B', value: 70 }] },
    ], { width, title: 't', color: 'always', appearance })],
    ['grouped', renderGroupedBarChart([
      { label: 'W1', bars: [{ key: 'a', label: 'A', value: 40 }, { key: 'b', label: 'B', value: 12 }] },
      { label: 'W2', bars: [{ key: 'a', label: 'A', value: 52 }, { key: 'b', label: 'B', value: 18 }] },
    ], { width, title: 't', color: 'always', appearance })],
    ['waterfall', renderWaterfallChart([
      { label: 'Start', value: 100, kind: 'start' },
      { label: 'Gain', value: 30, kind: 'positive' },
      { label: 'Loss', value: -20, kind: 'negative' },
      { label: 'End', value: 110, kind: 'end' },
    ], { width, title: 't', color: 'always', appearance })],
    ['bignumber', renderBigNumber(1234, { width, label: 'Signups', previous: 1102, sparkline: [800, 1102, 1050, 1234], color: 'always', appearance })],
    ['bar-goal', renderBarChart([{ label: 'A', value: 9 }, { label: 'B', value: 3 }], { width, title: 't', goal: 6, goalLabel: 'target', color: 'always', appearance })],
    ['scatter', renderScatterPlot([
      { label: 'A', x: 0.6, y: 0.2 }, { label: 'B', x: 0.3, y: -0.1 }, { label: 'C', x: 0.5, y: 0.05 },
    ], { width, title: 't', xThreshold: 0.4, yThreshold: 0.1, color: 'always', appearance })],
  ];

  const rightBorder = new Set(['│', '╮', '╯']);
  for (const appearance of ['dark', 'light'] as const) {
    for (const [name, out] of casesFor(appearance)) {
      it(`${name} (${appearance}): every row is exactly the panel width, single-column right border`, () => {
        const lines = out.split('\n');
        // Sanity: it really is a panel (rounded corners top and bottom).
        expect(stripAnsi(lines[0] ?? '').startsWith('╭')).toBe(true);
        expect(stripAnsi(lines.at(-1) ?? '').startsWith('╰')).toBe(true);
        for (const line of lines) {
          // Equal visible width → the right border lands in one clean column.
          expect(visW(line)).toBe(width);
          // …and that last column really is a border glyph (no ragged stray |).
          const stripped = [...stripAnsi(line)];
          expect(rightBorder.has(stripped.at(-1) ?? '')).toBe(true);
        }
      });
    }
  }

  // The light ragged-border bug slipped through because QA only covered dark.
  // Lock it down: appearance only swaps COLORS, never geometry — so the
  // ANSI-stripped output of each kind must be byte-identical across themes.
  // If a future palette change perturbs a width, this fails on BOTH themes.
  const darkCases = casesFor('dark');
  const lightCases = casesFor('light');
  for (let i = 0; i < darkCases.length; i += 1) {
    const [name, darkOut] = darkCases[i]!;
    const [, lightOut] = lightCases[i]!;
    it(`${name}: light and dark are geometrically identical (colors differ, layout does not)`, () => {
      expect(stripAnsi(lightOut)).toBe(stripAnsi(darkOut));
      // Colored kinds must actually recolor per theme; the mono case (no ANSI)
      // is legitimately identical across appearances.
      if (darkOut.includes('')) expect(lightOut).not.toBe(darkOut);
    });
  }
});

// Font-independent guarantee on the EXACT fixtures + invocation a reviewer used
// (default CLI width, no --width, light theme). A panel renders correctly iff
// every body row is padded to one identical ANSI-visible width before the right
// border is appended — so a single distinct visible width across all rows proves
// the strings are right. (The ragged right border some renderers show is a
// non-uniform-glyph-advance property of the FONT, not the string: the left
// border sits at column 0 on every row regardless of font; the right is at the
// end after N glyphs whose advances drift in a proportional font. Render these
// .ans through a monospace font — e.g. `freeze --font.family Menlo` — and the
// border is one clean column.)
describe('design system — light panels are equal-width on the exact reported fixtures', () => {
  const visW = (line: string) => [...stripAnsi(line)].length;
  const rightBorder = new Set(['│', '╮', '╯']);
  const DEFAULT_WIDTH = 80;
  const cases: Array<[string, string]> = [
    ['bar-revenue-by-plan', renderBarChart(
      [
        { label: 'Enterprise', value: 184200 },
        { label: 'Business', value: 96400 },
        { label: 'Pro', value: 51800 },
        { label: 'Starter', value: 18300 },
        { label: 'Free trial', value: 0 },
      ],
      { title: 'MRR by plan', appearance: 'light', color: 'always' },
    )],
    ['retention-weekly', renderRetentionHeatmap(
      [
        { label: 'Jan W1', size: 1240, periods: [{ label: 'W0', rate: 1 }, { label: 'W1', rate: 0.62 }, { label: 'W2', rate: 0.48 }, { label: 'W3', rate: 0.41 }, { label: 'W4', rate: 0.37 }] },
        { label: 'Jan W2', size: 1380, periods: [{ label: 'W0', rate: 1 }, { label: 'W1', rate: 0.58 }, { label: 'W2', rate: 0.44 }, { label: 'W3', rate: 0.39 }] },
        { label: 'Jan W3', size: 1510, periods: [{ label: 'W0', rate: 1 }, { label: 'W1', rate: 0.65 }, { label: 'W2', rate: 0.50 }] },
        { label: 'Jan W4', size: 1620, periods: [{ label: 'W0', rate: 1 }, { label: 'W1', rate: 0.60 }] },
      ],
      { title: 'Weekly retention', appearance: 'light', color: 'always' },
    )],
  ];
  for (const [name, out] of cases) {
    it(`${name}: one identical visible width per row, single-column right border`, () => {
      expect([...new Set(out.split('\n').map(visW))]).toEqual([DEFAULT_WIDTH]);
      for (const line of out.split('\n')) {
        expect(rightBorder.has([...stripAnsi(line)].at(-1) ?? '')).toBe(true);
      }
    });
  }
});

describe('design system — line / sparkline', () => {
  const series = [
    { label: 'Web', points: [{ label: 'W1', value: 10 }, { label: 'W2', value: 30 }, { label: 'W3', value: 20 }] },
    { label: 'Mobile', points: [{ label: 'W1', value: 5 }, { label: 'W2', value: 15 }, { label: 'W3', value: 25 }] },
  ];

  it('wide line chart renders inside a titled panel with a colored legend', () => {
    const out = renderLineChart(series, { width: 72, height: 6, title: 'Active users', color: 'always' });
    const lines = out.split('\n');
    expect(stripAnsi(lines[0] ?? '')).toContain('╭─ Active users');
    expect(stripAnsi(lines.at(-1) ?? '').startsWith('╰')).toBe(true);
    // Each series legend entry is tinted to its categorical color.
    const c0 = categorical(0);
    const c1 = categorical(1);
    expect(out).toContain(`${ESC}[38;2;${c0.r};${c0.g};${c0.b}m`);
    expect(out).toContain(`${ESC}[38;2;${c1.r};${c1.g};${c1.b}m`);
  });

  it('mono line chart keeps the legacy "Legend:" line and degrades cleanly', () => {
    const out = renderLineChart(series, { width: 72, height: 6, color: 'never' });
    expect(out).not.toContain(ESC);
    expect(out).toContain('Legend: ● Web ◆ Mobile');
  });

  it('braille style draws smooth sub-cell curves', () => {
    const out = renderLineChart(series, { width: 72, height: 6, lineStyle: 'braille', color: 'never' });
    expect(out).toMatch(/[⠀-⣿]/); // braille block present
  });

  it('area fill implies a braille body and fills under the line', () => {
    const single = [{ label: 'p95', points: [{ label: 'a', value: 1 }, { label: 'b', value: 9 }, { label: 'c', value: 4 }] }];
    const out = renderLineChart(single, { width: 60, height: 6, area: true, color: 'never' });
    expect(out).toMatch(/[⠀-⣿]/);
    // The filled-block braille codepoint (all 8 dots, U+28FF) appears in a fill.
    expect(out).toContain('⣿');
  });

  it('sparkline: mono is byte-stable, color tints the glyphs', () => {
    expect(renderSparkline([1, 2, 3, 4, 5], { width: 40, color: 'never' })).toBe('Sparkline: _▂▄▆█ 1 → 5');
    const colored = renderSparkline([1, 2, 3, 4, 5], { width: 40, color: 'always' });
    expect(colored).toContain(`${ESC}[38;2;`);
    expect(stripAnsi(colored)).toBe('Sparkline: _▂▄▆█ 1 → 5');
  });
});

describe('design system — retention heatmap', () => {
  const cohorts = [
    { label: 'C1', size: 100, periods: [{ label: 'W0', rate: 1 }, { label: 'W1', rate: 0.6 }, { label: 'W2', rate: 0.3 }] },
    { label: 'C2', size: 80, periods: [{ label: 'W0', rate: 1 }, { label: 'W1', rate: 0.5 }] },
  ];

  it('wide heatmap renders a titled panel with truecolor heat-filled cells', () => {
    const out = renderRetentionHeatmap(cohorts, { width: 72, title: 'Retention', color: 'always' });
    expect(stripAnsi(out.split('\n')[0] ?? '')).toContain('╭─ Retention');
    // Each cell is a solid background-colored block (48;2;r;g;b) keyed to its rate.
    expect(out).toContain(`${ESC}[38;2;`);
    expect(out).toMatch(/48;2;\d+;\d+;\d+/);
    // Higher retention is hotter/brighter than lower (compare blue channels).
    const bgCodes = [...out.matchAll(/48;2;(\d+);(\d+);(\d+)/g)].map((m) => Number(m[3]));
    expect(Math.max(...bgCodes)).toBeGreaterThan(Math.min(...bgCodes));
  });

  it('mono heatmap degrades to shade glyphs + percent; jagged periods show a dot', () => {
    const out = renderRetentionHeatmap(cohorts, { width: 72, color: 'never' });
    expect(out).not.toContain(ESC);
    expect(out).toMatch(/[░▒▓█]/);
    expect(out).toContain('·'); // C2 has no W2 cell
  });
});

describe('design system — growth primitives (delta + sparkline)', () => {
  const color = makeRenderCtx({ color: 'always' });
  const mono = makeRenderCtx({ color: 'never' });
  const green = '[38;2;45;198;130m';
  const red = '[38;2;240;80;110m';

  it('deltaBadge: arrows + magnitude, mono is plain', () => {
    expect(deltaBadge(mono, 0.12)).toBe('▲ 12%');
    expect(deltaBadge(mono, -0.05)).toBe('▼ 5%');
    expect(deltaBadge(mono, 0)).toBe('→ 0%');
    expect(deltaBadge(mono, 85000, { as: 'number' })).toBe('▲ 85,000');
    expect(deltaBadge(mono, Infinity)).toBe('n/a'); // divide-by-zero etc
  });

  it('deltaBadge: green when good, red when bad, honoring goodDirection', () => {
    expect(deltaBadge(color, 0.12)).toContain(green); // up is good by default
    expect(deltaBadge(color, -0.05)).toContain(red);
    // For churn/latency, down is good → a decrease is green.
    expect(deltaBadge(color, -0.05, { goodDirection: 'down' })).toContain(green);
    expect(deltaBadge(color, 0.05, { goodDirection: 'down' })).toContain(red);
  });

  it('inlineSparkline: block glyphs, mono carries no ANSI', () => {
    expect(inlineSparkline(mono, [1, 3, 2, 5, 4, 8])).toMatch(/^[▁▂▃▄▅▆▇█]+$/);
    expect(inlineSparkline(mono, [])).toBe('');
    const colored = inlineSparkline(color, [1, 3, 2, 5, 4, 8]);
    expect(colored).toContain(ESC);
    expect([...stripAnsi(colored)].length).toBe(6);
  });
});

describe('design system — dashboard composition', () => {
  const spec = [
    { panels: [
      { chart: 'bignumber', value: 1234, options: { label: 'Signups', previous: 1100, sparkline: [900, 1000, 1234] } },
      { chart: 'bignumber', value: 0.031, options: { label: 'Churn', format: 'percent', previous: 0.039, goodDirection: 'down' } },
    ] },
    { panels: [
      { chart: 'funnel', title: 'Funnel', steps: [{ label: 'Visited', count: 100 }, { label: 'Paid', count: 12 }] },
      { chart: 'retention', title: 'Retention', cohorts: [{ label: 'C1', size: 100, periods: [{ label: 'W0', rate: 1 }, { label: 'W1', rate: 0.5 }] }] },
    ] },
  ];

  it('composes a grid and no composed line exceeds the dashboard width', () => {
    const out = renderDashboard(spec, { width: 120, title: 'Overview', color: 'always' });
    expect(out).toContain('Overview');
    expect(out).toContain('Signups');
    expect(out).toContain('Funnel');
    for (const line of out.split('\n')) expect([...stripAnsi(line)].length).toBeLessThanOrEqual(120);
  });

  it('degrades to clean monochrome (no ANSI) when color is off', () => {
    const out = renderDashboard(spec, { width: 120, color: 'never' });
    expect(out).not.toContain(ESC);
    // panels still render side-by-side (two borders on a KPI-row line)
    const kpiRow = out.split('\n').find((l: string) => l.includes('Signups'));
    expect(kpiRow && kpiRow.includes('Churn')).toBe(true);
  });

  it('threads appearance into every sub-panel (no dark-default leak on a light board)', () => {
    // The dashboard must pass its appearance down to each cell; otherwise a
    // sub-panel re-resolves appearance, defaults to dark, and (e.g.) a funnel
    // track renders as a dark block on a light dashboard.
    const light = renderDashboard(spec, { width: 120, color: 'always', appearance: 'light' });
    const dark = renderDashboard(spec, { width: 120, color: 'always', appearance: 'dark' });
    // Same geometry, different colors.
    expect(stripAnsi(light)).toBe(stripAnsi(dark));
    expect(light).not.toBe(dark);
    // The funnel/bar track block is fg(THEME.track). Light track is the pale
    // gray rgb(212,219,233); dark track is rgb(54,60,82). A light board must
    // carry the light track and never the dark one (the bug this fixes).
    expect(light).toContain('38;2;212;219;233');
    expect(light).not.toContain('38;2;54;60;82');
    expect(dark).toContain('38;2;54;60;82');
  });
});

describe('design system — appearance (light / dark adaptation)', () => {
  // Detection + override resolution. Explicit wins; auto reads COLORFGBG; the
  // unknown / unset cases default to dark so there is no regression.
  it('resolveAppearance: explicit wins, auto detects COLORFGBG, default dark', () => {
    expect(resolveAppearance({ appearance: 'light' })).toBe('light');
    expect(resolveAppearance({ appearance: 'dark', env: { COLORFGBG: '0;15' } })).toBe('dark');
    expect(resolveAppearance()).toBe('dark'); // unset → dark (no regression)
    expect(resolveAppearance({ appearance: 'auto', env: {} })).toBe('dark'); // unknown → dark
    expect(resolveAppearance({ appearance: 'auto', env: { COLORFGBG: '0;15' } })).toBe('light'); // bg 15 = light
    expect(resolveAppearance({ appearance: 'auto', env: { COLORFGBG: '0;7' } })).toBe('light'); // bg 7 = white
    expect(resolveAppearance({ appearance: 'auto', env: { COLORFGBG: '15;0' } })).toBe('dark'); // bg 0 = dark
    expect(resolveAppearance({ appearance: 'auto', env: { COLORFGBG: '15;default;0' } })).toBe('dark'); // 3-field
    expect(resolveAppearance({ appearance: 'auto', env: { COLORFGBG: '15;default' } })).toBe('dark'); // bg "default"
  });

  it('THEME and heat() are live views onto the active palette', () => {
    setAppearance('dark');
    const darkInk = { ...THEME.ink };
    const darkColdCell = heat(0);
    setAppearance('light');
    const lightInk = { ...THEME.ink };
    const lightColdCell = heat(0);
    // Dark ink is near-white (bright on dark fills); light ink is deep navy.
    expect(darkInk.r).toBeGreaterThan(200);
    expect(lightInk.r).toBeLessThan(80);
    // The light heat ramp's coldest cell is a faint-but-visible tint: light
    // enough to read as "low" on white, but clearly a tinted cell (not the bare
    // background) so a low cohort is distinguishable from an absent one. The
    // dark ramp's coldest cell is near the dark background.
    expect(lightColdCell.r).toBeGreaterThan(200);
    expect(lightColdCell.r).toBeLessThan(240);
    expect(darkColdCell.r).toBeLessThan(80);
    setAppearance('dark'); // restore default so later suites are unaffected
  });

  it('renderers emit different colors per appearance but identical geometry', () => {
    const rows = [{ label: 'Chrome', value: 60 }, { label: 'Safari', value: 40 }];
    const dark = renderBarChart(rows, { width: 60, color: 'always', appearance: 'dark' });
    const light = renderBarChart(rows, { width: 60, color: 'always', appearance: 'light' });
    // Different palettes → different ANSI bytes.
    expect(dark).not.toBe(light);
    // …but the ANSI-stripped geometry is byte-identical.
    expect(stripAnsi(dark)).toBe(stripAnsi(light));
  });

  it('applies the appearance folded into render options (no global leak)', () => {
    // Rendering light then reading getAppearance() reflects the last render.
    renderBarChart([{ label: 'A', value: 1 }], { width: 40, color: 'always', appearance: 'light' });
    expect(getAppearance()).toBe('light');
    renderBarChart([{ label: 'A', value: 1 }], { width: 40, color: 'always', appearance: 'dark' });
    expect(getAppearance()).toBe('dark');
    // An unset appearance resolves back to dark (no leak from a prior light render).
    renderBarChart([{ label: 'A', value: 1 }], { width: 40, color: 'always', appearance: 'light' });
    renderBarChart([{ label: 'A', value: 1 }], { width: 40, color: 'always' });
    expect(getAppearance()).toBe('dark');
  });
});
