import { describe, expect, it } from 'vitest';
import { renderFunnelBars } from '../src/cli-viz';

describe('renderFunnelBars previousRate', () => {
  // count ratio would be 40/100 = 40%, but the authoritative previousRate is
  // 55% — the rendered "Prev" value must be the authoritative one.
  const steps = [
    { label: 'Visited', count: 100 },
    { label: 'Signed up', count: 40, previousRate: 0.55 },
  ];

  it('uses previousRate verbatim in the wide layout', () => {
    const out = renderFunnelBars(steps, { width: 90 });
    expect(out).toContain('55%');
    expect(out).not.toMatch(/\b40%\b/); // the recomputed count ratio is suppressed
  });

  it('uses previousRate in the narrow block layout', () => {
    const out = renderFunnelBars(steps, { width: 40 });
    expect(out).toContain('from previous: 55%');
  });

  it('falls back to count ratio when previousRate is absent', () => {
    const out = renderFunnelBars([{ label: 'A', count: 100 }, { label: 'B', count: 40 }], { width: 90 });
    expect(out).toContain('40%');
  });

  it('ignores previousRate on the first step (shown as start)', () => {
    const out = renderFunnelBars([{ label: 'A', count: 100, previousRate: 0.9 }], { width: 90 });
    expect(out).toContain('start');
  });
});
