import { describe, expect, it } from 'vitest';
import { renderBigNumber, stripAnsi } from '../src/cli-viz';

describe('renderBigNumber', () => {
  it('renders label as the tile heading + formatted value', () => {
    const out = renderBigNumber(1234, { label: 'Weekly signups' });
    const lines = out.split('\n');
    expect(lines[0]).toContain('╭─ Weekly signups'); // heading lives in the panel border
    expect(out).toContain('1,234');
  });

  it('renders an upward delta vs previous', () => {
    const out = renderBigNumber(1234, { previous: 1102 });
    expect(out).toContain('▲');
    expect(out).toContain('12%');
    expect(out).toContain('vs 1,102');
  });

  it('renders a downward delta vs previous', () => {
    const out = renderBigNumber(900, { previous: 1000 });
    expect(out).toContain('▼');
    expect(out).toContain('10%');
  });

  it('applies unit prefix/suffix and compact format', () => {
    const out = renderBigNumber(48210, { unit: { prefix: '$' }, format: 'compact' });
    expect(out).toContain('$48');
    expect(out).toContain('K');
  });

  it('formats a percent value from a 0-1 ratio', () => {
    const out = renderBigNumber(0.032, { format: 'percent' });
    expect(out).toContain('3.2%');
  });

  it('emits no ANSI by default but colors when enabled', () => {
    const plain = renderBigNumber(1234, { previous: 1102 });
    expect(plain).toBe(stripAnsi(plain));

    const colored = renderBigNumber(1234, { previous: 1102, color: 'always', goodDirection: 'up' });
    expect(colored).not.toBe(stripAnsi(colored));
    // Up is good here → green (32).
    expect(colored).toContain('[38;2;45;198;130m');
  });

  it('treats down as good when goodDirection=down (churn)', () => {
    const out = renderBigNumber(0.03, { previous: 0.04, format: 'percent', color: 'always', goodDirection: 'down' });
    // value fell and down is good → green.
    expect(out).toContain('[38;2;45;198;130m');
  });

  it('renders a sparkline when a series is supplied', () => {
    const out = renderBigNumber(1234, { sparkline: [800, 900, 1102, 1050, 1234] });
    expect(out).toMatch(/[▁▂▃▄▅▆▇█]/);
  });

  it('handles a zero previous without dividing by zero', () => {
    const out = renderBigNumber(10, { previous: 0 });
    expect(out).toContain('n/a');
  });

  it('strips control/escape bytes from unit affixes (no terminal injection)', () => {
    const esc = String.fromCharCode(27);
    const bel = String.fromCharCode(7);
    const out = renderBigNumber(1234, {
      previous: 1000,
      color: 'always',
      unit: { prefix: `${esc}]8;;http://evil${bel}`, suffix: `${esc}[31mX` },
    });
    // The dangerous bytes — the ESC introducer and BEL terminator that make an
    // OSC/CSI sequence executable — must be gone. (Leftover printable text like
    // "]8;;" is harmless once ESC is stripped.) The only ESC permitted is
    // agentviz's own color wrapper, which is green (`[32m`), never the injected
    // red (`[31m`) or OSC (`]8`).
    expect(out).not.toContain(`${esc}]8`);
    expect(out).not.toContain(`${esc}[31m`);
    expect(out).not.toContain(bel);
  });
});
