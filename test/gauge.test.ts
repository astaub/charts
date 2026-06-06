import { describe, expect, it } from 'vitest';
import { renderGauge, stripAnsi } from '../src/cli-viz';

describe('renderGauge', () => {
  it('renders a labeled value/max bar with an optional threshold marker', () => {
    const out = renderGauge(72, { max: 100, label: 'Activation', threshold: 80, width: 52 });
    const plain = stripAnsi(out);

    expect(out).toBe(plain);
    expect(plain).toContain('Activation');
    expect(plain).toContain('72 / 100');
    expect(plain).toContain('┊');
    expect(plain).toMatch(/█.*┊.*░/);
    expect(plain.length).toBeLessThanOrEqual(52);
  });

  it('emits a green to amber to coral ANSI ramp when color is enabled', () => {
    const out = renderGauge(100, { max: 100, label: 'Q', width: 35, color: 'always' });

    expect(out).not.toBe(stripAnsi(out));
    expect(out).toContain('[38;2;45;198;130m');
    expect(out).toContain('[38;2;245;176;66m');
    expect(out).toContain('[38;2;255;111;97m');
  });
});
